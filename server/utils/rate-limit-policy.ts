export const DEFAULT_API_RATE_LIMIT_PER_MINUTE = 600;
// Shopify doesn't publish a numeric limit for the OAuth token endpoint. Keep
// the app-wide API limiter active, but don't impose a separate token quota by
// default. Deployments can still opt into one with runtime configuration.
export const DEFAULT_TOKEN_RATE_LIMIT_PER_MINUTE = 0;

export function resolveRateLimit(value: unknown, fallback: number) {
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit > 0 ? limit : fallback;
}
