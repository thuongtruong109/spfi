import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTrafficStore } from "~/stores/traffic";
import type {
  DashboardTrafficSummary,
  DASHBOARD_TRAFFIC_RANGES,
} from "~~/types/dashboard";
import { DASHBOARD_TRAFFIC_DIMENSION_KEYS } from "~~/types/dashboard";
import {
  createTrafficMetrics,
  emptyDashboardTraffic,
} from "~~/utils/dashboard-traffic";

function trafficFixture(sessions: number): DashboardTrafficSummary {
  return {
    ...emptyDashboardTraffic(),
    available: true,
    availableStores: 1,
    timeZone: "Etc/UTC",
    timeZoneMode: "store",
    today: createTrafficMetrics({ sessions, visitors: sessions - 1 }),
    last7Days: createTrafficMetrics({ sessions: sessions * 7 }),
    last30Days: createTrafficMetrics({ sessions: sessions * 30 }),
    hourly: [
      {
        period: "2026-09-16T10",
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
    expect(request).toHaveBeenLastCalledWith(
      "/api/traffic",
      expect.objectContaining({
        body: expect.objectContaining({ refresh: true }),
        signal: expect.any(AbortSignal),
      }),
    );
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
    expect(request).toHaveBeenLastCalledWith(
      "/api/traffic/details",
      expect.objectContaining({
        body: expect.objectContaining({ timeZone: "Etc/UTC" }),
      }),
    );
  });

  it("deduplicates callers waiting for the same overview", async () => {
    let resolveOverview!: (value: DashboardTrafficSummary) => void;
    const request = vi.fn(
      () =>
        new Promise<DashboardTrafficSummary>((resolve) => {
          resolveOverview = resolve;
        }),
    );
    vi.stubGlobal("$fetch", request);
    const store = useTrafficStore();

    const first = store.fetchTraffic("shop-a", "token-a");
    const second = store.fetchTraffic("shop-a", "token-a");
    expect(request).toHaveBeenCalledOnce();

    resolveOverview(trafficFixture(12));
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
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

  it("deduplicates callers waiting for the same dimension", async () => {
    let resolveDetail!: (value: unknown) => void;
    const detail = new Promise((resolve) => {
      resolveDetail = resolve;
    });
    const request = vi.fn((url: string) =>
      url === "/api/traffic/details" ? detail : Promise.resolve(trafficFixture(12)),
    );
    vi.stubGlobal("$fetch", request);
    const store = useTrafficStore();

    await store.fetchTraffic("shop-a", "token-a");
    const first = store.fetchTrafficDimension("shop-a", "token-a", "7d", "source");
    const second = store.fetchTrafficDimension("shop-a", "token-a", "7d", "source");

    expect(
      request.mock.calls.filter(([url]) => url === "/api/traffic/details"),
    ).toHaveLength(1);
    resolveDetail({
      range: "7d",
      dimension: "source",
      rows: [],
      totalSessions: 0,
      hasMore: false,
      generatedAt: "2026-09-20T10:00:00.000Z",
      cacheAge: 0,
      isStale: false,
    });

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
  });

  it("loads every dimension for only the selected range sequentially", async () => {
    let activeDetails = 0;
    let maximumConcurrency = 0;
    const request = vi.fn(
      (
        url: string,
        options: {
          body: {
            range: (typeof DASHBOARD_TRAFFIC_RANGES)[number];
            dimension: (typeof DASHBOARD_TRAFFIC_DIMENSION_KEYS)[number];
          };
        },
      ) => {
        if (url !== "/api/traffic/details") {
          return Promise.resolve(trafficFixture(12));
        }

        activeDetails += 1;
        maximumConcurrency = Math.max(maximumConcurrency, activeDetails);
        return Promise.resolve({
          range: options.body.range,
          dimension: options.body.dimension,
          rows: [],
          totalSessions: 12,
          hasMore: false,
          generatedAt: "2026-09-20T10:00:00.000Z",
          cacheAge: 0,
          isStale: false,
        }).finally(() => {
          activeDetails -= 1;
        });
      },
    );
    vi.stubGlobal("$fetch", request);
    const store = useTrafficStore();

    await store.fetchTraffic("shop-a", "token-a");
    await expect(
      store.fetchTrafficRangeDimensions("shop-a", "token-a", "7d"),
    ).resolves.toBe(true);

    const detailCalls = request.mock.calls.filter(
      ([url]) => url === "/api/traffic/details",
    );
    expect(detailCalls).toHaveLength(DASHBOARD_TRAFFIC_DIMENSION_KEYS.length);
    expect(detailCalls.every(([, options]) => options.body.range === "7d")).toBe(true);
    expect(maximumConcurrency).toBe(1);
    expect(store.trafficInsightProgress["7d"].complete).toBe(true);
    expect(store.trafficInsightProgress["24h"].complete).toBe(false);
    expect(store.trafficInsightProgress["30d"].complete).toBe(false);
    expect(store.isLoadingAllInsights).toBe(false);
    expect(Object.keys(store.traffic.rangeData["7d"].dimensions)).toHaveLength(
      DASHBOARD_TRAFFIC_DIMENSION_KEYS.length,
    );
  });

  it("does not start a full batch when overview traffic is unavailable", async () => {
    const request = vi.fn(() => Promise.resolve(emptyDashboardTraffic()));
    vi.stubGlobal("$fetch", request);
    const store = useTrafficStore();

    await store.fetchTraffic("shop-a", "token-a");
    await expect(
      store.fetchTrafficRangeDimensions("shop-a", "token-a", "24h"),
    ).resolves.toBe(false);

    expect(request).toHaveBeenCalledOnce();
    expect(store.isLoadingAllInsights).toBe(false);
  });

  it("stops a full dimension batch when loading is cancelled", async () => {
    const detailSignals: AbortSignal[] = [];
    const request = vi.fn(
      (url: string, options: { signal?: AbortSignal } | undefined) => {
        if (url !== "/api/traffic/details") {
          return Promise.resolve(trafficFixture(12));
        }

        const signal = options?.signal as AbortSignal;
        detailSignals.push(signal);
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      },
    );
    vi.stubGlobal("$fetch", request);
    const store = useTrafficStore();

    await store.fetchTraffic("shop-a", "token-a");
    const fullLoad = store.fetchTrafficRangeDimensions("shop-a", "token-a", "24h");
    await Promise.resolve();

    expect(detailSignals).toHaveLength(1);
    expect(store.isLoadingAllInsights).toBe(true);
    store.cancelTrafficDimensionRequests();

    await expect(fullLoad).resolves.toBe(false);
    expect(detailSignals.every((signal) => signal.aborted)).toBe(true);
    expect(store.isLoadingAllInsights).toBe(false);
    expect(
      request.mock.calls.filter(([url]) => url === "/api/traffic/details"),
    ).toHaveLength(1);
  });

  it("keeps a visible error when one request in a full batch fails", async () => {
    let failed = false;
    const request = vi.fn(
      (
        url: string,
        options: {
          body: {
            range: (typeof DASHBOARD_TRAFFIC_RANGES)[number];
            dimension: (typeof DASHBOARD_TRAFFIC_DIMENSION_KEYS)[number];
          };
        },
      ) => {
        if (url !== "/api/traffic/details") {
          return Promise.resolve(trafficFixture(12));
        }
        if (!failed) {
          failed = true;
          return Promise.reject(new Error("ShopifyQL detail failed."));
        }
        return Promise.resolve({
          range: options.body.range,
          dimension: options.body.dimension,
          rows: [],
          totalSessions: 12,
          hasMore: false,
          generatedAt: "2026-09-20T10:00:00.000Z",
          cacheAge: 0,
          isStale: false,
        });
      },
    );
    vi.stubGlobal("$fetch", request);
    const store = useTrafficStore();

    await store.fetchTraffic("shop-a", "token-a");
    await expect(
      store.fetchTrafficRangeDimensions("shop-a", "token-a", "24h"),
    ).resolves.toBe(false);

    expect(store.trafficInsightProgress["24h"].complete).toBe(false);
    expect(store.insightError).toBeTruthy();
    expect(
      request.mock.calls.filter(([url]) => url === "/api/traffic/details"),
    ).toHaveLength(1);
  });

  it("aborts the old request when the active shop changes", async () => {
    let shopASignal!: AbortSignal;
    const request = vi.fn(
      (_url: string, options: { body: { storeId: string }; signal?: AbortSignal }) => {
        if (options.body.storeId === "shop-b") {
          return Promise.resolve(trafficFixture(24));
        }

        shopASignal = options.signal as AbortSignal;
        return new Promise<DashboardTrafficSummary>((_resolve, reject) => {
          shopASignal.addEventListener("abort", () => reject(shopASignal.reason), {
            once: true,
          });
        });
      },
    );
    vi.stubGlobal("$fetch", request);
    const store = useTrafficStore();

    const shopA = store.fetchTraffic("shop-a", "token-a");
    const shopB = store.fetchTraffic("shop-b", "token-b");

    expect(shopASignal.aborted).toBe(true);
    await expect(shopA).resolves.toBe(false);
    await expect(shopB).resolves.toBe(true);
    expect(store.error).toBeNull();
    expect(store.traffic.today?.sessions).toBe(24);
  });
});
