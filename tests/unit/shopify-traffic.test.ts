import { describe, expect, it } from "vitest";
import {
  DASHBOARD_TRAFFIC_QUERY,
  TRAFFIC_DIMENSION_QUERY,
  buildTrafficDimensionQueryVariables,
  buildTrafficQueryVariables,
  isDashboardTrafficDimensionKey,
  parseShopifyTrafficDimensionResponse,
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
  it("builds bounded human-traffic overview queries", () => {
    const queries = buildTrafficQueryVariables();

    expect(queries.today).toContain("DURING today");
    expect(queries.last24Hours).toContain("SINCE -24h UNTIL now");
    expect(queries.last7Days).toContain("SINCE -6d UNTIL now");
    expect(queries.last30Days).toContain("SINCE -29d UNTIL now");
    expect(queries.hourly).toContain("TIMESERIES hour");
    expect(queries.daily).toContain("TIMESERIES day");
    expect(queries.today).toContain("sessions_with_cart_additions");
    expect(queries.sources24Hours).toContain("SINCE -24h UNTIL now");
    expect(queries.countries7Days).toContain("SINCE -6d UNTIL now");
    expect(
      Object.values(queries).every((query) =>
        query.includes("human_or_bot_session = 'human'"),
      ),
    ).toBe(true);
    expect(DASHBOARD_TRAFFIC_QUERY).not.toContain("$dimension");
  });

  it("builds one whitelisted dimension query with totals and an overflow row", () => {
    const source = buildTrafficDimensionQueryVariables("30d", "source").dimension;
    const browser = buildTrafficDimensionQueryVariables(
      "7d",
      "browserVersion",
    ).dimension;

    expect(source).toContain("GROUP BY referrer_source WITH TOTALS");
    expect(source).not.toContain("session_country");
    expect(source).toContain("sessions_with_cart_additions");
    expect(source).toContain("ORDER BY sessions DESC, referrer_source ASC");
    expect(source).toContain("LIMIT 251");
    expect(source).toContain("SINCE -29d UNTIL now");
    expect(source).toContain("human_or_bot_session = 'human'");
    expect(browser).toContain("GROUP BY session_device_browser_version WITH TOTALS");
    expect(browser).toContain("SINCE -6d UNTIL now");
    expect(TRAFFIC_DIMENSION_QUERY).toContain("$dimension");
    expect(TRAFFIC_DIMENSION_QUERY).not.toContain("$daily");
    expect(isDashboardTrafficDimensionKey("campaign")).toBe(true);
    expect(isDashboardTrafficDimensionKey("source, session_country")).toBe(false);
  });

  it("maps ShopifyQL overview rows and derives rates safely", () => {
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
      last24Hours: result([{ sessions: 12, online_store_visitors: 9, pageviews: 30 }]),
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
      sources24Hours: result([
        { referrer_source: "Direct", sessions: "8", online_store_visitors: "7" },
      ]),
      sources7Days: result([
        { referrer_source: "Email", sessions: "20", online_store_visitors: "16" },
      ]),
      countries: result([
        { session_country: "Vietnam", sessions: "10", online_store_visitors: "8" },
      ]),
      countries24Hours: result([
        { session_country: "Vietnam", sessions: "12", online_store_visitors: "9" },
      ]),
      countries7Days: result([
        { session_country: "Vietnam", sessions: "70", online_store_visitors: "50" },
      ]),
      devices: result([
        { session_device_type: "Mobile", sessions: "9", online_store_visitors: "7" },
      ]),
      devices24Hours: result([
        { session_device_type: "Mobile", sessions: "11", online_store_visitors: "8" },
      ]),
      devices7Days: result([
        { session_device_type: "Mobile", sessions: "60", online_store_visitors: "45" },
      ]),
      trafficTypes: result([
        { traffic_type: "Organic", sessions: "6", online_store_visitors: "5" },
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
      conversionRate: 0.2,
      averageSessionDuration: 75.5,
    });
    expect(traffic.hourly[0]).toMatchObject({ sessions: 3, visitors: 2 });
    expect(traffic.last24Hours.sessions).toBe(12);
    expect(traffic.rangeData["24h"].sources[0]?.label).toBe("Direct");
    expect(traffic.rangeData["30d"].metrics.sessions).toBe(300);
    expect(traffic.rangeData["30d"].dimensions).toEqual({});
    expect(traffic.sources[1]?.label).toBe("Direct / unknown");
    expect(traffic.trafficTypes[0]?.label).toBe("Organic");
    expect(traffic.campaigns).toHaveLength(1);
    expect(traffic.aiReferrals).toEqual([]);
  });

  it("returns exactly 250 dimension rows and detects only a real overflow row", () => {
    const makeRows = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        referrer_source: `Source ${index}`,
        sessions: count - index,
        sessions__totals: 40_000,
        online_store_visitors: count - index - 1,
        pageviews: (count - index) * 2,
        bounces: 1,
        sessions_that_completed_checkout: 1,
        average_session_duration: 60,
      }));

    const exact = parseShopifyTrafficDimensionResponse(
      { dimension: result(makeRows(250)) },
      "30d",
      "source",
    );
    const truncated = parseShopifyTrafficDimensionResponse(
      { dimension: result(makeRows(251)) },
      "30d",
      "source",
    );

    expect(exact.rows).toHaveLength(250);
    expect(exact.hasMore).toBe(false);
    expect(truncated.rows).toHaveLength(250);
    expect(truncated.hasMore).toBe(true);
    expect(truncated.totalSessions).toBe(40_000);
    expect(truncated.rows[0]).toMatchObject({
      label: "Source 0",
      sessions: 251,
      pageviewsPerSession: 2,
      bounceRate: 1 / 251,
      conversionRate: 1 / 251,
    });
  });

  it("keeps valid overview data when individual ShopifyQL aliases fail", () => {
    const traffic = parseShopifyTrafficResponse({
      today: result([{ sessions: "9", online_store_visitors: "7" }]),
      last24Hours: null,
      last7Days: result([{ sessions: "40" }]),
      last30Days: result([{ sessions: "120" }]),
      hourly: { tableData: null, parseErrors: ["Timeseries unavailable"] },
      daily: null,
      sources: { tableData: null, parseErrors: ["Column not found"] },
      countries: result([]),
      devices: result([]),
    });

    expect(traffic.available).toBe(true);
    expect(traffic.today.sessions).toBe(9);
    expect(traffic.last24Hours.sessions).toBe(9);
    expect(traffic.last7Days.sessions).toBe(40);
    expect(traffic.hourly).toEqual([]);
    expect(traffic.sources).toEqual([]);
  });

  it("marks traffic unavailable only when every summary alias is unusable", () => {
    const traffic = parseShopifyTrafficResponse({
      today: { tableData: null, parseErrors: ["Column not found"] },
      last24Hours: null,
      last7Days: undefined,
      last30Days: { tableData: null, parseErrors: ["Access denied"] },
    });

    expect(traffic.available).toBe(false);
    expect(traffic.availableStores).toBe(0);
  });

  it("surfaces dimension parse errors and missing totals", () => {
    expect(() =>
      parseShopifyTrafficDimensionResponse(
        {
          dimension: {
            tableData: null,
            parseErrors: ["Response is too large"],
          },
        },
        "24h",
        "country",
      ),
    ).toThrow(/Response is too large/);

    expect(() =>
      parseShopifyTrafficDimensionResponse(
        { dimension: result([{ session_country: "Vietnam", sessions: 2 }]) },
        "24h",
        "country",
      ),
    ).toThrow(/sessions__totals/);
  });
});
