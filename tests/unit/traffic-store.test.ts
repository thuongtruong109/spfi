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

  it("loads one dimension independently without invalidating the overview", async () => {
    const row = {
      label: "Email",
      sessions: 7,
      visitors: 6,
      pageviews: 14,
      pageviewsPerSession: 2,
      bounces: 2,
      cartAdditions: 2,
      reachedCheckouts: 1,
      completedCheckouts: 1,
      averageSessionDuration: 60,
      bounceRate: 2 / 7,
      conversionRate: 1 / 7,
    };
    const request = vi.fn((url: string) => {
      if (url === "/api/traffic/details") {
        return Promise.resolve({
          range: "7d",
          dimension: "source",
          rows: [row],
          totalSessions: 7,
          hasMore: false,
        });
      }
      return Promise.resolve(trafficFixture(12));
    });
    vi.stubGlobal("$fetch", request);
    const store = useTrafficStore();

    expect(await store.fetchTraffic("shop-a", "token-a")).toBe(true);
    expect(await store.fetchTrafficDimension("shop-a", "token-a", "7d", "source")).toBe(
      true,
    );

    expect(store.traffic.available).toBe(true);
    expect(store.traffic.rangeData["7d"].dimensions.source?.rows[0]?.label).toBe(
      "Email",
    );
    expect(store.loadedInsightDimensions).toContain("7d:source");
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
    expect(
      await store.fetchTrafficDimension("shop-a", "token-a", "24h", "country"),
    ).toBe(false);

    expect(store.traffic.available).toBe(true);
    expect(store.error).toBeNull();
    expect(store.insightError).toContain("Detail query exceeded");
  });

  it("keeps concurrent lazy dimension requests independent", async () => {
    const request = vi.fn(
      (
        url: string,
        options?: {
          body: {
            range: "24h" | "7d" | "30d";
            dimension: "source" | "country";
          };
        },
      ) => {
        if (url !== "/api/traffic/details") {
          return Promise.resolve(trafficFixture(12));
        }
        return Promise.resolve({
          range: options?.body.range,
          dimension: options?.body.dimension,
          rows: [],
          totalSessions: 12,
          hasMore: false,
        });
      },
    );
    vi.stubGlobal("$fetch", request);
    const store = useTrafficStore();

    await store.fetchTraffic("shop-a", "token-a");
    const [sourceLoaded, countryLoaded] = await Promise.all([
      store.fetchTrafficDimension("shop-a", "token-a", "24h", "source"),
      store.fetchTrafficDimension("shop-a", "token-a", "24h", "country"),
    ]);

    expect(sourceLoaded).toBe(true);
    expect(countryLoaded).toBe(true);
    expect(store.loadedInsightDimensions).toEqual(
      expect.arrayContaining(["24h:source", "24h:country"]),
    );
    expect(store.traffic.rangeData["24h"].dimensions.source).toBeDefined();
    expect(store.traffic.rangeData["24h"].dimensions.country).toBeDefined();
  });
});
