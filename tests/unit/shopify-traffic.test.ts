import { describe, expect, it } from "vitest";
import {
  DASHBOARD_TRAFFIC_QUERY,
  TRAFFIC_DIMENSION_QUERY,
  TRAFFIC_RANGE_QUERY,
  buildTrafficDimensionQueryVariables,
  buildTrafficQueryVariables,
  buildTrafficRangeQueryVariables,
  isDashboardTrafficDimensionKey,
  parseShopifyTrafficDimensionResponse,
  parseShopifyTrafficRangeResponse,
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
    const queries = buildTrafficQueryVariables("Asia/Ho_Chi_Minh");

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
    expect(
      Object.values(queries).every((query) =>
        query.includes("TIMEZONE 'Asia/Ho_Chi_Minh'"),
      ),
    ).toBe(true);
    expect(Object.values(queries).every((query) => countWithClauses(query) === 1)).toBe(
      true,
    );
    expect(queries.today.indexOf("WHERE ")).toBeLessThan(
      queries.today.indexOf("WITH TIMEZONE"),
    );
    expect(DASHBOARD_TRAFFIC_QUERY).not.toContain("$dimension");
    expect(DASHBOARD_TRAFFIC_QUERY).not.toMatch(
      /\b(trafficTypes|platforms|browsers|landingPages|campaigns|aiReferrals)\s*:/,
    );
  });

  it("builds one whitelisted dimension query with totals and an overflow row", () => {
    const source = buildTrafficDimensionQueryVariables(
      "30d",
      "source",
      "America/New_York",
    ).dimension;
    const browser = buildTrafficDimensionQueryVariables(
      "7d",
      "browserVersion",
      "America/New_York",
    ).dimension;

    expect(source).toContain(
      "GROUP BY referrer_source WITH TOTALS, TIMEZONE 'America/New_York'",
    );
    expect(countWithClauses(source)).toBe(1);
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

  it("builds long-range queries with bounded adaptive time buckets", () => {
    const sixtyDays = buildTrafficRangeQueryVariables("60d", "Asia/Ho_Chi_Minh");
    const ninetyDays = buildTrafficRangeQueryVariables("90d", "Etc/UTC");
    const sixMonths = buildTrafficRangeQueryVariables("6m", "Etc/UTC");
    const oneYear = buildTrafficRangeQueryVariables("1y", "Etc/UTC");

    expect(sixtyDays.trend).toContain("TIMESERIES day");
    expect(sixtyDays.trend).toContain("SINCE -59d UNTIL now");
    expect(ninetyDays.trend).toContain("TIMESERIES week");
    expect(ninetyDays.metrics).toContain("SINCE -89d UNTIL now");
    expect(sixMonths.trend).toContain("TIMESERIES week");
    expect(sixMonths.sources).toContain("SINCE -6m UNTIL now");
    expect(oneYear.trend).toContain("TIMESERIES month");
    expect(oneYear.devices).toContain("SINCE -1y UNTIL now");
    expect(
      [sixtyDays, ninetyDays, sixMonths, oneYear].every((queries) =>
        Object.values(queries).every((query) =>
          query.includes("human_or_bot_session = 'human'"),
        ),
      ),
    ).toBe(true);
    expect(TRAFFIC_RANGE_QUERY).toContain("$trend");
  });

  it("maps a requested long range without mixing overview data", () => {
    const response = parseShopifyTrafficRangeResponse(
      {
        metrics: result([{ sessions: 900, online_store_visitors: 600 }]),
        trend: result([
          {
            week: "2026-09-14",
            sessions: 80,
            online_store_visitors: 52,
            pageviews: 140,
          },
        ]),
        sources: result([
          { referrer_source: "Search", sessions: 500, online_store_visitors: 350 },
        ]),
        countries: result([]),
        devices: result([]),
      },
      "90d",
      "Asia/Ho_Chi_Minh",
      "2026-09-21T00:00:00.000Z",
    );

    expect(response.range).toBe("90d");
    expect(response.timeZone).toBe("Asia/Ho_Chi_Minh");
    expect(response.data.metrics?.sessions).toBe(900);
    expect(response.data.trend?.[0]).toMatchObject({
      period: "2026-09-14",
      sessions: 80,
      visitors: 52,
    });
    expect(response.data.sources?.[0]?.label).toBe("Search");
    expect(response.data.availability).toEqual({
      metrics: "available",
      trend: "available",
      sources: "available",
      countries: "available",
      devices: "available",
    });
  });

  it("rejects an invalid timezone before interpolating ShopifyQL", () => {
    expect(() => buildTrafficQueryVariables("Etc/UTC' LIMIT 1")).toThrow(
      /valid IANA timezone/,
    );
  });

  it("maps ShopifyQL overview rows and derives rates safely", () => {
    const traffic = parseShopifyTrafficResponse(
      {
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
        last24Hours: result([
          { sessions: 12, online_store_visitors: 9, pageviews: 30 },
        ]),
        last7Days: result([{ sessions: 70, online_store_visitors: 50 }]),
        last30Days: result([{ sessions: 300, online_store_visitors: 180 }]),
        hourly: result([
          {
            hour: "2026-09-16T10",
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
          {
            session_device_type: "Mobile",
            sessions: "60",
            online_store_visitors: "45",
          },
        ]),
      },
      "Etc/UTC",
      "2026-09-20T09:00:00.000Z",
    );

    expect(traffic.available).toBe(true);
    expect(traffic.timeZone).toBe("Etc/UTC");
    expect(traffic.timeZoneMode).toBe("store");
    expect(traffic.reporting).toMatchObject({
      totalStores: 1,
      reportingStores: 1,
      lastSuccessfulAt: "2026-09-20T09:00:00.000Z",
    });
    expect(traffic.reporting.coverage["24h"].sources).toEqual({
      reportingStores: 1,
      totalStores: 1,
    });
    expect(traffic.today).toMatchObject({
      sessions: 10,
      visitors: 8,
      pageviews: 25,
      pageviewsPerSession: 2.5,
      bounceRate: 0.4,
      conversionRate: 0.2,
      averageSessionDuration: 75.5,
    });
    expect(traffic.hourly?.[0]).toMatchObject({
      period: "2026-09-16T10",
      sessions: 3,
      visitors: 2,
    });
    expect(traffic.last24Hours?.sessions).toBe(12);
    expect(traffic.rangeData["24h"].sources?.[0]?.label).toBe("Direct");
    expect(traffic.rangeData["30d"].metrics?.sessions).toBe(300);
    expect(traffic.rangeData["30d"].dimensions).toEqual({});
    expect(traffic.availability.daily).toBe("available");
    expect(traffic.rangeData["7d"].availability.sources).toBe("available");
    expect(traffic.sources?.[1]?.label).toBe("Direct / unknown");
    expect(traffic).toMatchObject({
      generatedAt: "2026-09-20T09:00:00.000Z",
      cacheAge: 0,
      isStale: false,
    });
    expect(traffic).not.toHaveProperty("trafficTypes");
    expect(traffic).not.toHaveProperty("campaigns");
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
    expect(traffic.today?.sessions).toBe(9);
    expect(traffic.last24Hours).toBeNull();
    expect(traffic.rangeData["24h"].metrics).toBeNull();
    expect(traffic.last7Days?.sessions).toBe(40);
    expect(traffic.hourly).toBeNull();
    expect(traffic.sources).toBeNull();
    expect(traffic.countries).toEqual([]);
    expect(traffic.availability.today).toBe("available");
    expect(traffic.availability.last24Hours).toBe("failed");
    expect(traffic.availability.hourly).toBe("failed");
    expect(traffic.availability.sources).toBe("failed");
    expect(traffic.availability.countries).toBe("available");
  });

  it("preserves GraphQL field failures as alias availability", () => {
    const traffic = parseShopifyTrafficResponse({
      data: {
        today: result([{ sessions: 9 }]),
        sources7Days: null,
      },
      errors: [
        {
          message: "The query returned too much data.",
          path: ["sources7Days"],
          extensions: { code: "RESPONSE_TOO_LARGE" },
        },
      ],
      availability: {
        today: "available",
        sources7Days: "failed",
      },
    });

    expect(traffic.available).toBe(true);
    expect(traffic.today?.sessions).toBe(9);
    expect(traffic.rangeData["7d"].sources).toBeNull();
    expect(traffic.availability.today).toBe("available");
    expect(traffic.availability.sources7Days).toBe("failed");
    expect(traffic.rangeData["7d"].availability.sources).toBe("failed");
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

  it("distinguishes a valid empty alias from a failed query", () => {
    const traffic = parseShopifyTrafficResponse({
      today: { tableData: null, parseErrors: ["Column not found"] },
      last24Hours: result([]),
      daily: result([]),
    });

    expect(traffic.available).toBe(true);
    expect(traffic.availableStores).toBe(1);
    expect(traffic.daily).toEqual([]);
    expect(traffic.last24Hours?.sessions).toBe(0);
    expect(traffic.rangeData["24h"].metrics?.sessions).toBe(0);
    expect(traffic.availability.today).toBe("failed");
    expect(traffic.availability.last24Hours).toBe("available");
    expect(traffic.availability.daily).toBe("available");
  });

  it("never substitutes data from a different traffic range", () => {
    const traffic = parseShopifyTrafficResponse({
      today: result([{ sessions: 99 }]),
      last24Hours: null,
      sources: result([{ referrer_source: "Search", sessions: 30 }]),
      sources7Days: null,
    });

    expect(traffic.today?.sessions).toBe(99);
    expect(traffic.rangeData["24h"].metrics).toBeNull();
    expect(traffic.rangeData["7d"].sources).toBeNull();
    expect(traffic.rangeData["30d"].sources?.[0]).toMatchObject({
      label: "Search",
      sessions: 30,
    });
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

function countWithClauses(query: string) {
  return query.match(/\bWITH\b/g)?.length || 0;
}
