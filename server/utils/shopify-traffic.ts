import type { H3Event } from "h3";
import type {
  DashboardTrafficAvailability,
  DashboardTrafficAvailabilityState,
  DashboardTrafficBreakdown,
  DashboardTrafficDimensionKey,
  DashboardTrafficDimensionResponse,
  DashboardTrafficDimensionRow,
  DashboardTrafficMetrics,
  DashboardTrafficOverviewAlias,
  DashboardTrafficPoint,
  DashboardTrafficRange,
  DashboardTrafficSummary,
} from "~~/types/dashboard";
import {
  createDashboardTrafficAvailability,
  createTrafficMetrics,
} from "~~/utils/dashboard-traffic";
import { createApiErrorFromMessage } from "./callShopifyApi";
import {
  callShopifyGraphql,
  type ShopifyGraphqlPartialResponse,
} from "./callShopifyGraphql";
import {
  requireIanaTimeZone,
  resolveShopifyTrafficTimeZone,
  shopifyqlTimeZoneModifier,
} from "./shopify-traffic-timezone";

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
}

type TrafficQueryVariables = Record<DashboardTrafficOverviewAlias, string>;

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

export const TRAFFIC_DIMENSION_QUERY = `#graphql
  query StoreTrafficDimension($dimension: String!) {
    dimension: shopifyqlQuery(query: $dimension) { ${SHOPIFYQL_RESULT_FIELDS} }
  }
`;

const DIMENSION_ROW_LIMIT = 250;
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

const TRAFFIC_DIMENSION_FIELDS = {
  source: "referrer_source",
  referrerDomain: "referrer_domain",
  referrerTerms: "referrer_terms",
  country: "session_country",
  region: "session_region",
  city: "session_city",
  browser: "session_device_browser",
  browserVersion: "session_device_browser_version",
  operatingSystem: "session_device_os",
  operatingSystemVersion: "session_device_os_version",
  deviceType: "session_device_type",
  apiClient: "session_api_client",
  trafficType: "traffic_type",
  platform: "referring_platform",
  channel: "referring_channel",
  medium: "referring_medium",
  landingPageType: "landing_page_type",
  landingPagePath: "landing_page_path",
  campaign: "utm_campaign",
  campaignContent: "utm_content",
  aiReferral: "agentic_referring_channel",
} as const satisfies Record<DashboardTrafficDimensionKey, string>;

export async function fetchShopifyTraffic(input: {
  event: H3Event;
  storeId: string;
  token: string;
  timeZone?: string;
}): Promise<DashboardTrafficSummary> {
  const timeZone = await resolveShopifyTrafficTimeZone(input);
  const response = await callShopifyGraphql<
    TrafficQueryResponse,
    TrafficQueryVariables
  >({
    ...input,
    query: DASHBOARD_TRAFFIC_QUERY,
    operationName: "DashboardTraffic",
    variables: buildTrafficQueryVariables(timeZone),
    timeoutMs: 30_000,
    allowPartialData: true,
  });

  return parseShopifyTrafficResponse(response, timeZone);
}

export async function fetchShopifyTrafficDimension(input: {
  event: H3Event;
  storeId: string;
  token: string;
  range: DashboardTrafficRange;
  dimension: DashboardTrafficDimensionKey;
}): Promise<DashboardTrafficDimensionResponse> {
  const timeZone = await resolveShopifyTrafficTimeZone(input);
  const response = await callShopifyGraphql<
    { dimension?: OptionalShopifyqlResult },
    { dimension: string }
  >({
    ...input,
    query: TRAFFIC_DIMENSION_QUERY,
    operationName: "StoreTrafficDimension",
    variables: buildTrafficDimensionQueryVariables(
      input.range,
      input.dimension,
      timeZone,
    ),
    timeoutMs: 30_000,
  });
  return parseShopifyTrafficDimensionResponse(response, input.range, input.dimension);
}

export function parseShopifyTrafficDimensionResponse(
  response: { dimension?: OptionalShopifyqlResult },
  range: DashboardTrafficRange,
  dimension: DashboardTrafficDimensionKey,
): DashboardTrafficDimensionResponse {
  const field = TRAFFIC_DIMENSION_FIELDS[dimension];
  const resultRows = readRows(
    response.dimension,
    `${range} ${dimension} traffic dimension`,
  );
  const hasMore = resultRows.length > DIMENSION_ROW_LIMIT;
  const rows = resultRows
    .slice(0, DIMENSION_ROW_LIMIT)
    .map((row) => parseTrafficDimensionRow(row, field));
  const totalSessions = readDimensionTotal(resultRows, "sessions");

  return {
    range,
    dimension,
    rows,
    totalSessions,
    hasMore,
  };
}

