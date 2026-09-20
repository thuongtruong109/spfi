import assert from "node:assert/strict";
import test from "node:test";
import type { StoreDashboardSnapshot } from "../types/dashboard.ts";
import {
  aggregateDashboardSnapshots,
  filterDashboardAggregateCurrency,
} from "../utils/dashboard-aggregate.ts";
import {
  createDashboardTrafficAvailability,
  createTrafficMetrics,
  emptyDashboardTraffic,
} from "../utils/dashboard-traffic.ts";

test("all-store aggregation sums matching currencies without mixing them", () => {
  const result = aggregateDashboardSnapshots([
    snapshot("alpha", "THB", 1200),
    snapshot("beta", "USD", 45),
    snapshot("gamma", "THB", 300),
  ]);

  assert.deepEqual(result.revenue.month, [
    { currency: "THB", amount: 1500 },
    { currency: "USD", amount: 45 },
  ]);
  assert.equal(result.revenue.orderCountMonth, 3);
  assert.equal(result.customerCount, 30);
  assert.equal(result.pendingFulfillmentCount, 6);
  assert.equal(result.topProducts[0]?.storeId, "alpha");
  assert.deepEqual(result.payments.balance, [
    { currency: "THB", amount: 100 },
    { currency: "USD", amount: 50 },
  ]);
  assert.equal(result.traffic.availableStores, 3);
  assert.equal(result.traffic.today.sessions, 1545);
  assert.equal(result.traffic.last30Days.visitors, 1545);
  assert.equal(result.traffic.sources[0]?.sessions, 1545);
});

test("currency filtering recalculates counts, rankings, and money series", () => {
  const aggregate = aggregateDashboardSnapshots([
    snapshot("alpha", "THB", 1200),
    snapshot("beta", "USD", 45),
  ]);
  const result = filterDashboardAggregateCurrency(aggregate, " usd ");

  assert.deepEqual(result.revenue.month, [{ currency: "USD", amount: 45 }]);
  assert.deepEqual(result.revenue.daily[0]?.values, [{ currency: "USD", amount: 45 }]);
  assert.equal(result.revenue.orderCountMonth, 1);
  assert.equal(result.revenue.daily[0]?.orders, 1);
  assert.equal(result.topProducts.length, 1);
  assert.equal(result.topProducts[0]?.storeId, "beta");
  assert.deepEqual(result.topProducts[0]?.revenue, [{ currency: "USD", amount: 45 }]);
  assert.equal(result.pendingOrders.length, 1);
  assert.equal(result.pendingOrders[0]?.storeId, "beta");
  assert.equal(result.pendingFulfillmentCount, 2);
  assert.equal(result.payments.availableStores, 1);
  assert.equal(result.payments.payouts.count, 1);
  assert.equal(result.payments.transactions.count, 1);
  assert.equal(result.customerCount, 20);
  assert.strictEqual(filterDashboardAggregateCurrency(aggregate, " ALL "), aggregate);
});

test("traffic reporting denominator includes dashboard request failures", () => {
  const reportingStore = snapshot("alpha", "USD", 10);
  for (const range of ["24h", "7d", "30d"] as const) {
    reportingStore.traffic.rangeData[range].availability = {
      metrics: "available",
      trend: "available",
      sources: "available",
      countries: "available",
      devices: "available",
    };
  }

  const result = aggregateDashboardSnapshots(
    [reportingStore],
    [
      {
        storeId: "beta",
        label: "beta.myshopify.com",
        reason: "request-failed",
        message: "Dashboard request failed.",
      },
    ],
  );

  assert.equal(result.traffic.availableStores, 1);
  assert.equal(result.traffic.reporting.reportingStores, 1);
  assert.equal(result.traffic.reporting.totalStores, 2);
  assert.deepEqual(result.traffic.reporting.coverage["24h"].sources, {
    reportingStores: 1,
    totalStores: 2,
  });
  assert.equal(result.traffic.availability.sources24Hours, "partial");
  assert.equal(result.traffic.reporting.stores[0]?.storeId, "beta");
  assert.equal(result.traffic.reporting.stores[0]?.status, "failed");
});

