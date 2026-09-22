import type { H3Event } from "h3";
import type {
  DashboardTrafficAvailabilityState,
  DashboardTrafficBreakdown,
  DashboardTrafficDimensionKey,
  DashboardTrafficDimensionRow,
  DashboardTrafficGranularity,
  DashboardTrafficMetrics,
  DashboardTrafficOverviewAlias,
  DashboardTrafficPoint,
  DashboardTrafficRange,
  TrafficAvailability,
  TrafficDimensionResponse,
  TrafficOverviewResponse,
  TrafficRangeResponse,
} from "~~/types/traffic";
import {
  DASHBOARD_TRAFFIC_RANGES,
  DASHBOARD_TRAFFIC_RANGE_DEFINITIONS,
} from "~~/types/traffic";
import {
  createDashboardTrafficAvailability,
  createSingleStoreTrafficReporting,
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
import { createRequestAbortSignal } from "./request-abort";
import {
  buildTrafficDimensionCacheKey,
  buildTrafficOverviewCacheKey,
  buildTrafficRangeCacheKey,
  TRAFFIC_DIMENSION_CACHE_POLICIES,
  TRAFFIC_OVERVIEW_CACHE_POLICY,
  trafficQueryCache,
} from "./traffic-query-cache";

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

interface TrafficOverviewQueryResponse {
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
}

type TrafficQueryVariables = Record<DashboardTrafficOverviewAlias, string>;

interface TrafficRangeQueryResponse {
  metrics?: OptionalShopifyqlResult;
  trend?: OptionalShopifyqlResult;
  sources?: OptionalShopifyqlResult;
  countries?: OptionalShopifyqlResult;
  devices?: OptionalShopifyqlResult;
}

type TrafficRangeQueryVariables = Record<keyof TrafficRangeQueryResponse, string>;

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

export const TRAFFIC_RANGE_QUERY = `#graphql
  query StoreTrafficRange(
    $metrics: String!
    $trend: String!
    $sources: String!
    $countries: String!
    $devices: String!
  ) {
    metrics: shopifyqlQuery(query: $metrics) { ${SHOPIFYQL_RESULT_FIELDS} }
    trend: shopifyqlQuery(query: $trend) { ${SHOPIFYQL_RESULT_FIELDS} }
    sources: shopifyqlQuery(query: $sources) { ${SHOPIFYQL_RESULT_FIELDS} }
    countries: shopifyqlQuery(query: $countries) { ${SHOPIFYQL_RESULT_FIELDS} }
    devices: shopifyqlQuery(query: $devices) { ${SHOPIFYQL_RESULT_FIELDS} }
  }
`;

const DIMENSION_ROW_LIMIT = 250;
const HUMAN_FILTER = "WHERE human_or_bot_session = 'human'";
const TRAFFIC_PERIODS = Object.fromEntries(
  Object.entries(DASHBOARD_TRAFFIC_RANGE_DEFINITIONS).map(([range, definition]) => [
    range,
    definition.period,
  ]),
) as Record<DashboardTrafficRange, string>;
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
  refresh?: boolean;
}): Promise<TrafficOverviewResponse> {
  const requestAbort = createRequestAbortSignal(input.event);
  try {
    return await trafficQueryCache.resolve({
      key: buildTrafficOverviewCacheKey(input.storeId, input.token),
      policy: TRAFFIC_OVERVIEW_CACHE_POLICY,
      signal: requestAbort.signal,
      refresh: input.refresh,
      load: (signal) => loadShopifyTraffic(input, signal),
    });
  } finally {
    requestAbort.dispose();
  }
}

export async function fetchShopifyTrafficDimension(input: {
  event: H3Event;
  storeId: string;
  token: string;
  range: DashboardTrafficRange;
  dimension: DashboardTrafficDimensionKey;
  timeZone?: string;
  refresh?: boolean;
}): Promise<TrafficDimensionResponse> {
  const timeZone =
    input.timeZone === undefined ? undefined : requireIanaTimeZone(input.timeZone);
  const requestInput = { ...input, timeZone };
  const requestAbort = createRequestAbortSignal(input.event);
  try {
    return await trafficQueryCache.resolve({
      key: buildTrafficDimensionCacheKey(
        input.storeId,
        input.token,
        input.range,
        input.dimension,
        timeZone,
      ),
      policy: TRAFFIC_DIMENSION_CACHE_POLICIES[input.range],
      signal: requestAbort.signal,
      refresh: input.refresh,
      load: (signal) => loadShopifyTrafficDimension(requestInput, signal),
    });
  } finally {
    requestAbort.dispose();
  }
}

