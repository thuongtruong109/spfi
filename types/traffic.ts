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

export type DashboardTrafficDimensionKey =
  | "source"
  | "referrerDomain"
  | "referrerTerms"
  | "country"
  | "region"
  | "city"
  | "browser"
  | "browserVersion"
  | "operatingSystem"
  | "operatingSystemVersion"
  | "deviceType"
  | "apiClient"
  | "trafficType"
  | "platform"
  | "channel"
  | "medium"
  | "landingPageType"
  | "landingPagePath"
  | "campaign"
  | "campaignContent"
  | "aiReferral";

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

export type DashboardTrafficRange = "24h" | "7d" | "30d";
export type DashboardTrafficTimeZoneMode = "store" | "per-store" | "unknown";

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
  coverage: Record<DashboardTrafficRange, DashboardTrafficRangeCoverage>;
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
}

export interface TrafficDimensionResponse
  extends DashboardTrafficDimensionResult, TrafficQueryDiagnostics {
  range: DashboardTrafficRange;
  dimension: DashboardTrafficDimensionKey;
}

/** @deprecated Use TrafficDimensionResponse for API contracts. */
export type DashboardTrafficDimensionResponse = TrafficDimensionResponse;

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
