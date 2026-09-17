import { describe, expect, it } from "vitest";
import { buildPayoutDetailRoute, buildPayoutsRoute } from "~/utils/payment-routes";

describe("payment routes", () => {
  it("preserves the selected shop when opening payout details", () => {
    expect(
      buildPayoutDetailRoute("123", { shop: "shop-a", tab: "payouts" }, "shop-b"),
    ).toEqual({
      path: "/store/payout/123",
      query: { shop: "shop-a", tab: "payouts" },
    });
  });

  it("uses the active shop when an old link has no shop query", () => {
    expect(buildPayoutDetailRoute(123, { tab: "payouts" }, "shop-a")).toEqual({
      path: "/store/payout/123",
      query: { shop: "shop-a", tab: "payouts" },
    });
  });

  it("returns to the payouts tab without dropping route context", () => {
    expect(buildPayoutsRoute({ shop: "shop-a", tab: "transactions" })).toEqual({
      path: "/store",
      query: { shop: "shop-a", tab: "payouts" },
    });
  });
});