export async function fetchShopifyTrafficRange(input: {
  event: H3Event;
  storeId: string;
  token: string;
  range: DashboardTrafficRange;
  timeZone?: string;
  refresh?: boolean;
}): Promise<TrafficRangeResponse> {
  const timeZone =
    input.timeZone === undefined ? undefined : requireIanaTimeZone(input.timeZone);
  const requestInput = { ...input, timeZone };
  const requestAbort = createRequestAbortSignal(input.event);
  try {
    return await trafficQueryCache.resolve({
      key: buildTrafficRangeCacheKey(input.storeId, input.token, input.range, timeZone),
      policy: TRAFFIC_DIMENSION_CACHE_POLICIES[input.range],
      signal: requestAbort.signal,
      refresh: input.refresh,
      load: (signal) => loadShopifyTrafficRange(requestInput, signal),
    });
  } finally {
    requestAbort.dispose();
  }
}

async function loadShopifyTraffic(
  input: {
    event: H3Event;
    storeId: string;
    token: string;
    timeZone?: string;
    refresh?: boolean;
  },
  signal: AbortSignal,
): Promise<TrafficOverviewResponse> {
  const timeZone = await resolveShopifyTrafficTimeZone({ ...input, signal });
  const response = await callShopifyGraphql<
    TrafficOverviewQueryResponse,
    TrafficQueryVariables
  >({
    ...input,
    signal,
    query: DASHBOARD_TRAFFIC_QUERY,
    operationName: "DashboardTraffic",
    variables: buildTrafficQueryVariables(timeZone),
    timeoutMs: 30_000,
    allowPartialData: true,
  });

  return parseShopifyTrafficResponse(response, timeZone);
}

