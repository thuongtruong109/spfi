import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTrafficStore } from "~/stores/traffic";
import type {
  DashboardTrafficDetailRow,
  DashboardTrafficSummary,
} from "~~/types/dashboard";
import {
  createTrafficMetrics,
  emptyDashboardTraffic,
} from "~~/utils/dashboard-traffic";

function trafficFixture(sessions: number): DashboardTrafficSummary {
  return {
    ...emptyDashboardTraffic(),
    available: true,
    availableStores: 1,
    today: createTrafficMetrics({ sessions, visitors: sessions - 1 }),
    last7Days: createTrafficMetrics({ sessions: sessions * 7 }),
    last30Days: createTrafficMetrics({ sessions: sessions * 30 }),
    hourly: [
      {
        period: "2026-09-16T10:00:00Z",
        sessions,
        visitors: sessions - 1,
        pageviews: sessions * 2,
      },
    ],
  };
}

describe("traffic store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps Shopify Analytics traffic isolated per store", async () => {
    const request = vi.fn((_url: string, options: { body: { storeId: string } }) =>
      Promise.resolve(
        options.body.storeId === "shop-a" ? trafficFixture(12) : trafficFixture(24),
      ),
    );
    vi.stubGlobal("$fetch", request);
    const store = useTrafficStore();

    await store.fetchTraffic("shop-a", "token-a");
    expect(store.traffic.today.sessions).toBe(12);

    expect(store.hydrate("shop-b")).toBe(false);
    expect(store.traffic.available).toBe(false);
    await store.fetchTraffic("shop-b", "token-b");
    expect(store.traffic.today.sessions).toBe(24);

    expect(store.hydrate("shop-a")).toBe(true);
    expect(store.traffic.today.sessions).toBe(12);
    await store.fetchTraffic("shop-a", "token-a");
    expect(request).toHaveBeenCalledTimes(2);

    await store.fetchTraffic("shop-a", "token-a", true);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("loads range details independently without invalidating the overview", async () => {
    const detail = { source: "Email", sessions: 7 } as DashboardTrafficDetailRow;
    const request = vi.fn((url: string) => {
      if (url === "/api/traffic/details") {
        return Promise.resolve({
          range: "7d",
          details: [detail],
          detailLimitReached: false,
        });
      }
      return Promise.resolve(trafficFixture(12));
    });
    vi.stubGlobal("$fetch", request);
    const store = useTrafficStore();

    expect(await store.fetchTraffic("shop-a", "token-a")).toBe(true);
    expect(await store.fetchTrafficRange("shop-a", "token-a", "7d")).toBe(true);

    expect(store.traffic.available).toBe(true);
    expect(store.traffic.rangeData["7d"].details[0]?.source).toBe("Email");
    expect(store.loadedInsightRanges).toContain("7d");
    expect(store.error).toBeNull();
  });

  it("keeps overview data available when a detail request fails", async () => {
    const request = vi.fn((url: string) =>
      url === "/api/traffic/details"
        ? Promise.reject(new Error("Detail query exceeded its response budget."))
        : Promise.resolve(trafficFixture(12)),
    );
    vi.stubGlobal("$fetch", request);
    const store = useTrafficStore();

    expect(await store.fetchTraffic("shop-a", "token-a")).toBe(true);
    expect(await store.fetchTrafficRange("shop-a", "token-a", "24h")).toBe(false);

    expect(store.traffic.available).toBe(true);
    expect(store.error).toBeNull();
    expect(store.insightError).toContain("Detail query exceeded");
  });
});
