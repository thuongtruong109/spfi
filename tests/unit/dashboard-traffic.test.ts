import { describe, expect, it } from "vitest";
import {
  aggregateDashboardTraffic,
  cloneDashboardTraffic,
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
    expect(aggregate.last30Days.sessions).toBe(30);
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
    expect(aggregate.sources[0]?.sessions).toBe(10);
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
});
