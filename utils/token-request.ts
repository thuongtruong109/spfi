import type { ShopifyAccessTokenResponse } from "~~/types/shopify";
import { getAppErrorStatusCode } from "~~/utils/error";

export interface TokenRequestBody {
  storeId: string;
  clientId: string;
  clientSecret: string;
  sock?: string;
}

interface TokenRequestOptions {
  fetcher?: (
    request: string,
    options: {
      method: "POST";
      body: TokenRequestBody;
      retry: number;
    },
  ) => Promise<ShopifyAccessTokenResponse>;
  wait?: (delayMs: number) => Promise<void>;
}

const TOKEN_RATE_LIMIT_FALLBACK_DELAY_MS = 60_000;
const TOKEN_RATE_LIMIT_MAX_DELAY_MS = 65_000;
const TOKEN_RATE_LIMIT_PADDING_MS = 250;
const TOKEN_RATE_LIMIT_MAX_RETRIES = 1;

export async function requestShopifyAccessToken(
  body: TokenRequestBody,
  options: TokenRequestOptions = {},
) {
  const fetcher = options.fetcher || defaultTokenFetcher;
  const wait = options.wait || waitForDelay;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetcher("/api/generate-token", {
        method: "POST",
        body,
        retry: 0,
      });
    } catch (error) {
      if (
        getAppErrorStatusCode(error) !== 429 ||
        attempt >= TOKEN_RATE_LIMIT_MAX_RETRIES
      ) {
        throw error;
      }

      await wait(resolveTokenRateLimitDelayMs(error));
    }
  }
}

export function resolveTokenRateLimitDelayMs(error: unknown, now = Date.now()) {
  const retryAfter = readErrorHeader(error, "retry-after");
  const retryAfterMs = parseRetryAfterMs(retryAfter, now);
  const resetAt = Number(readErrorHeader(error, "x-ratelimit-reset"));
  const resetDelayMs = Number.isFinite(resetAt) ? resetAt * 1_000 - now : null;
  const requestedDelayMs =
    retryAfterMs ??
    (resetDelayMs !== null && resetDelayMs > 0
      ? resetDelayMs
      : TOKEN_RATE_LIMIT_FALLBACK_DELAY_MS);

  return Math.min(
    TOKEN_RATE_LIMIT_MAX_DELAY_MS,
    Math.max(1_000, Math.ceil(requestedDelayMs + TOKEN_RATE_LIMIT_PADDING_MS)),
  );
}

function defaultTokenFetcher(
  request: string,
  options: {
    method: "POST";
    body: TokenRequestBody;
    retry: number;
  },
) {
  return $fetch<ShopifyAccessTokenResponse>(request, options);
}

function readErrorHeader(error: unknown, name: string) {
  if (!error || typeof error !== "object" || !("response" in error)) return null;

  const response = (error as { response?: { headers?: unknown } }).response;
  const headers = response?.headers;
  if (!headers) return null;

  if (headers instanceof Headers) return headers.get(name);
  if (typeof headers === "object") {
    const record = headers as Record<string, unknown>;
    const value = record[name] ?? record[name.toLowerCase()];
    return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
  }

  return null;
}

function parseRetryAfterMs(value: string | null, now: number) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  const seconds = Number(normalized);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(1, Math.ceil(seconds * 1_000));
  }

  const retryAt = Date.parse(normalized);
  return Number.isFinite(retryAt) ? Math.max(1, retryAt - now) : null;
}

function waitForDelay(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}
