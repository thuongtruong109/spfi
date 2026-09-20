export const DASHBOARD_SERVICES = [
  "profile",
  "orders",
  "customers",
  "products",
  "payments",
  "users",
  "traffic",
] as const;

export type DashboardService = (typeof DASHBOARD_SERVICES)[number];

export interface DashboardLoadOptions {
  storeIds?: string[];
  services?: DashboardService[];
}

export interface DashboardMoney {
  currency: string;
  amount: number;
}

export interface DashboardCurrencyCount {
  currency: string;
  count: number;
}

export interface DashboardRevenueCurrencyCount {
  currency: string;
  today: number;
  week: number;
  month: number;
}

export interface DashboardRevenuePoint {
  date: string;
  orders: number;
  orderCounts: DashboardCurrencyCount[];
  values: DashboardMoney[];
}

export interface DashboardRevenueSummary {
  today: DashboardMoney[];
  week: DashboardMoney[];
  month: DashboardMoney[];
  orderCountToday: number;
  orderCountWeek: number;
  orderCountMonth: number;
  currencyCounts: DashboardRevenueCurrencyCount[];
  daily: DashboardRevenuePoint[];
}

export interface DashboardTopProduct {
  key: string;
  productId: string | null;
  title: string;
  units: number;
  orders: number;
  currencyStats: Array<DashboardCurrencyCount & { units: number }>;
  revenue: DashboardMoney[];
}

export interface DashboardFulfillmentBreakdown {
  fulfilled: number;
  partial: number;
  unfulfilled: number;
}

export interface DashboardPendingOrder {
  id: string;
  name: string;
  createdAt: string;
  fulfillmentStatus: string;
  amount: number;
  currency: string;
}

export interface DashboardPayoutSummary {
  count: number;
  pendingCount: number;
  paidCount: number;
  failedCount: number;
  currencyCounts: Array<
    DashboardCurrencyCount & {
      pendingCount: number;
      paidCount: number;
      failedCount: number;
    }
  >;
  total: DashboardMoney[];
  pending: DashboardMoney[];
}

export interface DashboardTransactionSummary {
  count: number;
  currencyCounts: DashboardCurrencyCount[];
  gross: DashboardMoney[];
  fees: DashboardMoney[];
  net: DashboardMoney[];
  recent: DashboardRecentTransaction[];
}

export interface DashboardRecentTransaction {
  id: string;
  type: string;
  processedAt: string;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  orderName: string | null;
}

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  role: string;
  accountOwner: boolean;
}

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

export type DashboardTrafficAvailability = Record<
  DashboardTrafficOverviewAlias,
  DashboardTrafficAvailabilityState
>;

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

export interface DashboardTrafficDimensionResponse extends DashboardTrafficDimensionResult {
  range: DashboardTrafficRange;
  dimension: DashboardTrafficDimensionKey;
}

export interface DashboardTrafficSummary {
  available: boolean;
  availableStores: number;
  reporting: DashboardTrafficReporting;
  timeZone: string | null;
  timeZoneMode: DashboardTrafficTimeZoneMode;
  availability: DashboardTrafficAvailability;
  today: DashboardTrafficMetrics | null;
  last24Hours: DashboardTrafficMetrics | null;
  last7Days: DashboardTrafficMetrics | null;
  last30Days: DashboardTrafficMetrics | null;
  hourly: DashboardTrafficPoint[] | null;
  daily: DashboardTrafficPoint[] | null;
  sources: DashboardTrafficBreakdown[] | null;
  countries: DashboardTrafficBreakdown[] | null;
  devices: DashboardTrafficBreakdown[] | null;
  trafficTypes: DashboardTrafficBreakdown[];
  platforms: DashboardTrafficBreakdown[];
  browsers: DashboardTrafficBreakdown[];
  landingPages: DashboardTrafficBreakdown[];
  campaigns: DashboardTrafficBreakdown[];
  aiReferrals: DashboardTrafficBreakdown[];
  rangeData: Record<DashboardTrafficRange, DashboardTrafficRangeData>;
}

export interface DashboardWarning {
  resource:
    | "orders"
    | "fulfillments"
    | "customers"
    | "products"
    | "payments"
    | "profile"
    | "users"
    | "traffic";
  message: string;
}

export interface StoreDashboardSnapshot {
  storeId: string;
  storeName: string;
  domain: string;
  currency: string;
  owner: string;
  email: string;
  plan: string;
  generatedAt: string;
  revenue: DashboardRevenueSummary;
  fulfillmentBreakdown: DashboardFulfillmentBreakdown;
  pendingFulfillments: {
    count: number;
    currencyCounts: DashboardCurrencyCount[];
    orders: DashboardPendingOrder[];
  };
  topProducts: DashboardTopProduct[];
  productCount: number;
  customerCount: number;
  payments: {
    available: boolean;
    currencies: string[];
    balance: DashboardMoney[];
    payouts: DashboardPayoutSummary;
    transactions: DashboardTransactionSummary;
  };
  traffic: DashboardTrafficSummary;
  users: DashboardUser[];
  warnings: DashboardWarning[];
}

export interface DashboardStoreFailure {
  storeId: string;
  label: string;
  reason: "missing-token" | "expired-token" | "request-failed";
  message: string;
}

export interface DashboardAggregate {
  stores: StoreDashboardSnapshot[];
  failures: DashboardStoreFailure[];
  revenue: DashboardRevenueSummary;
  topProducts: Array<DashboardTopProduct & { storeId: string; storeName: string }>;
  pendingOrders: Array<DashboardPendingOrder & { storeId: string; storeName: string }>;
  recentTransactions: Array<
    DashboardRecentTransaction & { storeId: string; storeName: string }
  >;
  customerCount: number;
  productCount: number;
  userCount: number;
  pendingFulfillmentCount: number;
  fulfillmentBreakdown: DashboardFulfillmentBreakdown;
  payments: {
    availableStores: number;
    balance: DashboardMoney[];
    payouts: DashboardPayoutSummary;
    transactions: DashboardTransactionSummary;
  };
  traffic: DashboardTrafficSummary;
}