async function loadShopifyTrafficDimension(
  input: {
    event: H3Event;
    storeId: string;
    token: string;
    range: DashboardTrafficRange;
    dimension: DashboardTrafficDimensionKey;
    timeZone?: string;
    refresh?: boolean;
  },
  signal: AbortSignal,
): Promise<TrafficDimensionResponse> {
  const timeZone = await resolveShopifyTrafficTimeZone({ ...input, signal });
  const response = await callShopifyGraphql<
    { dimension?: OptionalShopifyqlResult },
    { dimension: string }
  >({
    ...input,
    signal,
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

async function loadShopifyTrafficRange(
  input: {
    event: H3Event;
    storeId: string;
    token: string;
    range: DashboardTrafficRange;
    timeZone?: string;
    refresh?: boolean;
  },
  signal: AbortSignal,
): Promise<TrafficRangeResponse> {
  const timeZone = await resolveShopifyTrafficTimeZone({ ...input, signal });
  const response = await callShopifyGraphql<
    TrafficRangeQueryResponse,
    TrafficRangeQueryVariables
  >({
    ...input,
    signal,
    query: TRAFFIC_RANGE_QUERY,
    operationName: "StoreTrafficRange",
    variables: buildTrafficRangeQueryVariables(input.range, timeZone),
    timeoutMs: 30_000,
    allowPartialData: true,
  });
  return parseShopifyTrafficRangeResponse(response, input.range, timeZone);
}

export function parseShopifyTrafficDimensionResponse(
  response: { dimension?: OptionalShopifyqlResult },
  range: DashboardTrafficRange,
  dimension: DashboardTrafficDimensionKey,
): TrafficDimensionResponse {
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
    generatedAt: new Date().toISOString(),
    cacheAge: 0,
    isStale: false,
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

export function buildTrafficRangeQueryVariables(
  range: DashboardTrafficRange,
  timeZone: string,
): TrafficRangeQueryVariables {
  const definition = DASHBOARD_TRAFFIC_RANGE_DEFINITIONS[range];
  const period = definition.period;
  return {
    metrics: summaryQuery(period, timeZone),
    trend: seriesQuery(definition.granularity, period, timeZone),
    sources: breakdownQuery("referrer_source", period, timeZone),
    countries: breakdownQuery("session_country", period, timeZone),
    devices: breakdownQuery("session_device_type", period, timeZone),
  };
}

export function parseShopifyTrafficRangeResponse(
  input:
    | TrafficRangeQueryResponse
    | ShopifyGraphqlPartialResponse<TrafficRangeQueryResponse>,
  range: DashboardTrafficRange,
  timeZone = "Etc/UTC",
  successfulAt = new Date().toISOString(),
): TrafficRangeResponse {
  const normalizedTimeZone = requireIanaTimeZone(timeZone);
  const { response, graphqlAvailability } = unwrapPartialResponse(input);
  const definition = DASHBOARD_TRAFFIC_RANGE_DEFINITIONS[range];
  const availability = {
    metrics: resolveTrafficAliasAvailability(
      response.metrics,
      graphqlAvailability?.metrics,
    ),
    trend: resolveTrafficAliasAvailability(response.trend, graphqlAvailability?.trend),
    sources: resolveTrafficAliasAvailability(
      response.sources,
      graphqlAvailability?.sources,
    ),
    countries: resolveTrafficAliasAvailability(
      response.countries,
      graphqlAvailability?.countries,
    ),
    devices: resolveTrafficAliasAvailability(
      response.devices,
      graphqlAvailability?.devices,
    ),
  };

  return {
    range,
    timeZone: normalizedTimeZone,
    data: {
      metrics: parseOptionalMetrics(response.metrics),
      trend: parseOptionalPoints(response.trend, definition.granularity),
      sources: parseOptionalRangeBreakdown(response.sources, "referrer_source"),
      countries: parseOptionalRangeBreakdown(response.countries, "session_country"),
      devices: parseOptionalRangeBreakdown(response.devices, "session_device_type"),
      dimensions: {},
      availability,
    },
    generatedAt: successfulAt,
    cacheAge: 0,
    isStale: false,
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
  input:
    | TrafficOverviewQueryResponse
    | ShopifyGraphqlPartialResponse<TrafficOverviewQueryResponse>,
  timeZone = "Etc/UTC",
  successfulAt = new Date().toISOString(),
): TrafficOverviewResponse {
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
  const hourly = parseOptionalPoints(response.hourly, "hour");
  const daily = parseOptionalPoints(response.daily, "day");
  const available = Object.values(availability).some((state) => state === "available");
  const unavailableRange = () => ({
    metrics: null,
    trend: null,
    sources: null,
    countries: null,
    devices: null,
    dimensions: {},
    availability: {
      metrics: "unknown" as const,
      trend: "unknown" as const,
      sources: "unknown" as const,
      countries: "unknown" as const,
      devices: "unknown" as const,
    },
  });
  const rangeData = Object.fromEntries(
    DASHBOARD_TRAFFIC_RANGES.map((range) => [range, unavailableRange()]),
  ) as TrafficOverviewResponse["rangeData"];
  Object.assign(rangeData, {
    "24h": {
      metrics: last24HoursResult,
      trend: hourly,
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
      trend: daily?.slice(-7) || null,
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
      trend: daily,
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
  });
  return {
    generatedAt: successfulAt,
    cacheAge: 0,
    isStale: false,
    available,
    availableStores: available ? 1 : 0,
    reporting: createSingleStoreTrafficReporting(rangeData, available, successfulAt),
    timeZone: normalizedTimeZone,
    timeZoneMode: "store",
    availability,
    today: todayResult,
    last24Hours: last24HoursResult,
    last7Days: last7DaysResult,
    last30Days: last30DaysResult,
    hourly,
    daily,
    sources,
    countries,
    devices,
    rangeData,
  };
}

function unwrapTrafficResponse(
  input:
    | TrafficOverviewQueryResponse
    | ShopifyGraphqlPartialResponse<TrafficOverviewQueryResponse>,
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

function unwrapPartialResponse<T extends object>(
  input: T | ShopifyGraphqlPartialResponse<T>,
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
  response: TrafficOverviewQueryResponse,
  graphqlAvailability?: Record<string, "available" | "failed">,
): TrafficAvailability {
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

function seriesQuery(
  dimension: DashboardTrafficGranularity,
  period: string,
  timeZone: string,
) {
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
  dimension: DashboardTrafficGranularity,
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
