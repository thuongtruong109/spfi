import type { H3Event } from "h3";
import type { DashboardWarning, StoreDashboardSnapshot } from "~~/types/dashboard";
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
import { fetchShopifyPaymentsBalanceTransactions } from "./shopify-payments-graphql";
import { fetchShopifyTraffic } from "./shopify-traffic";
import { emptyDashboardTraffic } from "~~/utils/dashboard-traffic";
import {
  aggregateOrderAnalytics,
  aggregatePaymentAnalytics,
  createDashboardPeriod,
  emptyPayoutSummary,
  emptyTransactionSummary,
  mapDashboardUsers,
  mapPendingOrders,
} from "./dashboard-analytics";

interface DashboardRequestContext {
  event: H3Event;
  storeId: string;
  token: string;
  timezoneOffsetMinutes?: number;
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
}: DashboardRequestContext): Promise<StoreDashboardSnapshot> {
  const common = { event, storeId, token };
  const warnings: DashboardWarning[] = [];
  const [profileResult] = await Promise.allSettled([
    callShopifyApi<{ shop?: ShopifyShop }>({
      ...common,
      path: "/shop.json",
      forwardResponseHeaders: false,
    }),
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
    fetchOrderCount(common),
    fetchPendingOrders(common),
    callShopifyApi<CustomerCountResponse>({
      ...common,
      path: "/customers/count.json",
      forwardResponseHeaders: false,
    }),
    callShopifyApi<ProductCountResponse>({
      ...common,
      path: "/products/count.json",
      forwardResponseHeaders: false,
    }),
    callShopifyApi<BalanceResponse>({
      ...common,
      path: "/shopify_payments/balance.json",
      forwardResponseHeaders: false,
    }),
    callShopifyPaginatedApi<ShopifyPayout>({
      ...common,
      path: "/shopify_payments/payouts.json",
      resourceKey: "payouts",
      params: { date_min: period.monthStartKey },
      preserveUnsafeIntegers: true,
      forwardResponseHeaders: false,
    }),
    fetchShopifyPaymentsBalanceTransactions(common, {
      processed_at_min: period.monthStartKey,
      processed_at_max: period.todayKey,
      test: false,
      hide_transfers: true,
    }),
    callShopifyPaginatedApi<UsersResponseItem>({
      ...common,
      path: "/users.json",
      resourceKey: "users",
      preserveUnsafeIntegers: true,
      forwardResponseHeaders: false,
    }),
    fetchShopifyTraffic(common),
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

  const paymentResultsAvailable = [
    balanceResult,
    payoutsResult,
    transactionsResult,
  ].some((result) => result.status === "fulfilled");
  if (!paymentResultsAvailable) {
    addWarning(warnings, {
      resource: "payments",
      message: "Shopify Payments data is unavailable or not enabled for this store.",
    });
  } else if (
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
  if (usersResult.status === "rejected") {
    addWarning(warnings, {
      resource: "users",
      message: "Staff access is restricted; showing the store owner profile instead.",
    });
  }

  const traffic =
    trafficResult.status === "fulfilled"
      ? trafficResult.value
      : emptyDashboardTraffic();
  if (trafficResult.status === "rejected") {
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

  return {
    storeId,
    storeName: String(profile?.name || domain || storeId),
    domain,
    currency: storeCurrency,
    owner: String(profile?.shop_owner || ""),
    email: String(profile?.email || profile?.customer_email || ""),
    plan: String(profile?.plan_display_name || profile?.plan_name || ""),
    generatedAt: period.nowIso,
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
    traffic,
    users: mapDashboardUsers(users, profile || null),
    warnings,
  };
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
