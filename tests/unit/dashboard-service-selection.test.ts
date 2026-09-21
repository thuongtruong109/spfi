import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchStoreDashboard } from "~~/server/utils/shopify-dashboard";
import { emptyDashboardTraffic } from "~~/utils/dashboard-traffic";

const mocks = vi.hoisted(() => ({
  callShopifyApi: vi.fn(),
  callShopifyPaginatedApi: vi.fn(),
  fetchPaymentTransactions: vi.fn(),
  fetchTraffic: vi.fn(),
}));

vi.mock("~~/server/utils/callShopifyApi", () => ({
  callShopifyApi: mocks.callShopifyApi,
  resolveStoreCookieData: () => ({ domain: "shop-a.myshopify.com" }),
  resolveStoreDomain: (_storeId: string, domain?: string) =>
    domain || "shop-a.myshopify.com",
}));

vi.mock("~~/server/utils/callShopifyPaginatedApi", () => ({
  callShopifyPaginatedApi: mocks.callShopifyPaginatedApi,
}));

vi.mock("~~/server/utils/shopify-payments-graphql", () => ({
  fetchAllShopifyPaymentsBalanceTransactions: mocks.fetchPaymentTransactions,
}));

vi.mock("~~/server/utils/shopify-traffic", async () => {
  const { emptyDashboardTraffic } = await import("~~/utils/dashboard-traffic");
  return {
    fetchShopifyTraffic: mocks.fetchTraffic,
    emptyDashboardTraffic,
  };
});

describe("dashboard service selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.callShopifyApi.mockResolvedValue({
      shop: {
        name: "Shop A",
        currency: "USD",
        iana_timezone: "Etc/UTC",
      },
    });
    mocks.callShopifyPaginatedApi.mockResolvedValue([]);
    mocks.fetchPaymentTransactions.mockResolvedValue([]);
    mocks.fetchTraffic.mockResolvedValue(emptyDashboardTraffic());
  });

  it("skips every unselected Shopify service", async () => {
    const snapshot = await fetchStoreDashboard({
      event: {} as never,
      storeId: "shop-a",
      token: "token",
      services: ["profile"],
    });

    expect(mocks.callShopifyApi).toHaveBeenCalledTimes(1);
    expect(mocks.callShopifyApi).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/shop.json" }),
    );
    expect(mocks.callShopifyPaginatedApi).not.toHaveBeenCalled();
    expect(mocks.fetchPaymentTransactions).not.toHaveBeenCalled();
    expect(mocks.fetchTraffic).not.toHaveBeenCalled();
    expect(snapshot.storeName).toBe("Shop A");
    expect(snapshot.productCount).toBe(0);
    expect(snapshot.customerCount).toBe(0);
    expect(snapshot.payments.available).toBe(false);
    expect(snapshot.resources?.profile.state).toBe("available");
    expect(snapshot.resources?.orders).toEqual({
      state: "unavailable",
      dataAsOf: null,
    });
    expect(snapshot.reconciliation.available).toBe(false);
    expect(snapshot.warnings).toEqual([]);
  });

  it("calls only the Shopify Payments endpoints when payments is selected", async () => {
    mocks.callShopifyApi.mockResolvedValueOnce({ balance: [] });

    await fetchStoreDashboard({
      event: {} as never,
      storeId: "shop-a",
      token: "token",
      services: ["payments"],
    });

    expect(mocks.callShopifyApi).toHaveBeenCalledTimes(1);
    expect(mocks.callShopifyApi).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/shopify_payments/balance.json" }),
    );
    expect(mocks.callShopifyPaginatedApi).toHaveBeenCalledTimes(1);
    expect(mocks.callShopifyPaginatedApi).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/shopify_payments/payouts.json" }),
    );
    expect(mocks.fetchPaymentTransactions).toHaveBeenCalledTimes(1);
    expect(mocks.fetchTraffic).not.toHaveBeenCalled();
  });

  it("marks every traffic block failed when the store traffic request rejects", async () => {
    mocks.fetchTraffic.mockRejectedValueOnce(new Error("read_reports denied"));

    const snapshot = await fetchStoreDashboard({
      event: {} as never,
      storeId: "shop-a",
      token: "token",
      services: ["traffic"],
    });

    expect(snapshot.traffic.available).toBe(false);
    expect(Object.values(snapshot.traffic.availability)).toEqual(
      expect.arrayContaining(["failed"]),
    );
    expect(
      Object.values(snapshot.traffic.availability).every((state) => state === "failed"),
    ).toBe(true);
    expect(snapshot.traffic.reporting.reportingStores).toBe(0);
    expect(snapshot.resources?.traffic).toEqual({
      state: "failed",
      dataAsOf: null,
    });
    expect(snapshot.warnings).toEqual([
      expect.objectContaining({ resource: "traffic" }),
    ]);
  });
});
