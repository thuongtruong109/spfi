import type { H3Event } from "h3";
import type {
  DashboardTrafficBreakdown,
  DashboardTrafficDetailRow,
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
  trafficTypes?: ShopifyqlResult;
  platforms?: ShopifyqlResult;
  browsers?: ShopifyqlResult;
  landingPages?: ShopifyqlResult;
  campaigns?: ShopifyqlResult;
  aiReferrals?: ShopifyqlResult;
  details?: ShopifyqlResult;
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

type TrafficInsightQueryVariables = Record<
  | "trafficTypes"
  | "platforms"
  | "browsers"
  | "landingPages"
  | "campaigns"
  | "aiReferrals"
  | "details",
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

export const STORE_TRAFFIC_QUERY = `#graphql
  query StoreTraffic(
    $today: String!
    $last7Days: String!
    $last30Days: String!
    $hourly: String!
    $daily: String!
    $sources: String!
    $countries: String!
    $devices: String!
    $trafficTypes: String!
    $platforms: String!
    $browsers: String!
    $landingPages: String!
    $campaigns: String!
    $aiReferrals: String!
    $details: String!
  ) {
    today: shopifyqlQuery(query: $today) { ${SHOPIFYQL_RESULT_FIELDS} }
    last7Days: shopifyqlQuery(query: $last7Days) { ${SHOPIFYQL_RESULT_FIELDS} }
    last30Days: shopifyqlQuery(query: $last30Days) { ${SHOPIFYQL_RESULT_FIELDS} }
    hourly: shopifyqlQuery(query: $hourly) { ${SHOPIFYQL_RESULT_FIELDS} }
    daily: shopifyqlQuery(query: $daily) { ${SHOPIFYQL_RESULT_FIELDS} }
    sources: shopifyqlQuery(query: $sources) { ${SHOPIFYQL_RESULT_FIELDS} }
    countries: shopifyqlQuery(query: $countries) { ${SHOPIFYQL_RESULT_FIELDS} }
    devices: shopifyqlQuery(query: $devices) { ${SHOPIFYQL_RESULT_FIELDS} }
    trafficTypes: shopifyqlQuery(query: $trafficTypes) { ${SHOPIFYQL_RESULT_FIELDS} }
    platforms: shopifyqlQuery(query: $platforms) { ${SHOPIFYQL_RESULT_FIELDS} }
    browsers: shopifyqlQuery(query: $browsers) { ${SHOPIFYQL_RESULT_FIELDS} }
    landingPages: shopifyqlQuery(query: $landingPages) { ${SHOPIFYQL_RESULT_FIELDS} }
    campaigns: shopifyqlQuery(query: $campaigns) { ${SHOPIFYQL_RESULT_FIELDS} }
    aiReferrals: shopifyqlQuery(query: $aiReferrals) { ${SHOPIFYQL_RESULT_FIELDS} }
    details: shopifyqlQuery(query: $details) { ${SHOPIFYQL_RESULT_FIELDS} }
  }
`;

const DETAIL_ROW_LIMIT = 250;
const HUMAN_FILTER = "WHERE human_or_bot_session = 'human'";
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
  includeInsights?: boolean;
}): Promise<DashboardTrafficSummary> {
  const response = input.includeInsights
    ? await callShopifyGraphql<
        TrafficQueryResponse,
        TrafficQueryVariables & TrafficInsightQueryVariables
      >({
        ...input,
        query: STORE_TRAFFIC_QUERY,
        operationName: "StoreTraffic",
        variables: {
          ...buildTrafficQueryVariables(),
          ...buildTrafficInsightQueryVariables(),
        },
        timeoutMs: 30_000,
      })
    : await callShopifyGraphql<TrafficQueryResponse, TrafficQueryVariables>({
        ...input,
        query: DASHBOARD_TRAFFIC_QUERY,
        operationName: "DashboardTraffic",
        variables: buildTrafficQueryVariables(),
        timeoutMs: 30_000,
      });

  return parseShopifyTrafficResponse(response);
}

export function buildTrafficInsightQueryVariables(): TrafficInsightQueryVariables {
  return {
    trafficTypes: breakdownQuery("traffic_type"),
    platforms: breakdownQuery("referring_platform"),
    browsers: breakdownQuery("session_device_browser"),
    landingPages: breakdownQuery("landing_page_path"),
    campaigns: breakdownQuery("utm_campaign"),
    aiReferrals: breakdownQuery("agentic_referring_channel"),
    details: detailQuery(),
  };
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
  const details = parseTrafficDetails(response.details);
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

function detailQuery() {
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

  return `FROM sessions\nSHOW ${metrics.join(", ")}\n${HUMAN_FILTER}\nGROUP BY ${dimensions.join(", ")}\nSINCE -29d UNTIL now\nORDER BY sessions DESC\nLIMIT ${DETAIL_ROW_LIMIT}`;
}

function parseMetrics(result: ShopifyqlResult, label: string): DashboardTrafficMetrics {
  const row = readRows(result, label)[0] || {};
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

function parseOptionalBreakdown(
  result: ShopifyqlResult | undefined,
  dimension: string,
  omitEmpty = false,
): DashboardTrafficBreakdown[] {
  if (
    !result?.tableData ||
    !Array.isArray(result.tableData.rows) ||
    (result.parseErrors?.length || 0) > 0
  ) {
    return [];
  }

  return result.tableData.rows.flatMap((row) => {
    const label = stringValue(row[dimension]);
    if (!label && omitEmpty) return [];
    return [
      {
        label: label || "Unknown / unattributed",
        sessions: numberValue(row.sessions),
        visitors: numberValue(row.online_store_visitors),
      },
    ];
  });
}

function parseTrafficDetails(
  result: ShopifyqlResult | undefined,
): DashboardTrafficDetailRow[] {
  if (
    !result?.tableData ||
    !Array.isArray(result.tableData.rows) ||
    (result.parseErrors?.length || 0) > 0
  ) {
    return [];
  }

  return result.tableData.rows.map((row) => {
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

function detailValue(value: unknown) {
  return stringValue(value) || "—";
}
