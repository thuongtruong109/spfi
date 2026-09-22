import { createError, defineEventHandler, getRequestURL, setResponseHeader } from "h3";
import { useRuntimeConfig } from "#imports";
import { resolveClientIp } from "../utils/client-ip";
import { readRuntimeBoolean } from "../utils/runtime-config";
import {
  classifyApiRateLimitPolicies,
  DEFAULT_ANALYTICS_RATE_LIMIT_PER_MINUTE,
  DEFAULT_API_RATE_LIMIT_PER_MINUTE,
  DEFAULT_EXPORT_RATE_LIMIT_PER_MINUTE,
  DEFAULT_TOKEN_RATE_LIMIT_PER_MINUTE,
  type ApiRateLimitPolicy,
  resolveRateLimit,
} from "../utils/rate-limit-policy";

const WINDOW_MS = 60_000;
const CLEANUP_INTERVAL_MS = 5 * WINDOW_MS;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitState {
  buckets: Record<ApiRateLimitPolicy, Map<string, RateLimitEntry>>;
  lastCleanupAt: number;
}

const state: RateLimitState = {
  buckets: {
    api: new Map(),
    analytics: new Map(),
    export: new Map(),
    token: new Map(),
  },
  lastCleanupAt: Date.now(),
};

function cleanupExpiredEntries(now: number) {
  if (now - state.lastCleanupAt < CLEANUP_INTERVAL_MS) return;

  for (const bucket of Object.values(state.buckets)) {
    for (const [key, entry] of bucket) {
      if (entry.resetAt <= now) {
        bucket.delete(key);
      }
    }
  }

  state.lastCleanupAt = now;
}

function consume(
  bucket: Map<string, RateLimitEntry>,
  key: string,
  limit: number,
  now: number,
) {
  let entry = bucket.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    bucket.set(key, entry);
  }

  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname;
  if (!pathname.startsWith("/api/")) return;

  const config = useRuntimeConfig(event);
  const apiLimit = resolveRateLimit(
    config.apiRateLimitPerMinute,
    DEFAULT_API_RATE_LIMIT_PER_MINUTE,
  );
  const tokenLimit = resolveRateLimit(
    config.tokenRateLimitPerMinute,
    DEFAULT_TOKEN_RATE_LIMIT_PER_MINUTE,
  );
  const analyticsLimit = resolveRateLimit(
    config.analyticsRateLimitPerMinute,
    DEFAULT_ANALYTICS_RATE_LIMIT_PER_MINUTE,
  );
  const exportLimit = resolveRateLimit(
    config.exportRateLimitPerMinute,
    DEFAULT_EXPORT_RATE_LIMIT_PER_MINUTE,
  );
  const policyLimits: Record<ApiRateLimitPolicy, number> = {
    api: apiLimit,
    analytics: analyticsLimit,
    export: exportLimit,
    token: tokenLimit,
  };

  const now = Date.now();
  cleanupExpiredEntries(now);

  const ip = resolveClientIp(event, readRuntimeBoolean(config.trustProxyHeaders));
  const results = classifyApiRateLimitPolicies(pathname).flatMap((policy) => {
    const limit = policyLimits[policy];
    return limit > 0
      ? [{ policy, ...consume(state.buckets[policy], ip, limit, now) }]
      : [];
  });
  const rejectedResult = results.find((result) => !result.allowed) || null;
  const headerResult = results.reduce((mostConstrained, result) =>
    result.remaining / result.limit < mostConstrained.remaining / mostConstrained.limit
      ? result
      : mostConstrained,
  );

  setResponseHeader(event, "X-RateLimit-Limit", headerResult.limit);
  setResponseHeader(event, "X-RateLimit-Remaining", headerResult.remaining);
  setResponseHeader(event, "X-RateLimit-Reset", Math.ceil(headerResult.resetAt / 1000));

  // Generic headers describe the most constrained policy for this route.
  // Dedicated headers keep the app-wide API meter stable on token requests.
  const apiResult = results.find((result) => result.policy === "api");
  if (apiResult) {
    setResponseHeader(event, "X-RateLimit-Api-Limit", apiResult.limit);
    setResponseHeader(event, "X-RateLimit-Api-Remaining", apiResult.remaining);
    setResponseHeader(
      event,
      "X-RateLimit-Api-Reset",
      Math.ceil(apiResult.resetAt / 1000),
    );
  }

  for (const result of results) {
    if (result.policy === "api") continue;
    const prefix = `X-RateLimit-${capitalize(result.policy)}`;
    setResponseHeader(event, `${prefix}-Limit`, result.limit);
    setResponseHeader(event, `${prefix}-Remaining`, result.remaining);
    setResponseHeader(event, `${prefix}-Reset`, Math.ceil(result.resetAt / 1000));
  }

  if (!rejectedResult) return;

  const retryAfter = Math.max(1, Math.ceil((rejectedResult.resetAt - now) / 1000));
  setResponseHeader(event, "Retry-After", retryAfter);

  throw createError({
    statusCode: 429,
    statusMessage: "Too Many Requests",
    message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
  });
});

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
