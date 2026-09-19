import axios, {
  type AxiosRequestConfig,
  type AxiosResponseHeaders,
  type RawAxiosResponseHeaders,
} from "axios";
import { setResponseHeader, type H3Event } from "h3";
import {
  createApiError,
  createApiErrorFromMessage,
  createProxyAgent,
  resolveShopifyProxyVariants,
  resolveStoreAdminDomain,
  resolveStoreCookieData,
} from "./callShopifyApi";
import { getShopifyAdminApiBase } from "./shopify-api-version";
import { parseJsonPreservingUnsafeIntegers } from "./lossless-json";
import { getAxiosHeaderValue } from "./http-headers";
import {
  blockShopifyThrottle,
  buildShopifyThrottleKey,
  capShopifyThrottleDelayMs,
  getGraphqlCostSummary,
  getGraphqlThrottleDelayMs,
  getGraphqlThrottleStatus,
  isGraphqlThrottled,
  parseRetryAfterMs,
  waitForShopifyThrottle,
  type ShopifyGraphqlExtensions,
} from "./shopify-throttle";
import { resolveShopifyGraphqlTransportRetry } from "./shopify-transport-retry";
import { buildShopifyGid } from "./shopify-gid.ts";

interface ShopifyGraphqlError {
  message: string;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

interface ShopifyGraphqlEnvelope<TData> {
  data?: TData;
  errors?: ShopifyGraphqlError[];
  extensions?: ShopifyGraphqlExtensions;
}

interface CallShopifyGraphqlOptions<TVariables> {
  event: H3Event;
  storeId: string;
  token?: string;
  query: string;
  variables?: TVariables;
  operationName?: string;
  timeoutMs?: number;
  /** Defaults to true for read-only documents and false for mutations. */
  retryTransport?: boolean;
  /** Return usable fields when Shopify responds with both data and field errors. */
  allowPartialData?: boolean;
  maxThrottleRetries?: number;
}

interface ShopifyGraphqlRequest<TVariables> {
  query: string;
  variables?: TVariables;
  operationName?: string;
}

const DEFAULT_GRAPHQL_TIMEOUT_MS = 15000;
const DEFAULT_MAX_GRAPHQL_THROTTLE_RETRIES = 5;

export async function callShopifyGraphql<
  TData,
  TVariables extends Record<string, unknown> = Record<string, unknown>,
>({
  event,
  storeId,
  token,
  query,
  variables,
  operationName,
  timeoutMs = DEFAULT_GRAPHQL_TIMEOUT_MS,
  retryTransport,
  allowPartialData = false,
  maxThrottleRetries = DEFAULT_MAX_GRAPHQL_THROTTLE_RETRIES,
}: CallShopifyGraphqlOptions<TVariables>): Promise<TData> {
  setResponseHeader(event, "x-spf-field-convention", "app-camel-case");
  if (!storeId) {
    throw createApiErrorFromMessage("Store ID is required.", 400);
  }

  const storeCookie = resolveStoreCookieData(event, storeId);
  const accessToken = String(token || storeCookie?.accessToken || "").trim();
  if (!accessToken) {
    throw createApiErrorFromMessage("Access Token is required.", 400);
  }

  const sock = String(storeCookie?.sock || "").trim();
  if (!sock) {
    throw createApiErrorFromMessage(
      "Missing sock proxy for this store. Please update it in Manager page.",
      400,
    );
  }

  const domain = resolveStoreAdminDomain(storeId, storeCookie?.domain);
  const endpoint = `https://${domain}/${getShopifyAdminApiBase(event)}/graphql.json`;
  const throttleKey = buildShopifyThrottleKey("graphql", domain, accessToken);
  const requestBody: ShopifyGraphqlRequest<TVariables> = {
    query,
    ...(variables ? { variables } : {}),
    ...(operationName ? { operationName } : {}),
  };
  const shouldRetryTransport = resolveShopifyGraphqlTransportRetry(
    query,
    retryTransport,
  );
  let lastTransportError: unknown;

  for (const proxyUrl of await resolveShopifyProxyVariants(event, sock)) {
    const agent = createProxyAgent(proxyUrl);
    const config: AxiosRequestConfig<ShopifyGraphqlRequest<TVariables>> = {
      url: endpoint,
      method: "POST",
      data: requestBody,
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      httpAgent: agent,
      httpsAgent: agent,
      proxy: false,
      timeout: timeoutMs,
      transformResponse: [parseJsonPreservingUnsafeIntegers],
    };
    let envelope: ShopifyGraphqlEnvelope<TData> | null = null;
    let throttleRetryCount = 0;

    while (true) {
      await waitForShopifyThrottle(throttleKey);

      try {
        const response = await axios.request<ShopifyGraphqlEnvelope<TData>>(config);
        envelope = response.data;
        forwardGraphqlThrottleHeaders(event, response.headers, envelope.extensions);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          const retryDelayMs = parseRetryAfterMs(
            getAxiosHeaderValue(error.response.headers, "retry-after"),
          );
          if (retryDelayMs !== null) {
            if (throttleRetryCount >= normalizeMaxThrottleRetries(maxThrottleRetries)) {
              throw createApiError(
                error,
                "Shopify GraphQL remained rate limited after retrying.",
              );
            }
            throttleRetryCount += 1;
            blockShopifyThrottle(throttleKey, capShopifyThrottleDelayMs(retryDelayMs));
            continue;
          }
        }

        if (axios.isAxiosError(error) && error.response) {
          throw createApiError(error, "Shopify GraphQL request failed.");
        }

        lastTransportError = error;
        if (!shouldRetryTransport) {
          throw createApiError(error, "Shopify GraphQL request failed.");
        }
        break;
      }

      if (isGraphqlThrottled(envelope.errors)) {
        if (throttleRetryCount >= normalizeMaxThrottleRetries(maxThrottleRetries)) {
          throw createApiErrorFromMessage(
            "Shopify GraphQL remained throttled after retrying.",
            429,
            envelope.errors,
          );
        }
        throttleRetryCount += 1;
        blockShopifyThrottle(
          throttleKey,
          capShopifyThrottleDelayMs(getGraphqlThrottleDelayMs(envelope.extensions)),
        );
        envelope = null;
        continue;
      }

      break;
    }

    if (!envelope) continue;

    if (envelope.errors?.length && !(allowPartialData && envelope.data)) {
      throw createApiErrorFromMessage(
        envelope.errors.map((error) => error.message).join("; "),
        422,
        envelope.errors,
      );
    }
    if (!envelope.data) {
      throw createApiErrorFromMessage(
        "Shopify GraphQL response did not include data.",
        502,
      );
    }

    return envelope.data;
  }

