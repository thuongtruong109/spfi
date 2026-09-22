import type { H3Event } from "h3";
import type {
  DashboardService,
  DashboardWarning,
  StoreDashboardSnapshot,
} from "~~/types/dashboard";
import type {
  ShopifyBalance,
  ShopifyBalanceTransaction,
  ShopifyOrder,
  ShopifyPayout,
  ShopifyShop,
} from "~~/types/shopify";
import type { OrderCountResponse } from "~~/types/shopify-order";
import type { ProductCountResponse } from "~~/types/shopify-product";
import type { CustomerCountResponse } from "~~/types/shopify-customer";
import {
  callShopifyApi,
  resolveStoreDomain,
  resolveStoreCookieData,
} from "./callShopifyApi";
import { callShopifyPaginatedApi } from "./callShopifyPaginatedApi";
import { fetchAllShopifyPaymentsBalanceTransactions } from "./shopify-payments-graphql";
import { fetchShopifyTraffic } from "./shopify-traffic";
import {
  emptyDashboardTraffic,
  failedDashboardTraffic,
} from "~~/utils/dashboard-traffic";
import { normalizeDashboardServices } from "~~/utils/dashboard-load";
import {
  aggregateOrderAnalytics,
  aggregatePaymentAnalytics,
  createDashboardPeriod,
  emptyPayoutSummary,
  emptyTransactionSummary,
  mapDashboardUsers,
  mapPendingOrders,
} from "./dashboard-analytics";
import { buildDashboardReconciliation } from "~~/utils/dashboard-reconciliation";

interface DashboardRequestContext {
  event: H3Event;
  storeId: string;
  token: string;
  timezoneOffsetMinutes?: number;
  services?: DashboardService[];
  refresh?: boolean;
}

interface BalanceResponse {
  balance?: ShopifyBalance | ShopifyBalance[];
}

interface OrdersResponse {
  orders?: ShopifyOrder[];
}

interface UsersResponseItem {
  id?: string | number;
  first_name?: string;
  last_name?: string;
  email?: string;
  account_owner?: boolean;
  permissions?: string[];
  user_type?: string;
}

