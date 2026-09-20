import { describe, expect, it } from "vitest";
import {
  createTrafficMetrics,
  emptyDashboardTraffic,
} from "~~/utils/dashboard-traffic";
import {
  buildTrafficExportPayload,
  buildTrafficHtmlReport,
  type TrafficExportInput,
} from "~~/utils/traffic-export";

function input(): TrafficExportInput {
  const data = emptyDashboardTraffic().rangeData["7d"];
  data.metrics = createTrafficMetrics({ sessions: 42 });
  data.sources = [{ label: "Search & Social", sessions: 30, visitors: 24 }];
  data.dimensions.source = {
    rows: [
      {
        label: "Search & Social",
        sessions: 30,
        visitors: 24,
        pageviews: 60,
        pageviewsPerSession: 2,
        bounces: 6,
        cartAdditions: 5,
        reachedCheckouts: 4,
        completedCheckouts: 3,
        averageSessionDuration: 70,
        bounceRate: 0.2,
        conversionRate: 0.1,
      },
    ],
    totalSessions: 42,
    hasMore: true,
  };
  return {
    data,
    points: [{ period: "2026-09-19", sessions: 42, visitors: 30, pageviews: 90 }],
    rangeLabel: "Last 7 days",
    exportedAt: new Date("2026-09-19T10:00:00.000Z"),
    labels: {
      title: "Traffic report",
      range: "Range",
      exportedAt: "Exported",
      sessions: "Sessions",
      visitors: "Visitors",
      pageviews: "Pageviews",
      bounceRate: "Bounce rate",
      conversionRate: "Conversion rate",
      averageDuration: "Average duration",
      trend: "Trend",
      sources: "Sources",
      countries: "Countries",
      devices: "Devices",
      details: "Details",
      dimension: "Dimension",
    },
  };
}

describe("traffic export", () => {
  it("builds a complete range-scoped JSON payload", () => {
    const payload = buildTrafficExportPayload(input());
    expect(payload.range).toBe("Last 7 days");
    expect(payload.metrics?.sessions).toBe(42);
    expect(payload.availability.metrics).toBe("unknown");
    expect(payload.breakdowns.sources?.[0]?.label).toBe("Search & Social");
    expect(payload.dimensions.source?.totalSessions).toBe(42);
    expect(payload.dimensions.source?.hasMore).toBe(true);
    expect(payload.trend).toHaveLength(1);
  });

  it("escapes report values in standalone HTML", () => {
    const html = buildTrafficHtmlReport(input());
    expect(html).toContain("Traffic report");
    expect(html).toContain("Search &amp; Social");
    expect(html).not.toContain("Search & Social</td>");
  });

  it("preserves unavailable blocks as null instead of exporting zeros", () => {
    const unavailable = input();
    unavailable.data.metrics = null;
    unavailable.data.sources = null;
    unavailable.points = null;
    unavailable.data.availability.metrics = "failed";
    unavailable.data.availability.trend = "failed";
    unavailable.data.availability.sources = "failed";

    const payload = buildTrafficExportPayload(unavailable);
    const html = buildTrafficHtmlReport(unavailable);

    expect(payload.metrics).toBeNull();
    expect(payload.breakdowns.sources).toBeNull();
    expect(payload.trend).toBeNull();
    expect(html).toContain("—");
  });
});
