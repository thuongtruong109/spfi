import type { H3Event } from "h3";
import type {
  DashboardTrafficBreakdown,
  DashboardTrafficMetrics,
  DashboardTrafficPoint,
  DashboardTrafficSummary,
} from "~~/types/dashboard";
import { createTrafficMetrics } from "~~/utils/dashboard-traffic";
import { createApiErrorFromMessage } from "./callShopifyApi";
import { callShopifyGraphql } from "./callShopifyGraphql";

interface ShopifyqlColumn {
  name?: string;
  dataType?: string;
  displayName?: string;
}

interface ShopifyqlResult {
  tableData?: {
    columns?: ShopifyqlColumn[];
    rows?: Array<Record<string, unknown>>;
  } | null;
  parseErrors?: string[];
}

interface TrafficQueryResponse {
  today: ShopifyqlResult;
  last7Days: ShopifyqlResult;
  last30Days: ShopifyqlResult;
  hourly: ShopifyqlResult;
  daily: ShopifyqlResult;
  sources: ShopifyqlResult;
  countries: ShopifyqlResult;
  devices: ShopifyqlResult;
}

type TrafficQueryVariables = Record<
  | "today"
  | "last7Days"
  | "last30Days"
  | "hourly"
  | "daily"
  | "sources"
  | "countries"
  | "devices",
  string
>;

const SHOPIFYQL_RESULT_FIELDS = `
  tableData {
    columns {
      name
      dataType
      displayName
    }
    rows
  }
  parseErrors
`;

export const DASHBOARD_TRAFFIC_QUERY = `#graphql
  query DashboardTraffic(
    $today: String!
    $last7Days: String!
    $last30Days: String!
    $hourly: String!
    $daily: String!
    $sources: String!
    $countries: String!
    $devices: String!
  ) {
    today: shopifyqlQuery(query: $today) { ${SHOPIFYQL_RESULT_FIELDS} }
    last7Days: shopifyqlQuery(query: $last7Days) { ${SHOPIFYQL_RESULT_FIELDS} }
    last30Days: shopifyqlQuery(query: $last30Days) { ${SHOPIFYQL_RESULT_FIELDS} }
    hourly: shopifyqlQuery(query: $hourly) { ${SHOPIFYQL_RESULT_FIELDS} }
    daily: shopifyqlQuery(query: $daily) { ${SHOPIFYQL_RESULT_FIELDS} }
    sources: shopifyqlQuery(query: $sources) { ${SHOPIFYQL_RESULT_FIELDS} }
    countries: shopifyqlQuery(query: $countries) { ${SHOPIFYQL_RESULT_FIELDS} }
    devices: shopifyqlQuery(query: $devices) { ${SHOPIFYQL_RESULT_FIELDS} }
  }
`;

const HUMAN_FILTER = "WHERE human_or_bot_session = 'human'";
const SUMMARY_METRICS = [
  "sessions",
  "online_store_visitors",
  "pageviews",
  "bounces",
  "sessions_that_completed_checkout",
  "average_session_duration",
].join(", ");

export async function fetchShopifyTraffic(input: {
  event: H3Event;
  storeId: string;
  token: string;
}): Promise<DashboardTrafficSummary> {
  const response = await callShopifyGraphql<
    TrafficQueryResponse,
    TrafficQueryVariables
  >({
    ...input,
    query: DASHBOARD_TRAFFIC_QUERY,
    operationName: "DashboardTraffic",
    variables: buildTrafficQueryVariables(),
    timeoutMs: 30_000,
  });

  return parseShopifyTrafficResponse(response);
}

export function buildTrafficQueryVariables(): TrafficQueryVariables {
  return {
    today: summaryQuery("DURING today"),
    last7Days: summaryQuery("SINCE -6d UNTIL now"),
    last30Days: summaryQuery("SINCE -29d UNTIL now"),
    hourly: seriesQuery("hour", "SINCE -24h UNTIL now"),
    daily: seriesQuery("day", "SINCE -29d UNTIL now"),
    sources: breakdownQuery("referrer_source"),
    countries: breakdownQuery("session_country"),
    devices: breakdownQuery("session_device_type"),
  };
}

export function parseShopifyTrafficResponse(
  response: TrafficQueryResponse,
): DashboardTrafficSummary {
  return {
    available: true,
    availableStores: 1,
    today: parseMetrics(response.today, "today"),
    last7Days: parseMetrics(response.last7Days, "last 7 days"),
    last30Days: parseMetrics(response.last30Days, "last 30 days"),
    hourly: parsePoints(response.hourly, "hour", "hourly traffic"),
    daily: parsePoints(response.daily, "day", "daily traffic"),
    sources: parseBreakdown(response.sources, "referrer_source", "traffic sources"),
    countries: parseBreakdown(response.countries, "session_country", "countries"),
    devices: parseBreakdown(response.devices, "session_device_type", "devices"),
  };
}

function summaryQuery(period: string) {
  return `FROM sessions\nSHOW ${SUMMARY_METRICS}\n${HUMAN_FILTER}\n${period}`;
}

function seriesQuery(dimension: "hour" | "day", period: string) {
  return `FROM sessions\nSHOW sessions, online_store_visitors, pageviews\n${HUMAN_FILTER}\nTIMESERIES ${dimension}\n${period}\nORDER BY ${dimension} ASC`;
}

function breakdownQuery(dimension: string) {
  return `FROM sessions\nSHOW sessions, online_store_visitors\n${HUMAN_FILTER}\nGROUP BY ${dimension}\nSINCE -29d UNTIL now\nORDER BY sessions DESC\nLIMIT 8`;
}

function parseMetrics(result: ShopifyqlResult, label: string): DashboardTrafficMetrics {
  const row = readRows(result, label)[0] || {};
  return createTrafficMetrics({
    sessions: numberValue(row.sessions),
    visitors: numberValue(row.online_store_visitors),
    pageviews: numberValue(row.pageviews),
    bounces: numberValue(row.bounces),
    completedCheckouts: numberValue(row.sessions_that_completed_checkout),
    averageSessionDuration: numberValue(row.average_session_duration),
  });
}

function parsePoints(
  result: ShopifyqlResult,
  dimension: "hour" | "day",
  label: string,
): DashboardTrafficPoint[] {
  return readRows(result, label).flatMap((row) => {
    const period = stringValue(row[dimension]);
    return period
      ? [
          {
            period,
            sessions: numberValue(row.sessions),
            visitors: numberValue(row.online_store_visitors),
            pageviews: numberValue(row.pageviews),
          },
        ]
      : [];
  });
}

function parseBreakdown(
  result: ShopifyqlResult,
  dimension: string,
  label: string,
): DashboardTrafficBreakdown[] {
  return readRows(result, label).map((row) => ({
    label: stringValue(row[dimension]) || "Direct / unknown",
    sessions: numberValue(row.sessions),
    visitors: numberValue(row.online_store_visitors),
  }));
}

function readRows(result: ShopifyqlResult | undefined, label: string) {
  const parseErrors = Array.isArray(result?.parseErrors) ? result.parseErrors : [];
  if (parseErrors.length) {
    throw createApiErrorFromMessage(
      `ShopifyQL could not load ${label}: ${parseErrors.join("; ")}`,
      422,
      parseErrors,
    );
  }
  if (!result?.tableData || !Array.isArray(result.tableData.rows)) {
    throw createApiErrorFromMessage(
      `ShopifyQL did not return table data for ${label}.`,
      502,
    );
  }
  return result.tableData.rows;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
