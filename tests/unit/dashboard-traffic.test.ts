import { describe, expect, it } from "vitest";
import {
  aggregateDashboardTraffic,
  cloneDashboardTraffic,
  createDashboardTrafficAvailability,
  createSingleStoreTrafficReporting,
  createTrafficMetrics,
  emptyDashboardTraffic,
  isDashboardTrafficAvailable,
} from "~~/utils/dashboard-traffic";

describe("dashboard traffic availability", () => {
  it("recovers a legacy payload that contains metrics but has a stale flag", () => {
    const traffic = emptyDashboardTraffic();
    traffic.available = false;
    traffic.today = createTrafficMetrics({ sessions: 12, visitors: 9 });

    expect(isDashboardTrafficAvailable(traffic)).toBe(true);
    expect(cloneDashboardTraffic(traffic)).toMatchObject({
      available: true,
      availableStores: 1,
    });
  });

  it("keeps data-bearing stores in the dashboard aggregate", () => {
    const traffic = emptyDashboardTraffic();
    traffic.available = false;
    traffic.last30Days = createTrafficMetrics({ sessions: 30 });

    const aggregate = aggregateDashboardTraffic([traffic]);

    expect(aggregate.available).toBe(true);
    expect(aggregate.availableStores).toBe(1);
    expect(aggregate.last30Days?.sessions).toBe(30);
  });

  it("does not treat a genuinely empty fallback as available", () => {
    expect(isDashboardTrafficAvailable(emptyDashboardTraffic())).toBe(false);
  });

  it("marks aggregate aliases partial when only some stores returned them", () => {
    const complete = emptyDashboardTraffic();
    complete.available = true;
    complete.availableStores = 1;
    complete.availability.sources = "available";
    complete.rangeData["30d"].availability.sources = "available";
    complete.sources = [{ label: "Search", sessions: 10, visitors: 8 }];
    complete.rangeData["30d"].sources = complete.sources;

    const failed = emptyDashboardTraffic();
    failed.available = true;
    failed.availableStores = 1;
    failed.availability.sources = "failed";
    failed.rangeData["30d"].availability.sources = "failed";

    const aggregate = aggregateDashboardTraffic([complete, failed]);

    expect(aggregate.availability.sources).toBe("partial");
    expect(aggregate.rangeData["30d"].availability.sources).toBe("partial");
    expect(aggregate.sources?.[0]?.sessions).toBe(10);
  });

  it("keeps failures from stores with no usable traffic rows in aggregate availability", () => {
    const complete = emptyDashboardTraffic();
    complete.available = true;
    complete.availableStores = 1;
    complete.availability.last30Days = "available";
    complete.rangeData["30d"].availability.metrics = "available";

    const failed = emptyDashboardTraffic();
    failed.availability.last30Days = "failed";
    failed.rangeData["30d"].availability.metrics = "failed";

    const aggregate = aggregateDashboardTraffic([complete, failed]);

    expect(aggregate.availability.last30Days).toBe("partial");
    expect(aggregate.rangeData["30d"].availability.metrics).toBe("partial");
  });

  it("preserves failed aliases when every store query failed", () => {
    const failed = emptyDashboardTraffic();
    failed.availability.last24Hours = "failed";
    failed.rangeData["24h"].availability.metrics = "failed";

    const aggregate = aggregateDashboardTraffic([failed]);

    expect(aggregate.available).toBe(false);
    expect(aggregate.availability.last24Hours).toBe("failed");
    expect(aggregate.rangeData["24h"].availability.metrics).toBe("failed");
  });

  it("does not revive a failed 24-hour block from today's metrics", () => {
    const traffic = emptyDashboardTraffic();
    traffic.available = true;
    traffic.today = createTrafficMetrics({ sessions: 15 });
    traffic.availability.today = "available";
    traffic.availability.last24Hours = "failed";
    traffic.rangeData["24h"].availability.metrics = "failed";

    const cloned = cloneDashboardTraffic(traffic);
    const aggregate = aggregateDashboardTraffic([traffic]);

    expect(cloned.last24Hours).toBeNull();
    expect(cloned.rangeData["24h"].metrics).toBeNull();
    expect(aggregate.last24Hours).toBeNull();
    expect(aggregate.rangeData["24h"].metrics).toBeNull();
  });

  it("does not reuse a 30-day breakdown for a failed 7-day block", () => {
    const traffic = emptyDashboardTraffic();
    traffic.available = true;
    traffic.sources = [{ label: "Search", sessions: 30, visitors: 20 }];
    traffic.availability.sources = "available";
    traffic.availability.sources7Days = "failed";
    traffic.rangeData["30d"].sources = traffic.sources;
    traffic.rangeData["30d"].availability.sources = "available";
    traffic.rangeData["7d"].availability.sources = "failed";

    const aggregate = aggregateDashboardTraffic([traffic]);

    expect(aggregate.rangeData["30d"].sources?.[0]?.sessions).toBe(30);
    expect(aggregate.rangeData["7d"].sources).toBeNull();
  });

  it("marks cross-store traffic as local-clock data when store timezones differ", () => {
    const vietnam = emptyDashboardTraffic();
    vietnam.available = true;
    vietnam.availableStores = 1;
    vietnam.timeZone = "Asia/Ho_Chi_Minh";
    vietnam.timeZoneMode = "store";
    vietnam.today = createTrafficMetrics({ sessions: 10 });

    const newYork = emptyDashboardTraffic();
    newYork.available = true;
    newYork.availableStores = 1;
    newYork.timeZone = "America/New_York";
    newYork.timeZoneMode = "store";
    newYork.today = createTrafficMetrics({ sessions: 20 });

    const aggregate = aggregateDashboardTraffic([vietnam, newYork]);

    expect(aggregate.timeZone).toBeNull();
    expect(aggregate.timeZoneMode).toBe("per-store");
    expect(aggregate.today?.sessions).toBe(30);
  });

  it("tracks overall and per-block reporting coverage including failed stores", () => {
    const complete = reportingTraffic("2026-09-20T08:00:00.000Z");
    const partial = reportingTraffic("2026-09-20T09:00:00.000Z");
    partial.availability.sources7Days = "failed";
    partial.rangeData["7d"].availability.sources = "failed";
    partial.rangeData["7d"].sources = null;
    partial.reporting = createSingleStoreTrafficReporting(
      partial.rangeData,
      true,
      "2026-09-20T09:00:00.000Z",
    );

    const aggregate = aggregateDashboardTraffic([complete, partial], {
      stores: [
        { storeId: "complete", label: "Complete", traffic: complete },
        { storeId: "partial", label: "Partial", traffic: partial },
      ],
      failures: [
        {
          storeId: "failed",
          label: "Failed",
          reason: "request-failed",
          message: "Shopify throttled this request.",
        },
      ],
    });

    expect(aggregate.availableStores).toBe(2);
    expect(aggregate.reporting).toMatchObject({
      totalStores: 3,
      reportingStores: 2,
      lastSuccessfulAt: "2026-09-20T09:00:00.000Z",
    });
    expect(aggregate.reporting.coverage["7d"].metrics).toEqual({
      reportingStores: 2,
      totalStores: 3,
    });
    expect(aggregate.reporting.coverage["7d"].sources).toEqual({
      reportingStores: 1,
      totalStores: 3,
    });
    expect(aggregate.availability.sources7Days).toBe("partial");
    expect(
      aggregate.reporting.stores.map(({ storeId, status }) => ({
        storeId,
        status,
      })),
    ).toEqual([
      { storeId: "failed", status: "failed" },
      { storeId: "partial", status: "partial" },
      { storeId: "complete", status: "reporting" },
    ]);
  });

  it("uses the oldest source freshness for an aggregate", () => {
    const older = reportingTraffic("2026-09-20T08:00:00.000Z");
    older.generatedAt = "2026-09-20T08:00:00.000Z";
    older.cacheAge = 120;
    older.isStale = true;
    const newer = reportingTraffic("2026-09-20T09:00:00.000Z");
    newer.generatedAt = "2026-09-20T09:00:00.000Z";
    newer.cacheAge = 30;

    expect(aggregateDashboardTraffic([older, newer])).toMatchObject({
      generatedAt: "2026-09-20T08:00:00.000Z",
      cacheAge: 120,
      isStale: true,
    });
  });
});

function reportingTraffic(successfulAt: string) {
  const traffic = emptyDashboardTraffic();
  traffic.available = true;
  traffic.availableStores = 1;
  traffic.availability = createDashboardTrafficAvailability("available");
  traffic.today = createTrafficMetrics({ sessions: 1 });
  traffic.last24Hours = traffic.today;
  traffic.last7Days = traffic.today;
  traffic.last30Days = traffic.today;
  for (const range of ["24h", "7d", "30d"] as const) {
    traffic.rangeData[range].metrics = traffic.today;
    traffic.rangeData[range].sources = [];
    traffic.rangeData[range].countries = [];
    traffic.rangeData[range].devices = [];
    traffic.rangeData[range].availability = {
      metrics: "available",
      trend: "available",
      sources: "available",
      countries: "available",
      devices: "available",
    };
  }
  traffic.reporting = createSingleStoreTrafficReporting(
    traffic.rangeData,
    true,
    successfulAt,
  );
  return traffic;
}
