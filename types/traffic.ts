export interface DashboardTrafficMetrics {
  sessions: number;
  visitors: number;
  pageviews: number;
  bounces: number;
  cartAdditions: number;
  reachedCheckouts: number;
  completedCheckouts: number;
  pageviewsPerSession: number;
  averageSessionDuration: number;
  bounceRate: number;
  conversionRate: number;
}

export interface DashboardTrafficPoint {
  period: string;
  sessions: number;
  visitors: number;
  pageviews: number;
}

export interface DashboardTrafficBreakdown {
  label: string;
  sessions: number;
  visitors: number;
}

export const DASHBOARD_TRAFFIC_OVERVIEW_ALIASES = [
  "today",
  "last24Hours",
  "last7Days",
  "last30Days",
  "hourly",
  "daily",
  "sources",
  "sources24Hours",
  "sources7Days",
  "countries",
  "countries24Hours",
  "countries7Days",
  "devices",
  "devices24Hours",
  "devices7Days",
] as const;

export type DashboardTrafficOverviewAlias =
  (typeof DASHBOARD_TRAFFIC_OVERVIEW_ALIASES)[number];

export type DashboardTrafficAvailabilityState =
  "available" | "partial" | "failed" | "unknown";

/** Availability for exactly the aliases selected by the overview query. */
export type TrafficAvailability = Record<
  DashboardTrafficOverviewAlias,
  DashboardTrafficAvailabilityState
>;

/** @deprecated Use TrafficAvailability for API contracts. */
export type DashboardTrafficAvailability = TrafficAvailability;

export interface DashboardTrafficRangeAvailability {
  metrics: DashboardTrafficAvailabilityState;
  trend: DashboardTrafficAvailabilityState;
  sources: DashboardTrafficAvailabilityState;
  countries: DashboardTrafficAvailabilityState;
  devices: DashboardTrafficAvailabilityState;
}

export const DASHBOARD_TRAFFIC_BLOCKS = [
  "metrics",
  "trend",
  "sources",
  "countries",
  "devices",
] as const;

export type DashboardTrafficBlock = (typeof DASHBOARD_TRAFFIC_BLOCKS)[number];

export const DASHBOARD_TRAFFIC_DIMENSION_KEYS = [
  "source",
  "referrerDomain",
  "referrerTerms",
  "trafficType",
  "platform",
  "channel",
  "medium",
  "aiReferral",
  "country",
  "region",
  "city",
  "deviceType",
  "browser",
  "browserVersion",
  "operatingSystem",
  "operatingSystemVersion",
  "apiClient",
  "landingPagePath",
  "landingPageType",
  "campaign",
  "campaignContent",
] as const;

export type DashboardTrafficDimensionKey =
  (typeof DASHBOARD_TRAFFIC_DIMENSION_KEYS)[number];

export interface DashboardTrafficDimensionRow {
  label: string;
  sessions: number;
  visitors: number;
  pageviews: number;
  pageviewsPerSession: number;
  bounces: number;
  cartAdditions: number;
  reachedCheckouts: number;
  completedCheckouts: number;
  averageSessionDuration: number;
  bounceRate: number;
  conversionRate: number;
}

export const DASHBOARD_TRAFFIC_OVERVIEW_RANGES = ["24h", "7d", "30d"] as const;

export const DASHBOARD_TRAFFIC_RANGES = [
  ...DASHBOARD_TRAFFIC_OVERVIEW_RANGES,
  "60d",
  "90d",
  "6m",
  "1y",
] as const;

export type DashboardTrafficRange = (typeof DASHBOARD_TRAFFIC_RANGES)[number];
export type DashboardTrafficOverviewRange =
  (typeof DASHBOARD_TRAFFIC_OVERVIEW_RANGES)[number];
export type DashboardTrafficGranularity = "hour" | "day" | "week" | "month";

export const DASHBOARD_TRAFFIC_RANGE_DEFINITIONS = {
  "24h": {
    shortLabel: "24H",
    labelKey: "dashboard.trafficRange24h",
    period: "SINCE -24h UNTIL now",
    granularity: "hour",
  },
  "7d": {
    shortLabel: "7D",
    labelKey: "dashboard.trafficRange7d",
    period: "SINCE -6d UNTIL now",
    granularity: "day",
  },
  "30d": {
    shortLabel: "30D",
    labelKey: "dashboard.trafficRange30d",
    period: "SINCE -29d UNTIL now",
    granularity: "day",
  },
  "60d": {
    shortLabel: "60D",
    labelKey: "dashboard.trafficRange60d",
    period: "SINCE -59d UNTIL now",
    granularity: "day",
  },
  "90d": {
    shortLabel: "90D",
    labelKey: "dashboard.trafficRange90d",
    period: "SINCE -89d UNTIL now",
    granularity: "week",
  },
  "6m": {
    shortLabel: "6M",
    labelKey: "dashboard.trafficRange6m",
    period: "SINCE -6m UNTIL now",
    granularity: "week",
  },
  "1y": {
    shortLabel: "1Y",
    labelKey: "dashboard.trafficRange1y",
    period: "SINCE -1y UNTIL now",
    granularity: "month",
  },
} as const satisfies Record<
  DashboardTrafficRange,
  {
    shortLabel: string;
    labelKey: string;
    period: string;
    granularity: DashboardTrafficGranularity;
  }
