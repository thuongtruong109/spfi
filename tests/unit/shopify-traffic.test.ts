import { describe, expect, it } from "vitest";
import {
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
    expect(
      Object.values(queries).every((query) =>
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
    expect(traffic.sources[1]?.label).toBe("Direct / unknown");
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
