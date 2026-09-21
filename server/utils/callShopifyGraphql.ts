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
  getGraphqlThrottleDecision,
  getGraphqlThrottleStatus,
  getShopifyqlBudgetDelayMs,
  getShopifyqlCostSummary,
  isGraphqlThrottled,
  waitForShopifyThrottle,
  type ShopifyGraphqlExtensions,
  MAX_SHOPIFYQL_THROTTLE_WAIT_MS,
} from "./shopify-throttle";
import { resolveShopifyGraphqlTransportRetry } from "./shopify-transport-retry";
import { buildShopifyGid } from "./shopify-gid.ts";
import { recordShopifyQueueLatency } from "./request-observability";

export interface ShopifyGraphqlError {
  message: string;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

export type ShopifyGraphqlFieldAvailability = "available" | "failed";

export interface ShopifyGraphqlPartialResponse<TData> {
  data: TData;
  errors: ShopifyGraphqlError[];
  availability: Record<string, ShopifyGraphqlFieldAvailability>;
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
  signal?: AbortSignal;
}

interface ShopifyGraphqlRequest<TVariables> {
  query: string;
  variables?: TVariables;
  operationName?: string;
}

const DEFAULT_GRAPHQL_TIMEOUT_MS = 15000;
const DEFAULT_MAX_GRAPHQL_THROTTLE_RETRIES = 5;

export function callShopifyGraphql<
  TData,
  TVariables extends Record<string, unknown> = Record<string, unknown>,
>(
  options: CallShopifyGraphqlOptions<TVariables> & { allowPartialData: true },
): Promise<ShopifyGraphqlPartialResponse<TData>>;
export function callShopifyGraphql<
  TData,
  TVariables extends Record<string, unknown> = Record<string, unknown>,
>(
  options: CallShopifyGraphqlOptions<TVariables> & {
    allowPartialData?: false;
  },
): Promise<TData>;
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
  signal,
}: CallShopifyGraphqlOptions<TVariables>): Promise<
  TData | ShopifyGraphqlPartialResponse<TData>
> {
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
  const isShopifyqlOperation = /\bshopifyqlQuery\b/.test(query);
  const shopifyqlThrottleKey = isShopifyqlOperation
    ? buildShopifyThrottleKey("shopifyql", domain, accessToken)
    : null;
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
  signal?.throwIfAborted();
  const proxyVariants = await resolveShopifyProxyVariants(event, sock);
  signal?.throwIfAborted();

  for (const proxyUrl of proxyVariants) {
    signal?.throwIfAborted();
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
      signal,
    };
    let envelope: ShopifyGraphqlEnvelope<TData> | null = null;
    let throttleRetryCount = 0;

    while (true) {
      recordShopifyQueueLatency(
        event,
        await waitForShopifyThrottle(throttleKey, signal),
      );
      if (shopifyqlThrottleKey) {
        recordShopifyQueueLatency(
          event,
          await waitForShopifyThrottle(shopifyqlThrottleKey, signal),
        );
      }

      try {
        const response = await axios.request<ShopifyGraphqlEnvelope<TData>>(config);
        envelope = response.data;
        forwardGraphqlThrottleHeaders(event, response.headers, envelope.extensions);
        const budgetDelayMs = getShopifyqlBudgetDelayMs(envelope.extensions);
        if (shopifyqlThrottleKey && budgetDelayMs !== null) {
          blockShopifyThrottle(
            shopifyqlThrottleKey,
            capShopifyThrottleDelayMs(budgetDelayMs, MAX_SHOPIFYQL_THROTTLE_WAIT_MS),
          );
        }
      } catch (error) {
        if (signal?.aborted) throw signal.reason || error;
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          const errorEnvelope = asGraphqlEnvelope<TData>(error.response.data);
          forwardGraphqlThrottleHeaders(
            event,
            error.response.headers,
            errorEnvelope?.extensions,
          );
          if (throttleRetryCount >= normalizeMaxThrottleRetries(maxThrottleRetries)) {
            throw createApiError(
              error,
              "Shopify GraphQL remained rate limited after retrying.",
            );
          }
          throttleRetryCount += 1;
          const decision = getGraphqlThrottleDecision({
            extensions: errorEnvelope?.extensions,
            errors: errorEnvelope?.errors,
            retryAfter: getAxiosHeaderValue(error.response.headers, "retry-after"),
            shopifyqlOperation: isShopifyqlOperation,
          });
          blockShopifyThrottle(
            decision.scope === "shopifyql" && shopifyqlThrottleKey
              ? shopifyqlThrottleKey
              : throttleKey,
            capShopifyThrottleDelayMs(
              decision.delayMs,
              decision.scope === "shopifyql"
                ? MAX_SHOPIFYQL_THROTTLE_WAIT_MS
                : undefined,
            ),
          );
          continue;
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
        const decision = getGraphqlThrottleDecision({
          extensions: envelope.extensions,
          errors: envelope.errors,
          shopifyqlOperation: isShopifyqlOperation,
        });
        blockShopifyThrottle(
          decision.scope === "shopifyql" && shopifyqlThrottleKey
            ? shopifyqlThrottleKey
            : throttleKey,
          capShopifyThrottleDelayMs(
            decision.delayMs,
            decision.scope === "shopifyql" ? MAX_SHOPIFYQL_THROTTLE_WAIT_MS : undefined,
          ),
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

    if (allowPartialData) {
      const partialResponse = createShopifyGraphqlPartialResponse(
        envelope.data,
        envelope.errors,
      );
      if (!partialResponse) {
        throw createApiErrorFromMessage(
          "Shopify GraphQL returned partial errors without an attributable field path.",
          422,
          envelope.errors,
        );
      }
      return partialResponse;
    }

    return envelope.data;
  }

  throw createApiError(lastTransportError, "Shopify GraphQL request failed.");
}

export function createShopifyGraphqlPartialResponse<TData>(
  data: TData,
  errors: ShopifyGraphqlError[] | undefined,
): ShopifyGraphqlPartialResponse<TData> | null {
  const dataRecord = isRecord(data) ? data : {};
  const availability: Record<string, ShopifyGraphqlFieldAvailability> = {};
  for (const alias of Object.keys(dataRecord)) availability[alias] = "available";

  const unattributedErrors: ShopifyGraphqlError[] = [];
  for (const error of errors || []) {
    const alias = typeof error.path?.[0] === "string" ? error.path[0] : "";
    if (alias) availability[alias] = "failed";
    else unattributedErrors.push(error);
  }

  if (unattributedErrors.length) {
    const nullAliases = Object.entries(dataRecord)
      .filter(([, value]) => value === null)
      .map(([alias]) => alias);
    if (!nullAliases.length) return null;
    for (const alias of nullAliases) availability[alias] = "failed";
  }

  return {
    data,
    errors: [...(errors || [])],
    availability,
  };
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

  const shopifyqlCost = getShopifyqlCostSummary(extensions);
  const shopifyqlHeaders = {
    "x-shopifyql-requested-cost": shopifyqlCost?.requestedQueryCost,
    "x-shopifyql-maximum-available": shopifyqlCost?.maximumAvailable,
    "x-shopifyql-currently-available": shopifyqlCost?.currentlyAvailable,
    "x-shopifyql-window-reset-at": shopifyqlCost?.windowResetAt,
  };
  for (const [name, value] of Object.entries(shopifyqlHeaders)) {
    if (value !== null && value !== undefined) {
      setResponseHeader(event, name, String(value));
    }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asGraphqlEnvelope<TData>(value: unknown) {
  return isRecord(value) ? (value as ShopifyGraphqlEnvelope<TData>) : null;
}
