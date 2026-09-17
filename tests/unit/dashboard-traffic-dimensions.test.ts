import { describe, expect, it } from "vitest";
import type { DashboardTrafficDetailRow } from "../../types/dashboard";
import { aggregateTrafficDimension } from "../../utils/dashboard-traffic-dimensions";

const baseRow: DashboardTrafficDetailRow = {
  source: "Direct",
  referrerDomain: "—",
  referrerTerms: "—",
  country: "Vietnam",
  countryCode: "VN",
  region: "Ho Chi Minh",
  city: "Ho Chi Minh City",
  browser: "Chrome",
  browserVersion: "140",
  operatingSystem: "Windows",
  operatingSystemVersion: "11",
  deviceType: "Desktop",
  apiClient: "online_store",
  trafficType: "Direct",
  platform: "Unknown",
  channel: "Direct",
  medium: "None",
  landingPageType: "home",
  landingPagePath: "/",
  campaign: "—",
  campaignContent: "—",
  aiReferral: "—",
  sessions: 10,
  visitors: 8,
  pageviews: 20,
  pageviewsPerSession: 2,
  bounces: 2,
  cartAdditions: 3,
  reachedCheckouts: 2,
  completedCheckouts: 1,
  averageSessionDuration: 100,
  bounceRate: 0.2,
  conversionRate: 0.1,
};

describe("aggregateTrafficDimension", () => {
  it("regroups detailed combinations and recalculates weighted metrics", () => {
    const rows: DashboardTrafficDetailRow[] = [
      baseRow,
      {
        ...baseRow,
        country: "United States",
        sessions: 20,
        pageviews: 50,
        bounces: 8,
        cartAdditions: 6,
        reachedCheckouts: 5,
        completedCheckouts: 3,
        averageSessionDuration: 200,
      },
      {
        ...baseRow,
        source: "Facebook",
        sessions: 5,
        pageviews: 5,
        bounces: 4,
        completedCheckouts: 0,
      },
    ];

    const result = aggregateTrafficDimension(rows, "source");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      label: "Direct",
      sessions: 30,
      pageviews: 70,
      bounces: 10,
      cartAdditions: 9,
      reachedCheckouts: 7,
      completedCheckouts: 4,
    });
    expect(result[0]?.pageviewsPerSession).toBeCloseTo(70 / 30);
    expect(result[0]?.bounceRate).toBeCloseTo(10 / 30);
    expect(result[0]?.averageSessionDuration).toBeCloseTo(5000 / 30);
    expect(result[0]?.conversionRate).toBeCloseTo(4 / 30);
    expect(result[1]?.label).toBe("Facebook");
  });

  it("uses a visible fallback for empty dimension values", () => {
    const result = aggregateTrafficDimension(
      [{ ...baseRow, campaign: "" }],
      "campaign",
    );

    expect(result[0]?.label).toBe("—");
  });
});
