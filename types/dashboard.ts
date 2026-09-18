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

export interface DashboardTrafficDetailRow {
  source: string;
  referrerDomain: string;
  referrerTerms: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  browser: string;
  browserVersion: string;
  operatingSystem: string;
  operatingSystemVersion: string;
  deviceType: string;
  apiClient: string;
  trafficType: string;
  platform: string;
  channel: string;
  medium: string;
  landingPageType: string;
  landingPagePath: string;
  campaign: string;
  campaignContent: string;
  aiReferral: string;
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

export interface DashboardTrafficSummary {
  available: boolean;
  availableStores: number;
  today: DashboardTrafficMetrics;
  last7Days: DashboardTrafficMetrics;
  last30Days: DashboardTrafficMetrics;
  hourly: DashboardTrafficPoint[];
  daily: DashboardTrafficPoint[];
  sources: DashboardTrafficBreakdown[];
  countries: DashboardTrafficBreakdown[];
  devices: DashboardTrafficBreakdown[];
  trafficTypes: DashboardTrafficBreakdown[];
  platforms: DashboardTrafficBreakdown[];
  browsers: DashboardTrafficBreakdown[];
  landingPages: DashboardTrafficBreakdown[];
  campaigns: DashboardTrafficBreakdown[];
  aiReferrals: DashboardTrafficBreakdown[];
  details: DashboardTrafficDetailRow[];
  detailLimitReached: boolean;
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