export async function fetchStoreDashboard({
  event,
  storeId,
  token,
  timezoneOffsetMinutes = 0,
  services,
  refresh = false,
}: DashboardRequestContext): Promise<StoreDashboardSnapshot> {
  const common = { event, storeId, token };
  const warnings: DashboardWarning[] = [];
  const enabledServices = new Set(normalizeDashboardServices(services));
  const [profileResult] = await Promise.allSettled([
    loadDashboardService(
      enabledServices.has("profile"),
      () =>
        callShopifyApi<{ shop?: ShopifyShop }>({
          ...common,
          path: "/shop.json",
          forwardResponseHeaders: false,
        }),
      { shop: undefined },
    ),
  ]);
  const profile = settledValue(profileResult, { shop: undefined }, warnings, {
    resource: "profile",
    message: "Shop profile is temporarily unavailable.",
  }).shop;
  const period = createDashboardPeriod(
    new Date(),
    profile?.iana_timezone || timezoneOffsetMinutes,
    timezoneOffsetMinutes,
  );

  const [
    ordersResult,
    pendingCountResult,
    pendingOrdersResult,
    customerCountResult,
    productCountResult,
    balanceResult,
    payoutsResult,
    transactionsResult,
    usersResult,
    trafficResult,
  ] = await Promise.allSettled([
    loadDashboardService(
      enabledServices.has("orders"),
      () =>
        callShopifyPaginatedApi<ShopifyOrder>({
          ...common,
          path: "/orders.json",
          resourceKey: "orders",
          params: {
            status: "any",
            created_at_min: period.monthStartIso,
            fields:
              "id,name,order_number,created_at,cancelled_at,financial_status,fulfillment_status,total_price,current_total_price,currency,test,line_items",
          },
          preserveUnsafeIntegers: true,
          forwardResponseHeaders: false,
        }),
      [],
    ),
    loadDashboardService(enabledServices.has("orders"), () => fetchOrderCount(common), {
      count: 0,
    }),
    loadDashboardService(
      enabledServices.has("orders"),
      () => fetchPendingOrders(common),
      { orders: [] },
    ),
    loadDashboardService(
      enabledServices.has("customers"),
      () =>
        callShopifyApi<CustomerCountResponse>({
          ...common,
          path: "/customers/count.json",
          forwardResponseHeaders: false,
        }),
      { count: 0 },
    ),
    loadDashboardService(
      enabledServices.has("products"),
      () =>
        callShopifyApi<ProductCountResponse>({
          ...common,
          path: "/products/count.json",
          forwardResponseHeaders: false,
        }),
      { count: 0 },
    ),
    loadDashboardService(
      enabledServices.has("payments"),
      () =>
        callShopifyApi<BalanceResponse>({
          ...common,
          path: "/shopify_payments/balance.json",
          forwardResponseHeaders: false,
        }),
      { balance: undefined },
    ),
    loadDashboardService(
      enabledServices.has("payments"),
      () =>
        callShopifyPaginatedApi<ShopifyPayout>({
          ...common,
          path: "/shopify_payments/payouts.json",
          resourceKey: "payouts",
          params: { date_min: period.monthStartKey },
          preserveUnsafeIntegers: true,
          forwardResponseHeaders: false,
        }),
      [],
    ),
    loadDashboardService(
      enabledServices.has("payments"),
      () =>
        fetchAllShopifyPaymentsBalanceTransactions(common, {
          processed_at_min: period.monthStartKey,
          processed_at_max: period.todayKey,
          test: false,
          hide_transfers: true,
        }),
      [],
    ),
    loadDashboardService(
      enabledServices.has("users"),
      () =>
        callShopifyPaginatedApi<UsersResponseItem>({
          ...common,
          path: "/users.json",
          resourceKey: "users",
          preserveUnsafeIntegers: true,
          forwardResponseHeaders: false,
        }),
      [],
    ),
    loadDashboardService(
      enabledServices.has("traffic"),
      () =>
        fetchShopifyTraffic({
          ...common,
          timeZone: profile?.iana_timezone,
          refresh,
        }),
      emptyDashboardTraffic(),
    ),
  ]);

  const monthOrders = settledValue(ordersResult, [], warnings, {
    resource: "orders",
    message: "Revenue and product rankings could not be refreshed.",
  });
  const pendingCount = settledValue(pendingCountResult, { count: 0 }, warnings, {
    resource: "fulfillments",
    message: "The pending fulfillment count is unavailable.",
  }).count;
  const pendingOrders = (
    settledValue(pendingOrdersResult, { orders: [] }, warnings, {
      resource: "fulfillments",
      message: "Pending fulfillment previews are unavailable.",
    }).orders || []
  )
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 12);
  const customerCount = settledValue(customerCountResult, { count: 0 }, warnings, {
    resource: "customers",
    message: "Customer total could not be refreshed.",
  }).count;
  const productCount = settledValue(productCountResult, { count: 0 }, warnings, {
    resource: "products",
    message: "Product total could not be refreshed.",
  }).count;

  const paymentsEnabled = enabledServices.has("payments");
  const paymentResultsAvailable =
    paymentsEnabled &&
    [balanceResult, payoutsResult, transactionsResult].some(
      (result) => result.status === "fulfilled",
    );
  if (paymentsEnabled && !paymentResultsAvailable) {
    addWarning(warnings, {
      resource: "payments",
      message: "Shopify Payments data is unavailable or not enabled for this store.",
    });
  } else if (
    paymentsEnabled &&
    [balanceResult, payoutsResult, transactionsResult].some(
      (result) => result.status === "rejected",
    )
  ) {
    addWarning(warnings, {
      resource: "payments",
      message: "Some Shopify Payments metrics are unavailable.",
    });
  }

  const balance =
    balanceResult.status === "fulfilled" ? balanceResult.value.balance : null;
  const payouts = payoutsResult.status === "fulfilled" ? payoutsResult.value : [];
  const transactions: ShopifyBalanceTransaction[] =
    transactionsResult.status === "fulfilled" ? transactionsResult.value : [];
  const paymentAnalytics = paymentResultsAvailable
    ? aggregatePaymentAnalytics(balance, payouts, transactions)
    : {
        balance: [],
        payouts: emptyPayoutSummary(),
        transactions: emptyTransactionSummary(),
      };

  const users = usersResult.status === "fulfilled" ? usersResult.value : [];
  if (enabledServices.has("users") && usersResult.status === "rejected") {
    addWarning(warnings, {
      resource: "users",
      message: "Staff access is restricted; showing the store owner profile instead.",
    });
  }

  const traffic =
    trafficResult.status === "fulfilled"
      ? trafficResult.value
      : enabledServices.has("traffic")
        ? failedDashboardTraffic()
        : emptyDashboardTraffic();
  if (enabledServices.has("traffic") && trafficResult.status === "rejected") {
    addWarning(warnings, {
      resource: "traffic",
      message:
        "Traffic analytics are unavailable. Verify read_reports and Level 2 protected customer data access.",
    });
  }

  const orderAnalytics = aggregateOrderAnalytics(monthOrders, period);
  const storeCookie = resolveStoreCookieData(event, storeId);
  const domain = resolveStoreDomain(storeId, storeCookie?.domain);
  const storeCurrency = String(profile?.currency || monthOrders[0]?.currency || "USD")
    .trim()
    .toUpperCase();
  const paymentCurrencies = Array.from(
    new Set([
      ...paymentAnalytics.balance.map((row) => row.currency),
      ...paymentAnalytics.payouts.currencyCounts.map((row) => row.currency),
      ...paymentAnalytics.transactions.currencyCounts.map((row) => row.currency),
    ]),
  ).sort();
  const ordersAvailable =
    enabledServices.has("orders") && ordersResult.status === "fulfilled";
  const reconciliation = buildDashboardReconciliation(
    orderAnalytics.revenue.month,
    paymentAnalytics.transactions.gross,
    ordersAvailable &&
      enabledServices.has("payments") &&
      transactionsResult.status === "fulfilled",
    period.nowIso,
  );

  return {
    storeId,
    storeName: String(profile?.name || domain || storeId),
    domain,
    currency: storeCurrency,
    owner: String(profile?.shop_owner || ""),
    email: String(profile?.email || profile?.customer_email || ""),
    plan: String(profile?.plan_display_name || profile?.plan_name || ""),
    generatedAt: period.nowIso,
    resources: {
      profile: resourceFreshness(
        enabledServices.has("profile"),
        [profileResult],
        period.nowIso,
      ),
      orders: resourceFreshness(
        enabledServices.has("orders"),
        [ordersResult, pendingCountResult, pendingOrdersResult],
        period.nowIso,
      ),
      customers: resourceFreshness(
        enabledServices.has("customers"),
        [customerCountResult],
        period.nowIso,
      ),
      products: resourceFreshness(
        enabledServices.has("products"),
        [productCountResult],
        period.nowIso,
      ),
      payments: resourceFreshness(
        enabledServices.has("payments"),
        [balanceResult, payoutsResult, transactionsResult],
        period.nowIso,
      ),
      users: resourceFreshness(
        enabledServices.has("users"),
        [usersResult],
        period.nowIso,
      ),
      traffic: resourceFreshness(
        enabledServices.has("traffic"),
        [trafficResult],
        traffic.generatedAt || period.nowIso,
        traffic.isStale,
        traffic.available,
      ),
    },
    revenue: orderAnalytics.revenue,
    fulfillmentBreakdown: orderAnalytics.fulfillmentBreakdown,
    pendingFulfillments: {
      count: Number(pendingCount || 0),
      currencyCounts: [{ currency: storeCurrency, count: Number(pendingCount || 0) }],
      orders: mapPendingOrders(pendingOrders),
    },
    topProducts: orderAnalytics.topProducts,
    productCount: Number(productCount || 0),
    customerCount: Number(customerCount || 0),
    payments: {
      available: paymentResultsAvailable,
      currencies: paymentCurrencies,
      ...paymentAnalytics,
    },
    reconciliation,
    traffic,
    users: enabledServices.has("users")
      ? mapDashboardUsers(users, profile || null)
      : [],
    warnings,
  };
}

