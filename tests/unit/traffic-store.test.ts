import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTrafficStore } from "~/stores/traffic";
import type { DashboardTrafficSummary } from "~~/types/dashboard";
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
});