export function buildTrafficDimensionQueryVariables(
  range: DashboardTrafficRange,
  dimension: DashboardTrafficDimensionKey,
  timeZone: string,
) {
  return {
    dimension: dimensionQuery(
      TRAFFIC_DIMENSION_FIELDS[dimension],
      TRAFFIC_PERIODS[range],
      timeZone,
    ),
  };
}

export function isDashboardTrafficDimensionKey(
  value: string,
): value is DashboardTrafficDimensionKey {
  return Object.hasOwn(TRAFFIC_DIMENSION_FIELDS, value);
}

export function buildTrafficQueryVariables(timeZone: string): TrafficQueryVariables {
  return {
    today: summaryQuery("DURING today", timeZone),
    last24Hours: summaryQuery(TRAFFIC_PERIODS["24h"], timeZone),
    last7Days: summaryQuery(TRAFFIC_PERIODS["7d"], timeZone),
    last30Days: summaryQuery(TRAFFIC_PERIODS["30d"], timeZone),
    hourly: seriesQuery("hour", TRAFFIC_PERIODS["24h"], timeZone),
    daily: seriesQuery("day", TRAFFIC_PERIODS["30d"], timeZone),
    sources: breakdownQuery("referrer_source", TRAFFIC_PERIODS["30d"], timeZone),
    sources24Hours: breakdownQuery("referrer_source", TRAFFIC_PERIODS["24h"], timeZone),
    sources7Days: breakdownQuery("referrer_source", TRAFFIC_PERIODS["7d"], timeZone),
    countries: breakdownQuery("session_country", TRAFFIC_PERIODS["30d"], timeZone),
    countries24Hours: breakdownQuery(
      "session_country",
      TRAFFIC_PERIODS["24h"],
      timeZone,
    ),
    countries7Days: breakdownQuery("session_country", TRAFFIC_PERIODS["7d"], timeZone),
    devices: breakdownQuery("session_device_type", TRAFFIC_PERIODS["30d"], timeZone),
    devices24Hours: breakdownQuery(
      "session_device_type",
      TRAFFIC_PERIODS["24h"],
      timeZone,
    ),
    devices7Days: breakdownQuery(
      "session_device_type",
      TRAFFIC_PERIODS["7d"],
      timeZone,
    ),
  };
}

export function parseShopifyTrafficResponse(
  input: TrafficQueryResponse | ShopifyGraphqlPartialResponse<TrafficQueryResponse>,
  timeZone = "Etc/UTC",
): DashboardTrafficSummary {
  const normalizedTimeZone = requireIanaTimeZone(timeZone);
  const { response, graphqlAvailability } = unwrapTrafficResponse(input);
  const availability = resolveTrafficAvailability(response, graphqlAvailability);
  const todayResult = parseOptionalMetrics(response.today);
  const last24HoursResult = parseOptionalMetrics(response.last24Hours);
  const last7DaysResult = parseOptionalMetrics(response.last7Days);
  const last30DaysResult = parseOptionalMetrics(response.last30Days);
  const sources = parseBreakdownIfAvailable(
    response.sources,
    "referrer_source",
    false,
    "Direct / unknown",
  );
  const countries = parseBreakdownIfAvailable(
    response.countries,
    "session_country",
    false,
    "Direct / unknown",
  );
  const devices = parseBreakdownIfAvailable(
    response.devices,
    "session_device_type",
    false,
    "Direct / unknown",
  );
  const sources24Hours = parseOptionalRangeBreakdown(
    response.sources24Hours,
    "referrer_source",
  );
  const sources7Days = parseOptionalRangeBreakdown(
    response.sources7Days,
    "referrer_source",
  );
  const countries24Hours = parseOptionalRangeBreakdown(
    response.countries24Hours,
    "session_country",
  );
  const countries7Days = parseOptionalRangeBreakdown(
    response.countries7Days,
    "session_country",
  );
  const devices24Hours = parseOptionalRangeBreakdown(
    response.devices24Hours,
    "session_device_type",
  );
  const devices7Days = parseOptionalRangeBreakdown(
    response.devices7Days,
    "session_device_type",
  );
  const available = Object.values(availability).some((state) => state === "available");
  return {
    available,
    availableStores: available ? 1 : 0,
    timeZone: normalizedTimeZone,
    timeZoneMode: "store",
    availability,
    today: todayResult,
    last24Hours: last24HoursResult,
    last7Days: last7DaysResult,
    last30Days: last30DaysResult,
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
    rangeData: {
      "24h": {
        metrics: last24HoursResult,
        sources: sources24Hours,
        countries: countries24Hours,
        devices: devices24Hours,
        dimensions: {},
        availability: {
          metrics: availability.last24Hours,
          trend: availability.hourly,
          sources: availability.sources24Hours,
          countries: availability.countries24Hours,
          devices: availability.devices24Hours,
        },
      },
      "7d": {
        metrics: last7DaysResult,
        sources: sources7Days,
        countries: countries7Days,
        devices: devices7Days,
        dimensions: {},
        availability: {
          metrics: availability.last7Days,
          trend: availability.daily,
          sources: availability.sources7Days,
          countries: availability.countries7Days,
          devices: availability.devices7Days,
        },
      },
      "30d": {
        metrics: last30DaysResult,
        sources,
        countries,
        devices,
        dimensions: {},
        availability: {
          metrics: availability.last30Days,
          trend: availability.daily,
          sources: availability.sources,
          countries: availability.countries,
          devices: availability.devices,
        },
      },
    },
  };
}

