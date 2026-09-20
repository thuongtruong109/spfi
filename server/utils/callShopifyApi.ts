import axios, { type AxiosRequestConfig } from "axios";
import {
  createError,
  getCookie,
  parseCookies,
  setResponseHeader,
  type H3Event,
} from "h3";
import { useRuntimeConfig } from "#imports";
import type {
  AxiosResponse,
  AxiosResponseHeaders,
  RawAxiosResponseHeaders,
} from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";
import {
  parseJsonPreservingUnsafeIntegers,
  stringifyJsonPreservingIntegerIds,
} from "./lossless-json";
import { getShopifyAdminApiBase } from "./shopify-api-version";
import { StoreStatusInputError } from "./status-checker-errors";
import { resolvePublicProxyUrls } from "./public-proxy";
import { readRuntimeBoolean } from "./runtime-config";
import { getAxiosHeaderValue } from "./http-headers";
import {
  buildStandardApiErrorEnvelope,
  createStandardApiErrorFromMessage,
  type ApiErrorDetails,
  type StandardApiError,
} from "./api-error";
import {
  blockShopifyThrottle,
  buildShopifyThrottleKey,
  capShopifyThrottleDelayMs,
  getRestCallLimitDelayMs,
  parseRetryAfterMs,
  waitForShopifyThrottle,
} from "./shopify-throttle";
import { resolveShopifyRestTransportRetry } from "./shopify-transport-retry";
import type { StoreLocalData } from "~~/types/shopify";
type ShopifyApiMethod = "GET" | "POST" | "PUT" | "DELETE";
type ShopifyQueryParams = Record<string, unknown>;

export type ProxyInputMeta = {
  hasScheme: boolean;
  segmentCount: number;
  usernameLength: number;
  passwordLength: number;
  hasInvisibleChars: boolean;
};

export interface CallShopifyApiOptions<TBody = unknown> {
  event: H3Event;
  storeId: string;
  token?: string;
  path: string;
  method?: ShopifyApiMethod;
  body?: TBody;
  params?: ShopifyQueryParams;
  useAdminDomain?: boolean;
  missingProxyMessage?: string;
  timeoutMs?: number;
  /** Defaults to true for GET and false for methods that can mutate data. */
  retryTransport?: boolean;
  preserveUnsafeIntegers?: boolean;
  forwardResponseHeaders?: boolean;
  signal?: AbortSignal;
}

export interface ShopifyApiResponse<TResponse> {
  data: TResponse;
  headers: AxiosResponseHeaders | RawAxiosResponseHeaders;
  status: number;
}

interface SocksProxyAgentInternals {
  proxyUrl?: string;
  shouldLookup?: boolean;
}

const SHOPIFY_JSON_CONTENT_TYPE = "application/json";
const DEFAULT_TIMEOUT_MS = 15000;
const INVISIBLE_OR_CONTROL_CHARS = /[\u0000-\u001F\u007F\u00A0\u200B-\u200D\uFEFF]/g;
const PROXY_PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const SOCKS5_PROTOCOL_PATTERN = /^socks5h?:\/\//i;
const SOCKS5H_PROTOCOL = "socks5h:";
const MAX_STORE_DATA_HEADER_LENGTH = 4096;
const MAX_REST_THROTTLE_RETRIES = 5;

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizePart(value: string) {
  return String(value || "")
    .replace(INVISIBLE_OR_CONTROL_CHARS, "")
    .trim();
}

function normalizeCredential(value: string) {
  return encodeURIComponent(safeDecode(sanitizePart(value)));
}

export function hasInvisibleOrControlChars(value: string): boolean {
  return INVISIBLE_OR_CONTROL_CHARS.test(String(value || ""));
}

