import { describe, expect, it } from "vitest";
import {
  buildTrafficInsightQueryVariables,
  buildTrafficQueryVariables,
  parseShopifyTrafficResponse,
} from "~~/server/utils/shopify-traffic";

const columns = [{ name: "sessions", dataType: "INTEGER", displayName: "Sessions" }];

function result(rows: Array<Record<string, unknown>>) {
  return {
    tableData: { columns, rows },
    parseErrors: [],
  };
}

describe("Shopify traffic analytics", () => {
  it("builds bounded human-traffic queries", () => {
    const queries = buildTrafficQueryVariables();

    expect(queries.today).toContain("DURING today");
    expect(queries.last7Days).toContain("SINCE -6d UNTIL now");
    expect(queries.last30Days).toContain("SINCE -29d UNTIL now");
    expect(queries.hourly).toContain("TIMESERIES hour");
    expect(queries.daily).toContain("TIMESERIES day");
    expect(queries.today).toContain("sessions_with_cart_additions");
    expect(queries.today).toContain("sessions_that_reached_checkout");
    expect(
      Object.values(queries).every((query) =>
        query.includes("human_or_bot_session = 'human'"),
      ),
    ).toBe(true);

    const insights = buildTrafficInsightQueryVariables();
    expect(insights.trafficTypes).toContain("GROUP BY traffic_type");
    expect(insights.platforms).toContain("GROUP BY referring_platform");
    expect(insights.landingPages).toContain("GROUP BY landing_page_path");
    expect(insights.campaigns).toContain("GROUP BY utm_campaign");
    expect(insights.aiReferrals).toContain("GROUP BY agentic_referring_channel");
    expect(
      Object.values(insights).every((query) =>
        query.includes("human_or_bot_session = 'human'"),
      ),
    ).toBe(true);
  });

  it("maps ShopifyQL table rows and derives rates safely", () => {
    const traffic = parseShopifyTrafficResponse({
      today: result([
        {
          sessions: "10",
          online_store_visitors: "8",
          pageviews: "25",
          bounces: "4",
          sessions_with_cart_additions: "5",
          sessions_that_reached_checkout: "3",
          sessions_that_completed_checkout: "2",
          average_session_duration: "75.5",
        },
      ]),
      last7Days: result([{ sessions: 70, online_store_visitors: 50 }]),
      last30Days: result([{ sessions: 300, online_store_visitors: 180 }]),
      hourly: result([
        {
          hour: "2026-09-16T10:00:00Z",
          sessions: "3",
          online_store_visitors: "2",
          pageviews: "5",
        },
      ]),
      daily: result([
        {
          day: "2026-09-16",
          sessions: "10",
          online_store_visitors: "8",
          pageviews: "25",
        },
      ]),
      sources: result([
        { referrer_source: "Search", sessions: "7", online_store_visitors: "6" },
        { referrer_source: null, sessions: "3", online_store_visitors: "2" },
      ]),
      countries: result([
        { session_country: "Vietnam", sessions: "10", online_store_visitors: "8" },
      ]),
      devices: result([
        { session_device_type: "Mobile", sessions: "9", online_store_visitors: "7" },
      ]),
      trafficTypes: result([
        { traffic_type: "Organic", sessions: "6", online_store_visitors: "5" },
      ]),
      platforms: result([
        { referring_platform: "Google", sessions: "6", online_store_visitors: "5" },
      ]),
      browsers: result([
        {
          session_device_browser: "Chrome",
          sessions: "7",
          online_store_visitors: "6",
        },
      ]),
      landingPages: result([{ landing_page_path: "/products/tee", sessions: "4" }]),
      campaigns: result([
        { utm_campaign: "spring", sessions: "3" },
        { utm_campaign: null, sessions: "7" },
      ]),
      aiReferrals: {
        tableData: null,
        parseErrors: ["Dimension unavailable on this API version"],
      },
    });

    expect(traffic.available).toBe(true);
    expect(traffic.today).toMatchObject({
      sessions: 10,
      visitors: 8,
      pageviews: 25,
      pageviewsPerSession: 2.5,
      bounceRate: 0.4,
      cartAdditions: 5,
      reachedCheckouts: 3,
      conversionRate: 0.2,
      averageSessionDuration: 75.5,
    });
    expect(traffic.hourly[0]).toMatchObject({ sessions: 3, visitors: 2 });
    expect(traffic.sources[1]?.label).toBe("Direct / unknown");
    expect(traffic.trafficTypes[0]?.label).toBe("Organic");
    expect(traffic.landingPages[0]?.label).toBe("/products/tee");
    expect(traffic.campaigns).toHaveLength(1);
    expect(traffic.aiReferrals).toEqual([]);
  });

  it("surfaces ShopifyQL parse errors instead of treating them as empty data", () => {
    expect(() =>
      parseShopifyTrafficResponse({
        today: { tableData: null, parseErrors: ["Column not found"] },
        last7Days: result([]),
        last30Days: result([]),
        hourly: result([]),
        daily: result([]),
        sources: result([]),
        countries: result([]),
        devices: result([]),
      }),
    ).toThrow(/Column not found/);
  });
});
