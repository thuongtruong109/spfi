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
});
