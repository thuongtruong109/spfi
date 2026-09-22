import type { LocationQuery, RouteLocationRaw } from "vue-router";

export function buildPayoutDetailRoute(
  payoutId: string | number,
  query: LocationQuery,
  fallbackShop: string,
): RouteLocationRaw {
  return {
    path: `/store/payout/${encodeURIComponent(String(payoutId))}`,
    query: {
      ...query,
      shop: query.shop || fallbackShop || undefined,
    },
  };
}

export function buildPayoutsRoute(query: LocationQuery): RouteLocationRaw {
  return {
    path: "/store",
    query: { ...query, tab: "payouts" },
  };
}
