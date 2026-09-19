import type { H3Event } from "h3";
import type {
  DashboardTrafficBreakdown,
  DashboardTrafficDetailRangeResponse,
  DashboardTrafficDetailRow,
  DashboardTrafficMetrics,
  DashboardTrafficPoint,
  DashboardTrafficRange,
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

type OptionalShopifyqlResult = ShopifyqlResult | null | undefined;

interface TrafficQueryResponse {
  today?: OptionalShopifyqlResult;
  last24Hours?: OptionalShopifyqlResult;
  last7Days?: OptionalShopifyqlResult;
  last30Days?: OptionalShopifyqlResult;
  hourly?: OptionalShopifyqlResult;
  daily?: OptionalShopifyqlResult;
  sources?: OptionalShopifyqlResult;
  sources24Hours?: OptionalShopifyqlResult;
  sources7Days?: OptionalShopifyqlResult;
  countries?: OptionalShopifyqlResult;
  countries24Hours?: OptionalShopifyqlResult;
  countries7Days?: OptionalShopifyqlResult;
  devices?: OptionalShopifyqlResult;
  devices24Hours?: OptionalShopifyqlResult;
  devices7Days?: OptionalShopifyqlResult;
  trafficTypes?: OptionalShopifyqlResult;
  platforms?: OptionalShopifyqlResult;
  browsers?: OptionalShopifyqlResult;
  landingPages?: OptionalShopifyqlResult;
  campaigns?: OptionalShopifyqlResult;
  aiReferrals?: OptionalShopifyqlResult;
  details?: OptionalShopifyqlResult;
  details24Hours?: OptionalShopifyqlResult;
  details7Days?: OptionalShopifyqlResult;
}

type TrafficQueryVariables = Record<
  | "today"
  | "last24Hours"
  | "last7Days"
  | "last30Days"
  | "hourly"
  | "daily"
  | "sources"
  | "sources24Hours"
  | "sources7Days"
  | "countries"
  | "countries24Hours"
  | "countries7Days"
  | "devices24Hours"
  | "devices7Days"
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
    $last24Hours: String!
    $last7Days: String!
    $last30Days: String!
    $hourly: String!
    $daily: String!
    $sources: String!
    $sources24Hours: String!
    $sources7Days: String!
    $countries: String!
    $countries24Hours: String!
    $countries7Days: String!
    $devices: String!
    $devices24Hours: String!
    $devices7Days: String!
  ) {
    today: shopifyqlQuery(query: $today) { ${SHOPIFYQL_RESULT_FIELDS} }
    last24Hours: shopifyqlQuery(query: $last24Hours) { ${SHOPIFYQL_RESULT_FIELDS} }
    last7Days: shopifyqlQuery(query: $last7Days) { ${SHOPIFYQL_RESULT_FIELDS} }
    last30Days: shopifyqlQuery(query: $last30Days) { ${SHOPIFYQL_RESULT_FIELDS} }
    hourly: shopifyqlQuery(query: $hourly) { ${SHOPIFYQL_RESULT_FIELDS} }
    daily: shopifyqlQuery(query: $daily) { ${SHOPIFYQL_RESULT_FIELDS} }
    sources: shopifyqlQuery(query: $sources) { ${SHOPIFYQL_RESULT_FIELDS} }
    sources24Hours: shopifyqlQuery(query: $sources24Hours) { ${SHOPIFYQL_RESULT_FIELDS} }
    sources7Days: shopifyqlQuery(query: $sources7Days) { ${SHOPIFYQL_RESULT_FIELDS} }
    countries: shopifyqlQuery(query: $countries) { ${SHOPIFYQL_RESULT_FIELDS} }
    countries24Hours: shopifyqlQuery(query: $countries24Hours) { ${SHOPIFYQL_RESULT_FIELDS} }
    countries7Days: shopifyqlQuery(query: $countries7Days) { ${SHOPIFYQL_RESULT_FIELDS} }
    devices: shopifyqlQuery(query: $devices) { ${SHOPIFYQL_RESULT_FIELDS} }
    devices24Hours: shopifyqlQuery(query: $devices24Hours) { ${SHOPIFYQL_RESULT_FIELDS} }
    devices7Days: shopifyqlQuery(query: $devices7Days) { ${SHOPIFYQL_RESULT_FIELDS} }
  }
`;

export const TRAFFIC_DETAILS_QUERY = `#graphql
  query StoreTrafficDetails($details: String!) {
    details: shopifyqlQuery(query: $details) { ${SHOPIFYQL_RESULT_FIELDS} }
  }