export function inspectProxyInput(input: string): ProxyInputMeta {
  const raw = String(input || "");
  const hasScheme = SOCKS5_PROTOCOL_PATTERN.test(raw);

  if (hasScheme) {
    try {
      const parsed = new URL(raw);
      const username = safeDecode(parsed.username || "");
      const password = safeDecode(parsed.password || "");
      return {
        hasScheme: true,
        segmentCount: 0,
        usernameLength: username.length,
        passwordLength: password.length,
        hasInvisibleChars: hasInvisibleOrControlChars(raw),
      };
    } catch {
      return {
        hasScheme: true,
        segmentCount: 0,
        usernameLength: 0,
        passwordLength: 0,
        hasInvisibleChars: hasInvisibleOrControlChars(raw),
      };
    }
  }

  const parts = raw.split(":");
  const username = sanitizePart(parts[2] || "");
  const password = sanitizePart(parts.slice(3).join(":") || "");

  return {
    hasScheme: false,
    segmentCount: parts.length,
    usernameLength: username.length,
    passwordLength: password.length,
    hasInvisibleChars: hasInvisibleOrControlChars(raw),
  };
}

function tryParseCookieValue(rawValue: string): StoreLocalData | null {
  if (!rawValue) return null;

  const candidates = [
    rawValue,
    rawValue.startsWith("j:") ? rawValue.slice(2) : rawValue,
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        return parsed as StoreLocalData;
      }
    } catch {
      // Try fallback decode below.
    }

    try {
      const decoded = decodeURIComponent(candidate);
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === "object") {
        return parsed as StoreLocalData;
      }
    } catch {
      // Ignore malformed cookie values.
    }
  }

  return null;
}