>;
export type DashboardTrafficTimeZoneMode = "store" | "per-store" | "unknown";

export interface TrafficDimensionLoadProgress {
  loaded: number;
  total: number;
  percent: number;
  complete: boolean;
}

export interface DashboardTrafficBlockCoverage {
  reportingStores: number;
  totalStores: number;
}

export type DashboardTrafficRangeCoverage = Record<
  DashboardTrafficBlock,
  DashboardTrafficBlockCoverage
>;

export interface DashboardTrafficStoreIssue {
  range: DashboardTrafficRange;
  block: DashboardTrafficBlock;
  state: Exclude<DashboardTrafficAvailabilityState, "available">;
}

export interface DashboardTrafficStoreReport {
  storeId: string;
  label: string;
  status: "reporting" | "partial" | "failed";
  lastSuccessfulAt: string | null;
  issues: DashboardTrafficStoreIssue[];
  message: string | null;
}

export interface DashboardTrafficReporting {
  totalStores: number;
  reportingStores: number;
  lastSuccessfulAt: string | null;
  stores: DashboardTrafficStoreReport[];
  coverage: Partial<Record<DashboardTrafficRange, DashboardTrafficRangeCoverage>>;
}

export interface DashboardTrafficDimensionResult {
  rows: DashboardTrafficDimensionRow[];
  totalSessions: number;
  hasMore: boolean;
}

export type DashboardTrafficDimensions = Partial<
  Record<DashboardTrafficDimensionKey, DashboardTrafficDimensionResult>
>;

export interface DashboardTrafficRangeData {
  metrics: DashboardTrafficMetrics | null;
  trend: DashboardTrafficPoint[] | null;
  sources: DashboardTrafficBreakdown[] | null;
  countries: DashboardTrafficBreakdown[] | null;
  devices: DashboardTrafficBreakdown[] | null;
  dimensions: DashboardTrafficDimensions;
  availability: DashboardTrafficRangeAvailability;
}

/**
 * Cache metadata returned by traffic endpoints. `cacheAge` follows HTTP Age
 * semantics and is expressed in whole seconds.
 */
export interface TrafficQueryDiagnostics {
  generatedAt: string | null;
  cacheAge: number;
  isStale: boolean;
  cacheStatus?: "hit" | "miss" | "stale";
}

export interface TrafficDimensionResponse
  extends DashboardTrafficDimensionResult, TrafficQueryDiagnostics {
  range: DashboardTrafficRange;
  dimension: DashboardTrafficDimensionKey;
}

/** @deprecated Use TrafficDimensionResponse for API contracts. */
export type DashboardTrafficDimensionResponse = TrafficDimensionResponse;

export interface TrafficRangeResponse extends TrafficQueryDiagnostics {
  range: DashboardTrafficRange;
  timeZone: string;
  data: DashboardTrafficRangeData;
}

/**
 * The overview contract intentionally contains only data queried by
 * DASHBOARD_TRAFFIC_QUERY. Additional breakdowns are loaded by the dimension
 * endpoint and stored under rangeData.dimensions.
 */
export interface TrafficOverviewResponse extends TrafficQueryDiagnostics {
  available: boolean;
  availableStores: number;
  reporting: DashboardTrafficReporting;
  timeZone: string | null;
  timeZoneMode: DashboardTrafficTimeZoneMode;
  availability: TrafficAvailability;
  today: DashboardTrafficMetrics | null;
  last24Hours: DashboardTrafficMetrics | null;
  last7Days: DashboardTrafficMetrics | null;
  last30Days: DashboardTrafficMetrics | null;
  hourly: DashboardTrafficPoint[] | null;
  daily: DashboardTrafficPoint[] | null;
  sources: DashboardTrafficBreakdown[] | null;
  countries: DashboardTrafficBreakdown[] | null;
  devices: DashboardTrafficBreakdown[] | null;
  rangeData: Record<DashboardTrafficRange, DashboardTrafficRangeData>;
}

/** @deprecated Use TrafficOverviewResponse for API contracts. */
export type DashboardTrafficSummary = TrafficOverviewResponse;
