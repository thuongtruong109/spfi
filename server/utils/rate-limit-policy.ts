export const DEFAULT_API_RATE_LIMIT_PER_MINUTE = 600;
export const DEFAULT_ANALYTICS_RATE_LIMIT_PER_MINUTE = 120;
export const DEFAULT_EXPORT_RATE_LIMIT_PER_MINUTE = 20;
// Shopify doesn't publish a numeric limit for the OAuth token endpoint. Keep
// the app-wide API limiter active, but don't impose a separate token quota by
// default. Deployments can still opt into one with runtime configuration.
export const DEFAULT_TOKEN_RATE_LIMIT_PER_MINUTE = 0;

export type ApiRateLimitPolicy = "api" | "analytics" | "export" | "token";

export function classifyApiRateLimitPolicies(pathname: string) {
  const policies: ApiRateLimitPolicy[] = ["api"];
  if (
    pathname === "/api/dashboard" ||
    pathname === "/api/traffic" ||
    pathname.startsWith("/api/traffic/")
  ) {
    policies.push("analytics");
  }
  if (pathname.startsWith("/api/export/")) policies.push("export");
  if (pathname === "/api/generate-token") policies.push("token");
  return policies;
}

export function resolveRateLimit(value: unknown, fallback: number) {
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit > 0 ? limit : fallback;
}