function resourceFreshness(
  enabled: boolean,
  results: PromiseSettledResult<unknown>[],
  dataAsOf: string,
  stale = false,
  available = true,
) {
  if (!enabled) return { state: "unavailable" as const, dataAsOf: null };
  if (results.some((result) => result.status === "rejected")) {
    const hasFulfilledResult = results.some((result) => result.status === "fulfilled");
    return {
      state: hasFulfilledResult ? ("partial" as const) : ("failed" as const),
      dataAsOf: hasFulfilledResult ? dataAsOf : null,
    };
  }
  if (!available) return { state: "unavailable" as const, dataAsOf: null };
  return { state: stale ? ("stale" as const) : ("available" as const), dataAsOf };
}

function loadDashboardService<T>(
  enabled: boolean,
  load: () => Promise<T>,
  fallback: T,
) {
  return enabled ? load() : Promise.resolve(fallback);
}

function fetchOrderCount(
  common: Pick<DashboardRequestContext, "event" | "storeId" | "token">,
) {
  return callShopifyApi<OrderCountResponse>({
    ...common,
    path: "/orders/count.json",
    params: { status: "open", fulfillment_status: "unfulfilled" },
    forwardResponseHeaders: false,
  });
}

function fetchPendingOrders(
  common: Pick<DashboardRequestContext, "event" | "storeId" | "token">,
) {
  return callShopifyApi<OrdersResponse>({
    ...common,
    path: "/orders.json",
    params: {
      status: "open",
      fulfillment_status: "unfulfilled",
      limit: 12,
      fields:
        "id,name,order_number,created_at,fulfillment_status,total_price,current_total_price,currency",
    },
    preserveUnsafeIntegers: true,
    forwardResponseHeaders: false,
  });
}

function settledValue<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  warnings: DashboardWarning[],
  warning: DashboardWarning,
) {
  if (result.status === "fulfilled") return result.value;
  addWarning(warnings, warning);
  return fallback;
}

function addWarning(warnings: DashboardWarning[], warning: DashboardWarning) {
  if (
    !warnings.some(
      (item) => item.resource === warning.resource && item.message === warning.message,
    )
  ) {
    warnings.push(warning);
  }
}
