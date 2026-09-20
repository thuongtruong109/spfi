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
});