function unwrapTrafficResponse(
  input: TrafficQueryResponse | ShopifyGraphqlPartialResponse<TrafficQueryResponse>,
) {
  if ("data" in input && "errors" in input && "availability" in input) {
    return {
      response: input.data,
      graphqlAvailability: input.availability,
    };
  }
  return {
    response: input,
    graphqlAvailability: undefined,
  };
}

function resolveTrafficAvailability(
  response: TrafficQueryResponse,
  graphqlAvailability?: Record<string, "available" | "failed">,
): DashboardTrafficAvailability {
  const availability = createDashboardTrafficAvailability("failed");
  for (const alias of Object.keys(availability) as DashboardTrafficOverviewAlias[]) {
    availability[alias] = resolveTrafficAliasAvailability(
      response[alias],
      graphqlAvailability?.[alias],
    );
  }
  return availability;
}

function resolveTrafficAliasAvailability(
  result: OptionalShopifyqlResult,
  graphqlAvailability?: "available" | "failed",
): DashboardTrafficAvailabilityState {
  if (graphqlAvailability === "failed") return "failed";
  return readOptionalRows(result) ? "available" : "failed";
}

function summaryQuery(period: string, timeZone: string) {
  return `FROM sessions\nSHOW ${SUMMARY_METRICS}\n${HUMAN_FILTER}\nWITH ${shopifyqlTimeZoneModifier(timeZone)}\n${period}`;
}

function seriesQuery(dimension: "hour" | "day", period: string, timeZone: string) {
  return `FROM sessions\nSHOW sessions, online_store_visitors, pageviews\n${HUMAN_FILTER}\nTIMESERIES ${dimension} WITH ${shopifyqlTimeZoneModifier(timeZone)}\n${period}\nORDER BY ${dimension} ASC`;
}

function breakdownQuery(dimension: string, period: string, timeZone: string) {
  return `FROM sessions\nSHOW sessions, online_store_visitors\n${HUMAN_FILTER}\nGROUP BY ${dimension} WITH ${shopifyqlTimeZoneModifier(timeZone)}\n${period}\nORDER BY sessions DESC\nLIMIT 8`;
}

function dimensionQuery(dimension: string, period: string, timeZone: string) {
  return `FROM sessions\nSHOW ${SUMMARY_METRICS}\n${HUMAN_FILTER}\nGROUP BY ${dimension} WITH TOTALS, ${shopifyqlTimeZoneModifier(timeZone)}\n${period}\nORDER BY sessions DESC, ${dimension} ASC\nLIMIT ${DIMENSION_ROW_LIMIT + 1}`;
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
): DashboardTrafficPoint[] | null {
  const rows = readOptionalRows(result);
  if (!rows) return null;
  return rows.flatMap((row) => {
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
) {
  return parseBreakdownIfAvailable(result, dimension, false, "Direct / unknown");
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

function parseTrafficDimensionRow(
  row: Record<string, unknown>,
  dimension: string,
): DashboardTrafficDimensionRow {
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
    label: detailValue(row[dimension]),
    ...metrics,
  };
}

function readDimensionTotal(rows: Array<Record<string, unknown>>, metric: string) {
  if (!rows.length) return 0;

  const totalField = `${metric}__totals`;
  if (!Object.hasOwn(rows[0] || {}, totalField)) {
    throw createApiErrorFromMessage(
      `ShopifyQL did not return ${totalField} for the traffic dimension.`,
      502,
    );
  }
  return numberValue(rows[0]?.[totalField]);
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