`;

const DETAIL_ROW_LIMIT = 250;
const HUMAN_FILTER = "WHERE human_or_bot_session = 'human'";
const TRAFFIC_PERIODS: Record<DashboardTrafficRange, string> = {
  "24h": "SINCE -24h UNTIL now",
  "7d": "SINCE -6d UNTIL now",
  "30d": "SINCE -29d UNTIL now",
};
const SUMMARY_METRICS = [
  "sessions",
  "online_store_visitors",
  "pageviews",
  "bounces",
  "sessions_with_cart_additions",
  "sessions_that_reached_checkout",
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
    allowPartialData: true,
  });

  return parseShopifyTrafficResponse(response);
}

export async function fetchShopifyTrafficDetails(input: {
  event: H3Event;
  storeId: string;
  token: string;
  range: DashboardTrafficRange;
}): Promise<DashboardTrafficDetailRangeResponse> {
  const response = await callShopifyGraphql<
    { details?: OptionalShopifyqlResult },
    { details: string }
  >({
    ...input,
    query: TRAFFIC_DETAILS_QUERY,
    operationName: "StoreTrafficDetails",
    variables: buildTrafficDetailQueryVariables(input.range),
    timeoutMs: 30_000,
  });
  return parseShopifyTrafficDetailsResponse(response, input.range);
}

export function parseShopifyTrafficDetailsResponse(
  response: { details?: OptionalShopifyqlResult },
  range: DashboardTrafficRange,
): DashboardTrafficDetailRangeResponse {
  const details = parseTrafficDetails(response.details, `${range} traffic details`);
  return {
    range,
    details,
    detailLimitReached: details.length >= DETAIL_ROW_LIMIT,
  };
}

export function buildTrafficDetailQueryVariables(range: DashboardTrafficRange) {
  return {
    details: detailQuery(TRAFFIC_PERIODS[range]),
  };
}

export function buildTrafficQueryVariables(): TrafficQueryVariables {
  return {
    today: summaryQuery("DURING today"),
    last24Hours: summaryQuery(TRAFFIC_PERIODS["24h"]),
    last7Days: summaryQuery(TRAFFIC_PERIODS["7d"]),
    last30Days: summaryQuery(TRAFFIC_PERIODS["30d"]),
    hourly: seriesQuery("hour", TRAFFIC_PERIODS["24h"]),
    daily: seriesQuery("day", TRAFFIC_PERIODS["30d"]),
    sources: breakdownQuery("referrer_source", TRAFFIC_PERIODS["30d"]),
    sources24Hours: breakdownQuery("referrer_source", TRAFFIC_PERIODS["24h"]),
    sources7Days: breakdownQuery("referrer_source", TRAFFIC_PERIODS["7d"]),
    countries: breakdownQuery("session_country", TRAFFIC_PERIODS["30d"]),
    countries24Hours: breakdownQuery("session_country", TRAFFIC_PERIODS["24h"]),
    countries7Days: breakdownQuery("session_country", TRAFFIC_PERIODS["7d"]),
    devices: breakdownQuery("session_device_type", TRAFFIC_PERIODS["30d"]),
    devices24Hours: breakdownQuery("session_device_type", TRAFFIC_PERIODS["24h"]),
    devices7Days: breakdownQuery("session_device_type", TRAFFIC_PERIODS["7d"]),
  };
}

export function parseShopifyTrafficResponse(
  response: TrafficQueryResponse,
): DashboardTrafficSummary {
  const todayResult = parseOptionalMetrics(response.today);
  const last24HoursResult = parseOptionalMetrics(response.last24Hours);
  const last7DaysResult = parseOptionalMetrics(response.last7Days);
  const last30DaysResult = parseOptionalMetrics(response.last30Days);
  const emptyMetrics = createTrafficMetrics({});
  const today = todayResult || emptyMetrics;
  const last24Hours = last24HoursResult || todayResult || emptyMetrics;
  const last7Days = last7DaysResult || emptyMetrics;
  const last30Days = last30DaysResult || emptyMetrics;
  const details = parseTrafficDetails(response.details);
  const details24Hours = parseTrafficDetails(response.details24Hours);
  const details7Days = parseTrafficDetails(response.details7Days);
  const sources = parseOptionalBreakdown(
    response.sources,
    "referrer_source",
    false,
    "Direct / unknown",
  );
  const countries = parseOptionalBreakdown(
    response.countries,
    "session_country",
    false,
    "Direct / unknown",
  );
  const devices = parseOptionalBreakdown(
    response.devices,
    "session_device_type",
    false,
    "Direct / unknown",
  );
  const sources24Hours = parseOptionalRangeBreakdown(
    response.sources24Hours,
    "referrer_source",
    sources,
  );
  const sources7Days = parseOptionalRangeBreakdown(
    response.sources7Days,
    "referrer_source",
    sources,
  );
  const countries24Hours = parseOptionalRangeBreakdown(
    response.countries24Hours,
    "session_country",
    countries,
  );
  const countries7Days = parseOptionalRangeBreakdown(
    response.countries7Days,
    "session_country",
    countries,
  );
  const devices24Hours = parseOptionalRangeBreakdown(
    response.devices24Hours,
    "session_device_type",
    devices,
  );
  const devices7Days = parseOptionalRangeBreakdown(
    response.devices7Days,
    "session_device_type",
    devices,
  );
  return {
    available: Boolean(
      todayResult || last24HoursResult || last7DaysResult || last30DaysResult,
    ),
    availableStores:
      todayResult || last24HoursResult || last7DaysResult || last30DaysResult ? 1 : 0,
    today,
    last24Hours,
    last7Days,
    last30Days,
    hourly: parseOptionalPoints(response.hourly, "hour"),
    daily: parseOptionalPoints(response.daily, "day"),
    sources,
    countries,
    devices,
    trafficTypes: parseOptionalBreakdown(response.trafficTypes, "traffic_type"),
    platforms: parseOptionalBreakdown(response.platforms, "referring_platform"),
    browsers: parseOptionalBreakdown(response.browsers, "session_device_browser"),
    landingPages: parseOptionalBreakdown(
      response.landingPages,
      "landing_page_path",
      false,
    ),
    campaigns: parseOptionalBreakdown(response.campaigns, "utm_campaign", true),
    aiReferrals: parseOptionalBreakdown(
      response.aiReferrals,
      "agentic_referring_channel",
      true,
    ),
    details,
    detailLimitReached: details.length >= DETAIL_ROW_LIMIT,
    rangeData: {
      "24h": {
        metrics: last24Hours,
        sources: sources24Hours,
        countries: countries24Hours,
        devices: devices24Hours,
        details: details24Hours,
        detailLimitReached: details24Hours.length >= DETAIL_ROW_LIMIT,
      },
      "7d": {
        metrics: last7Days,
        sources: sources7Days,
        countries: countries7Days,
        devices: devices7Days,
        details: details7Days,
        detailLimitReached: details7Days.length >= DETAIL_ROW_LIMIT,
      },
      "30d": {
        metrics: last30Days,
        sources,
        countries,
        devices,
        details,
        detailLimitReached: details.length >= DETAIL_ROW_LIMIT,
      },
    },
  };
}

function summaryQuery(period: string) {
  return `FROM sessions\nSHOW ${SUMMARY_METRICS}\n${HUMAN_FILTER}\n${period}`;
}

function seriesQuery(dimension: "hour" | "day", period: string) {
  return `FROM sessions\nSHOW sessions, online_store_visitors, pageviews\n${HUMAN_FILTER}\nTIMESERIES ${dimension}\n${period}\nORDER BY ${dimension} ASC`;
}

function breakdownQuery(dimension: string, period = "SINCE -29d UNTIL now") {
  return `FROM sessions\nSHOW sessions, online_store_visitors\n${HUMAN_FILTER}\nGROUP BY ${dimension}\n${period}\nORDER BY sessions DESC\nLIMIT 8`;
}

function detailQuery(period: string) {
  const dimensions = [
    "referrer_source",
    "referrer_domain",
    "referrer_terms",
    "session_country",
    "session_country_code",
    "session_region",
    "session_city",
    "session_device_browser",
    "session_device_browser_version",
    "session_device_os",
    "session_device_os_version",
    "session_device_type",
    "session_api_client",
    "traffic_type",
    "referring_platform",
    "referring_channel",
    "referring_medium",
    "landing_page_type",
    "landing_page_path",
    "utm_campaign",
    "utm_content",
    "agentic_referring_channel",
  ];
  const metrics = [
    "sessions",
    "online_store_visitors",
    "pageviews",
    "bounces",
    "sessions_with_cart_additions",
    "sessions_that_reached_checkout",
    "sessions_that_completed_checkout",
    "average_session_duration",
  ];

  return `FROM sessions\nSHOW ${metrics.join(", ")}\n${HUMAN_FILTER}\nGROUP BY ${dimensions.join(", ")}\n${period}\nORDER BY sessions DESC\nLIMIT ${DETAIL_ROW_LIMIT}`;
}

function parseOptionalMetrics(
  result: OptionalShopifyqlResult,
): DashboardTrafficMetrics | null {
  const rows = readOptionalRows(result);
  if (!rows) return null;
  const row = rows[0] || {};
  return createTrafficMetrics({
    sessions: numberValue(row.sessions),
    visitors: numberValue(row.online_store_visitors),
    pageviews: numberValue(row.pageviews),
    bounces: numberValue(row.bounces),
    cartAdditions: numberValue(row.sessions_with_cart_additions),
    reachedCheckouts: numberValue(row.sessions_that_reached_checkout),
    completedCheckouts: numberValue(row.sessions_that_completed_checkout),
    averageSessionDuration: numberValue(row.average_session_duration),
  });
}

function parseOptionalPoints(
  result: OptionalShopifyqlResult,
  dimension: "hour" | "day",
): DashboardTrafficPoint[] {
  return (readOptionalRows(result) || []).flatMap((row) => {
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

function parseOptionalRangeBreakdown(
  result: OptionalShopifyqlResult,
  dimension: string,
  fallback: DashboardTrafficBreakdown[],
) {
  const rows = parseBreakdownIfAvailable(result, dimension, false, "Direct / unknown");
  return rows === null ? fallback.map((row) => ({ ...row })) : rows;
}

function parseOptionalBreakdown(
  result: OptionalShopifyqlResult,
  dimension: string,
  omitEmpty = false,
  emptyLabel = "Unknown / unattributed",
): DashboardTrafficBreakdown[] {
  return parseBreakdownIfAvailable(result, dimension, omitEmpty, emptyLabel) || [];
}

function parseBreakdownIfAvailable(
  result: OptionalShopifyqlResult,
  dimension: string,
  omitEmpty = false,
  emptyLabel = "Unknown / unattributed",
): DashboardTrafficBreakdown[] | null {
  const rows = readOptionalRows(result);
  if (!rows) return null;

  return rows.flatMap((row) => {
    const label = stringValue(row[dimension]);
    if (!label && omitEmpty) return [];
    return [
      {
        label: label || emptyLabel,
        sessions: numberValue(row.sessions),
        visitors: numberValue(row.online_store_visitors),
      },
    ];
  });
}

function readOptionalRows(
  result: OptionalShopifyqlResult,
): Array<Record<string, unknown>> | null {
  if (
    !result?.tableData ||
    !Array.isArray(result.tableData.rows) ||
    (result.parseErrors?.length || 0) > 0
  ) {
    return null;
  }
  return result.tableData.rows;
}

function parseTrafficDetails(
  result: OptionalShopifyqlResult,
  requiredLabel?: string,
): DashboardTrafficDetailRow[] {
  const rows = requiredLabel
    ? readRows(result, requiredLabel)
    : !result?.tableData ||
        !Array.isArray(result.tableData.rows) ||
        (result.parseErrors?.length || 0) > 0
      ? []
      : result.tableData.rows;

  return rows.map((row) => {
    const metrics = createTrafficMetrics({
      sessions: numberValue(row.sessions),
      visitors: numberValue(row.online_store_visitors),
      pageviews: numberValue(row.pageviews),
      bounces: numberValue(row.bounces),
      cartAdditions: numberValue(row.sessions_with_cart_additions),
      reachedCheckouts: numberValue(row.sessions_that_reached_checkout),
      completedCheckouts: numberValue(row.sessions_that_completed_checkout),
      averageSessionDuration: numberValue(row.average_session_duration),
    });

    return {
      source: detailValue(row.referrer_source),
      referrerDomain: detailValue(row.referrer_domain),
      referrerTerms: detailValue(row.referrer_terms),
      country: detailValue(row.session_country),
      countryCode: detailValue(row.session_country_code),
      region: detailValue(row.session_region),
      city: detailValue(row.session_city),
      browser: detailValue(row.session_device_browser),
      browserVersion: detailValue(row.session_device_browser_version),
      operatingSystem: detailValue(row.session_device_os),
      operatingSystemVersion: detailValue(row.session_device_os_version),
      deviceType: detailValue(row.session_device_type),
      apiClient: detailValue(row.session_api_client),
      trafficType: detailValue(row.traffic_type),
      platform: detailValue(row.referring_platform),
      channel: detailValue(row.referring_channel),
      medium: detailValue(row.referring_medium),
      landingPageType: detailValue(row.landing_page_type),
      landingPagePath: detailValue(row.landing_page_path),
      campaign: detailValue(row.utm_campaign),
      campaignContent: detailValue(row.utm_content),
      aiReferral: detailValue(row.agentic_referring_channel),
      sessions: metrics.sessions,
      visitors: metrics.visitors,
      pageviews: metrics.pageviews,
      pageviewsPerSession: metrics.pageviewsPerSession,
      bounces: metrics.bounces,
      cartAdditions: metrics.cartAdditions,
      reachedCheckouts: metrics.reachedCheckouts,
      completedCheckouts: metrics.completedCheckouts,
      averageSessionDuration: metrics.averageSessionDuration,
      bounceRate: metrics.bounceRate,
      conversionRate: metrics.conversionRate,
    };
  });
}

function readRows(result: OptionalShopifyqlResult, label: string) {
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

function detailValue(value: unknown) {
  return stringValue(value) || "—";
}