function snapshot(
  storeId: string,
  currency: string,
  revenueAmount: number,
): StoreDashboardSnapshot {
  return {
    storeId,
    storeName: storeId,
    domain: `${storeId}.myshopify.com`,
    currency,
    owner: "Owner",
    email: `${storeId}@example.com`,
    plan: "Shopify",
    generatedAt: "2026-08-10T00:00:00.000Z",
    revenue: {
      today: [{ currency, amount: revenueAmount }],
      week: [{ currency, amount: revenueAmount }],
      month: [{ currency, amount: revenueAmount }],
      orderCountToday: 1,
      orderCountWeek: 1,
      orderCountMonth: 1,
      currencyCounts: [{ currency, today: 1, week: 1, month: 1 }],
      daily: [
        {
          date: "2026-08-10",
          orders: 1,
          orderCounts: [{ currency, count: 1 }],
          values: [{ currency, amount: revenueAmount }],
        },
      ],
    },
    fulfillmentBreakdown: { fulfilled: 1, partial: 0, unfulfilled: 1 },
    pendingFulfillments: {
      count: 2,
      currencyCounts: [{ currency, count: 2 }],
      orders: [
        {
          id: `${storeId}-order`,
          name: `#${storeId}`,
          createdAt: "2026-08-10T00:00:00.000Z",
          fulfillmentStatus: "unfulfilled",
          amount: revenueAmount,
          currency,
        },
      ],
    },
    topProducts: [
      {
        key: "product",
        productId: "1",
        title: `${storeId} product`,
        units: revenueAmount,
        orders: 1,
        currencyStats: [{ currency, units: revenueAmount, count: 1 }],
        revenue: [{ currency, amount: revenueAmount }],
      },
    ],
    productCount: 5,
    customerCount: 10,
    payments: {
      available: true,
      currencies: [currency],
      balance: [{ currency, amount: 50 }],
      payouts: {
        count: 1,
        pendingCount: 1,
        paidCount: 0,
        failedCount: 0,
        currencyCounts: [
          {
            currency,
            count: 1,
            pendingCount: 1,
            paidCount: 0,
            failedCount: 0,
          },
        ],
        total: [{ currency, amount: 25 }],
        pending: [{ currency, amount: 25 }],
      },
      transactions: {
        count: 1,
        currencyCounts: [{ currency, count: 1 }],
        gross: [{ currency, amount: 20 }],
        fees: [{ currency, amount: -1 }],
        net: [{ currency, amount: 19 }],
        recent: [
          {
            id: `${storeId}-transaction`,
            type: "charge",
            processedAt: "2026-08-10T00:00:00.000Z",
            amount: 20,
            fee: -1,
            net: 19,
            currency,
            orderName: `#${storeId}`,
          },
        ],
      },
    },
    traffic: {
      ...emptyDashboardTraffic(),
      available: true,
      availableStores: 1,
      timeZone: "Etc/UTC",
      timeZoneMode: "store",
      availability: createDashboardTrafficAvailability("available"),
      today: createTrafficMetrics({
        sessions: revenueAmount,
        visitors: revenueAmount,
        pageviews: revenueAmount * 2,
        bounces: revenueAmount / 2,
        completedCheckouts: 1,
        averageSessionDuration: 60,
      }),
      last7Days: createTrafficMetrics({
        sessions: revenueAmount,
        visitors: revenueAmount,
        pageviews: revenueAmount * 2,
      }),
      last30Days: createTrafficMetrics({
        sessions: revenueAmount,
        visitors: revenueAmount,
        pageviews: revenueAmount * 2,
      }),
      hourly: [
        {
          period: "2026-08-10T00",
          sessions: revenueAmount,
          visitors: revenueAmount,
          pageviews: revenueAmount * 2,
        },
      ],
      daily: [
        {
          period: "2026-08-10",
          sessions: revenueAmount,
          visitors: revenueAmount,
          pageviews: revenueAmount * 2,
        },
      ],
      sources: [{ label: "Search", sessions: revenueAmount, visitors: revenueAmount }],
      countries: [{ label: "US", sessions: revenueAmount, visitors: revenueAmount }],
      devices: [{ label: "Mobile", sessions: revenueAmount, visitors: revenueAmount }],
    },
    users: [],
    warnings: [],
  };
}