  throw createApiError(lastTransportError, "Shopify GraphQL request failed.");
}

function normalizeMaxThrottleRetries(value: number) {
  return Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, 10)
    : DEFAULT_MAX_GRAPHQL_THROTTLE_RETRIES;
}

function forwardGraphqlThrottleHeaders(
  event: H3Event,
  headers: AxiosResponseHeaders | RawAxiosResponseHeaders,
  extensions?: ShopifyGraphqlExtensions,
) {
  const apiVersion = getAxiosHeaderValue(headers, "x-shopify-api-version");
  if (apiVersion !== undefined && apiVersion !== null) {
    setResponseHeader(event, "x-shopify-api-version", String(apiVersion));
  }

  const cost = getGraphqlCostSummary(extensions);
  if (typeof cost?.requestedQueryCost === "number") {
    setResponseHeader(
      event,
      "x-shopify-graphql-requested-cost",
      String(cost.requestedQueryCost),
    );
  }
  if (typeof cost?.actualQueryCost === "number") {
    setResponseHeader(
      event,
      "x-shopify-graphql-actual-cost",
      String(cost.actualQueryCost),
    );
  }

  const status = getGraphqlThrottleStatus(extensions);
  if (!status) return;

  const responseHeaders = {
    "x-shopify-graphql-maximum-available": status.maximumAvailable,
    "x-shopify-graphql-currently-available": status.currentlyAvailable,
    "x-shopify-graphql-restore-rate": status.restoreRate,
  };

  for (const [name, value] of Object.entries(responseHeaders)) {
    if (value !== null) setResponseHeader(event, name, String(value));
  }
}

export function toShopifyGid(resource: string, id: string | number) {
  return buildShopifyGid(resource, id);
}

export function assertNoGraphqlUserErrors(
  errors: Array<{ field?: string[] | null; message: string }> | undefined,
  fallback: string,
) {
  if (!errors?.length) return;
  throw createApiErrorFromMessage(
    errors.map((error) => error.message).join("; ") || fallback,
    422,
    errors,
  );
}