function toRawProxyVariant(sock: string): string | null {
  const raw = sanitizePart(sock || "");
  if (!raw) return null;

  if (SOCKS5_PROTOCOL_PATTERN.test(raw)) {
    return raw.replace(/^socks5:\/\//i, "socks5h://");
  }

  if (PROXY_PROTOCOL_PATTERN.test(raw)) {
    return null;
  }

  const parts = raw.split(":");
  if (parts.length < 2) return null;

  const host = sanitizePart(parts[0] || "");
  const port = sanitizePart(parts[1] || "");
  if (!host || !port) return null;

  if (parts.length === 2) {
    return `socks5h://${host}:${port}`;
  }

  const user = sanitizePart(parts[2] || "");
  const pass = sanitizePart(parts.slice(3).join(":") || "");
  if (!user || !pass) return null;

  return `socks5h://${user}:${pass}@${host}:${port}`;
}

export function resolveStoreCookieData(
  event: H3Event,
  storeId: string,
): StoreLocalData | null {
  const headerData = event.node?.req?.headers?.["x-store-data"];
  const requestStoreData =
    typeof headerData === "string" &&
    headerData.length > 0 &&
    headerData.length <= MAX_STORE_DATA_HEADER_LENGTH
      ? sanitizeRequestStoreData(tryParseCookieValue(headerData))
      : null;
  const mergeRequestData = (persisted: StoreLocalData | null) => {
    if (!requestStoreData) return persisted;
    return {
      ...(persisted || {}),
      ...requestStoreData,
      // Request metadata may select a proxy, but must not smuggle secrets into
      // routes that require explicit authentication input.
      accessToken: persisted?.accessToken,
      clientSecret: persisted?.clientSecret,
    } satisfies StoreLocalData;
  };

  const normalizedStoreId = String(storeId || "").trim();
  if (!normalizedStoreId) return mergeRequestData(null);

  const normalizedDomain = normalizedStoreId.includes(".")
    ? normalizedStoreId.toLowerCase()
    : `${normalizedStoreId}.myshopify.com`.toLowerCase();
  const shortId = normalizedStoreId.split(".")[0] || "";
  const directKeys = Array.from(new Set([normalizedStoreId, shortId])).filter(
    (key): key is string => typeof key === "string" && key.length > 0,
  );

  for (const key of directKeys) {
    const cookieValue = getCookie(event, key);
    if (typeof cookieValue !== "string") continue;

    const parsed = tryParseCookieValue(cookieValue);
    if (parsed) return mergeRequestData(parsed);
  }

  const allCookies = parseCookies(event);
  for (const rawValue of Object.values(allCookies)) {
    if (typeof rawValue !== "string") continue;

    const parsed = tryParseCookieValue(rawValue);
    if (!parsed) continue;

    const domain = String(parsed.domain || "")
      .trim()
      .toLowerCase();
    if (domain && domain === normalizedDomain) {
      return mergeRequestData(parsed);
    }
  }

  return mergeRequestData(null);
}

function sanitizeRequestStoreData(value: StoreLocalData | null): StoreLocalData | null {
  if (!value) return null;

  const domain = normalizeStoreHost(value.domain).slice(0, 253);
  const sock = String(value.sock || "")
    .trim()
    .slice(0, 2048);
  const clientId = String(value.clientId || "")
    .trim()
    .slice(0, 512);
  const expiresTime = Number(value.expiresTime);

  return {
    ...(domain ? { domain } : {}),
    ...(sock ? { sock } : {}),
    ...(clientId ? { clientId } : {}),
    ...(Number.isSafeInteger(expiresTime) && expiresTime > 0 ? { expiresTime } : {}),
  };
}

export function resolveStoreDomain(storeId: string, cookieDomain?: string): string {
  const fromCookie = String(cookieDomain || "").trim();
  if (fromCookie) return fromCookie;

  const normalized = String(storeId || "").trim();
  if (!normalized) return "";
  return normalized.includes(".") ? normalized : `${normalized}.myshopify.com`;
}

export function resolveStoreAdminDomain(
  storeId: string,
  cookieDomain?: string,
): string {
  const storeHost = normalizeStoreHost(storeId);
  const cookieHost = normalizeStoreHost(cookieDomain);
  const myshopifyHost = [storeHost, cookieHost].find((host) =>
    host.endsWith(".myshopify.com"),
  );

  if (myshopifyHost) {
    return myshopifyHost;
  }

  const handle = resolveStoreHandle(storeHost || storeId);
  return handle ? `${handle}.myshopify.com` : "";
}

function normalizeStoreHost(value?: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return (
      raw
        .replace(/^https?:\/\//i, "")
        .split(/[/?#]/)[0]
        ?.replace(/:\d+$/, "")
        .toLowerCase()
        .trim() || ""
    );
  }
}

function resolveStoreHandle(value: string): string {
  const normalized = normalizeStoreHost(value);

  if (!normalized) {
    return "";
  }

  if (normalized.endsWith(".myshopify.com")) {
    return normalized.slice(0, -".myshopify.com".length);
  }

  return normalized.includes(".") ? normalized.split(".")[0] || "" : normalized;
}

export function normalizeProxyUrl(input: string): string {
  const raw = sanitizePart(input || "");

  if (!raw) {
    throw new Error("Proxy is empty.");
  }

  if (PROXY_PROTOCOL_PATTERN.test(raw) && !SOCKS5_PROTOCOL_PATTERN.test(raw)) {
    throw new Error(
      "Only SOCKS5 proxy is supported. Use host:port or host:port:user:pass.",
    );
  }

  if (SOCKS5_PROTOCOL_PATTERN.test(raw)) {
    const parsed = new URL(raw);

    if (parsed.username) {
      parsed.username = normalizeCredential(parsed.username);
    }

    if (parsed.password) {
      parsed.password = normalizeCredential(parsed.password);
    }

    parsed.hostname = sanitizePart(parsed.hostname);
    if (parsed.port) {
      parsed.port = sanitizePart(parsed.port);
    }

    parsed.protocol = SOCKS5H_PROTOCOL;

    return parsed.toString();
  }

  const parts = raw.split(":").map((part) => sanitizePart(part));
  if (parts.length < 2) {
    throw new Error("Invalid proxy format. Use ip:port or ip:port:user:pass.");
  }

  const [host, port, ...credentials] = parts;
  if (!host || !port) {
    throw new Error("Invalid proxy format. Use ip:port or ip:port:user:pass.");
  }

  if (credentials.length === 0) {
    return `socks5h://${host}:${port}`;
  }

  const username = sanitizePart(credentials.shift() || "");
  const password = sanitizePart(credentials.join(":") || "");
  if (!username || !password) {
    throw new Error(
      "Invalid proxy credentials. Use ip:port:user:pass when auth is required.",
    );
  }

  return `socks5h://${normalizeCredential(username)}:${normalizeCredential(
    password,
  )}@${host}:${port}`;
}

export function buildProxyVariants(sock: string): string[] {
  const raw = String(sock || "").trim();
  if (!raw) return [];

  const rawVariant = toRawProxyVariant(raw);
  const variants = [normalizeProxyUrl(raw), ...(rawVariant ? [rawVariant] : [])];

  return variants.filter(
    (variant, index) =>
      variants.findIndex((candidate) => candidate === variant) === index,
  );
}

export function createProxyAgent(proxyUrl: string): SocksProxyAgent {
  const agent = new SocksProxyAgent(proxyUrl);

  assertRemoteDnsSocks5hAgent(agent, proxyUrl);

  return agent;
}

export function maskProxyUrl(proxyUrl: string): string {
  return proxyUrl.replace(/\/\/([^:/@]+):([^@]+)@/, "//****:****@");
}

export async function callShopifyApi<TResponse, TBody = unknown>(
  options: CallShopifyApiOptions<TBody>,
): Promise<TResponse> {
  const response = await callShopifyApiWithResponse<TResponse, TBody>(options);
  return response.data;
}

export async function callShopifyApiWithResponse<TResponse, TBody = unknown>({
  event,
  storeId,
  token,
  path,
  method = "GET",
  body,
  params,
  useAdminDomain = true,
  missingProxyMessage = "Missing sock proxy for this store. Please update it in Manager page.",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryTransport,
  preserveUnsafeIntegers = true,
  forwardResponseHeaders = true,
  signal,
}: CallShopifyApiOptions<TBody>): Promise<ShopifyApiResponse<TResponse>> {
  setResponseHeader(event, "x-spf-field-convention", "shopify-rest");
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
    throw createApiErrorFromMessage(missingProxyMessage, 400);
  }

  const domain = useAdminDomain
    ? resolveStoreAdminDomain(storeId, storeCookie?.domain)
    : resolveStoreDomain(storeId, storeCookie?.domain);
  const baseURL = `https://${domain}/${getShopifyAdminApiBase(event)}`;
  signal?.throwIfAborted();
  const proxyVariants = await resolveShopifyProxyVariants(event, sock);
  signal?.throwIfAborted();
  const throttleKey = buildShopifyThrottleKey("rest", domain, accessToken);
  const shouldRetryTransport = resolveShopifyRestTransportRetry(method, retryTransport);

  let lastError: unknown;

  for (const proxyUrl of proxyVariants) {
    signal?.throwIfAborted();
    try {
      const agent = createProxyAgent(proxyUrl);
      const requestConfig: AxiosRequestConfig<string> = {
        url: `${baseURL}${path.startsWith("/") ? path : `/${path}`}`,
        method,
        data: body === undefined ? undefined : stringifyJsonPreservingIntegerIds(body),
        params,
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": SHOPIFY_JSON_CONTENT_TYPE,
        },
        httpAgent: agent,
        httpsAgent: agent,
        proxy: false,
        timeout: timeoutMs,
        signal,
        transformRequest: [(data) => data],
        ...(preserveUnsafeIntegers
          ? { transformResponse: [parseJsonPreservingUnsafeIntegers] }
          : {}),
      };
      const response = await requestWithRateLimitRetry<TResponse, string>(
        requestConfig,
        throttleKey,
        signal,
      );
      const proactiveDelayMs = getRestCallLimitDelayMs(
        getAxiosHeaderValue(response.headers, "x-shopify-shop-api-call-limit"),
      );
      if (proactiveDelayMs !== null) {
        blockShopifyThrottle(throttleKey, proactiveDelayMs);
      }
      if (forwardResponseHeaders) {
        forwardShopifyResponseHeaders(event, response.headers);
      }

      return {
        data: response.data,
        headers: response.headers,
        status: response.status,
      };
    } catch (error) {
      if (signal?.aborted) throw signal.reason || error;
      lastError = error;
      if (axios.isAxiosError(error) && error.response) {
        throwShopifyApiError(error);
      }
      if (!shouldRetryTransport) {
        throwShopifyApiError(error);
      }
    }
  }

  throwShopifyApiError(lastError);
}

async function requestWithRateLimitRetry<TResponse, TBody>(
  requestConfig: AxiosRequestConfig<TBody>,
  throttleKey: string,
  signal?: AbortSignal,
): Promise<AxiosResponse<TResponse>> {
  for (let retryCount = 0; ; retryCount += 1) {
    await waitForShopifyThrottle(throttleKey, signal);

    try {
      return await axios.request<TResponse, AxiosResponse<TResponse>, TBody>(
        requestConfig,
      );
    } catch (error) {
      if (signal?.aborted) {
        throw signal.reason || error;
      }
      if (!axios.isAxiosError(error) || error.response?.status !== 429) {
        throw error;
      }

      const retryDelayMs = parseRetryAfterMs(
        getAxiosHeaderValue(error.response.headers, "retry-after"),
      );

      // A resource throttle can also return 429, but without a retry window.
      // In that case surface Shopify's error instead of retrying indefinitely.
      if (retryDelayMs === null) {
        throw error;
      }

      if (retryCount >= MAX_REST_THROTTLE_RETRIES) {
        throw error;
      }

      blockShopifyThrottle(throttleKey, capShopifyThrottleDelayMs(retryDelayMs));
    }
  }
}

function forwardShopifyResponseHeaders(
  event: H3Event,
  headers: AxiosResponseHeaders | RawAxiosResponseHeaders,
) {
  for (const headerName of ["x-shopify-shop-api-call-limit", "x-shopify-api-version"]) {
    const value = getAxiosHeaderValue(headers, headerName);
    if (value !== undefined && value !== null && String(value).trim()) {
      setResponseHeader(event, headerName, String(value));
    }
  }
}

export async function resolveShopifyProxyVariants(
  event: H3Event,
  sock: string,
): Promise<string[]> {
  try {
    const proxyVariants = buildProxyVariants(sock);

    if (proxyVariants.length > 0) {
      return await resolvePublicProxyUrls(proxyVariants, {
        allowPrivateHosts: readRuntimeBoolean(
          useRuntimeConfig(event).allowPrivateProxyHosts,
        ),
      });
    }
  } catch (error) {
    throw createApiErrorFromMessage(
      error instanceof Error
        ? error.message
        : "Invalid sock proxy format. Please verify this store's proxy in Manager page.",
      400,
    );
  }

  throw createApiErrorFromMessage(
    "Invalid sock proxy format. Please verify this store's proxy in Manager page.",
    400,
  );
}

export async function createSocksProxyAgents(
  proxy?: string,
  options: { allowPrivateHosts?: boolean } = {},
) {
  let proxyVariants: string[];
  try {
    proxyVariants = await resolvePublicProxyUrls(
      buildStoreStatusProxyVariants(proxy),
      options,
    );
  } catch (error) {
    throw new StoreStatusInputError(
      error instanceof Error ? error.message : "Invalid SOCKS5 proxy.",
    );
  }
  const agents: SocksProxyAgent[] = [];

  for (const proxyUrl of proxyVariants) {
    try {
      const agent = new SocksProxyAgent(proxyUrl);

      assertRemoteDnsSocks5hAgent(agent, proxyUrl);
      agents.push(agent);
    } catch (error) {
      const isLastVariant =
        proxyVariants.indexOf(proxyUrl) === proxyVariants.length - 1;

      if (!agents.length && isLastVariant) {
        throw new StoreStatusInputError(
          error instanceof Error ? error.message : "Invalid SOCKS5 proxy.",
        );
      }
    }
  }

  return agents;
}

export function describeSocksProxyRoute(agent: SocksProxyAgent) {
  const internals = agent as SocksProxyAgentInternals;
  const proxyUrl = internals.proxyUrl || "";
  const protocol = getProxyProtocol(proxyUrl);
  const dnsMode = internals.shouldLookup === false ? "remote DNS" : "local DNS";

  return `${protocol.toUpperCase()} (${dnsMode}) via ${maskProxyUrl(proxyUrl)}`;
}

export function getSocksProxyUrl(agent: SocksProxyAgent) {
  return (agent as SocksProxyAgentInternals).proxyUrl || "";
}

function buildStoreStatusProxyVariants(proxy?: string) {
  try {
    return buildProxyVariants(proxy || "");
  } catch (error) {
    throw new StoreStatusInputError(
      error instanceof Error ? error.message : "Invalid SOCKS5 proxy.",
    );
  }
}

function assertRemoteDnsSocks5hAgent(agent: SocksProxyAgent, proxyUrl: string) {
  const internals = agent as SocksProxyAgentInternals;
  const protocol = getProxyProtocol(internals.proxyUrl || proxyUrl);

  if (protocol !== "socks5h" || internals.shouldLookup !== false) {
    throw new StoreStatusInputError(
      "Proxy must use SOCKS5H remote DNS for every request.",
    );
  }
}

function getProxyProtocol(proxyUrl: string) {
  try {
    return new URL(proxyUrl).protocol.replace(/:$/, "").toLowerCase();
  } catch {
    return "unknown";
  }
}

function throwShopifyApiError(error: unknown): never {
  throw createApiError(error, "Shopify request failed.");
}

export function getErrorStatus(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.status || 500 : 500;
}

export function extractErrorMessage(
  error: unknown,
  fallback = "Request failed.",
): string {
  if (axios.isAxiosError(error)) {
    const responseMessage = formatResponseData(error.response?.data);
    return responseMessage || error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

export function formatErrorMessage(error: unknown): string {
  return extractErrorMessage(error, "Shopify request failed.");
}

export function createApiError(
  error: unknown,
  fallback = "Request failed.",
): ReturnType<typeof createError> {
  const standardError = toStandardApiError(error, fallback);

  return createError({
    statusCode: standardError.error.status || 500,
    statusMessage: standardError.error.message,
    data: standardError,
  });
}

export function createApiErrorFromMessage(
  message: string,
  status = 500,
  details?: ApiErrorDetails,
): ReturnType<typeof createError> {
  return createStandardApiErrorFromMessage(message, status, details);
}

export function toStandardApiError(
  error: unknown,
  fallback = "Request failed.",
): StandardApiError {
  return buildStandardApiError(
    extractErrorMessage(error, fallback),
    getErrorStatus(error),
    getErrorCode(error),
    getErrorDetails(error),
  );
}

export function buildStandardApiError(
  message: string,
  status?: number,
  code?: string,
  details?: ApiErrorDetails,
): StandardApiError {
  return buildStandardApiErrorEnvelope(message, status, code, details);
}

function formatResponseData(data: unknown): string {
  if (!data) {
    return "";
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    const message = record.message || record.error || record.errors;

    if (typeof message === "string") {
      return message;
    }

    if (message) {
      return stringifyUnknown(message);
    }
  }

  return stringifyUnknown(data);
}

function stringifyUnknown(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    return error.code || undefined;
  }

  return typeof error === "object" && error && "code" in error
    ? String(error.code)
    : undefined;
}

function getErrorDetails(error: unknown): ApiErrorDetails | undefined {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object") {
      return data as ApiErrorDetails;
    }
  }

  return undefined;
}
