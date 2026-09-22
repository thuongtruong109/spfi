import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateOrderAnalytics,
  aggregatePaymentAnalytics,
  createDashboardPeriod,
} from "../server/utils/dashboard-analytics.ts";
import type {
  ShopifyBalanceTransaction,
  ShopifyOrder,
  ShopifyPayout,
} from "../types/shopify.ts";

test("dashboard periods follow the viewer timezone and start weeks on Monday", () => {
  const period = createDashboardPeriod(new Date("2026-08-10T10:00:00.000Z"), -420);

  assert.equal(period.todayStartIso, "2026-08-09T17:00:00.000Z");
  assert.equal(period.weekStartIso, "2026-08-09T17:00:00.000Z");
  assert.equal(period.monthStartIso, "2026-07-31T17:00:00.000Z");
  assert.equal(period.monthStartKey, "2026-08-01");
  assert.equal(period.todayKey, "2026-08-10");
});

test("dashboard periods use IANA timezone offsets across a DST boundary", () => {
  const period = createDashboardPeriod(
    new Date("2026-03-09T12:00:00.000Z"),
    "America/New_York",
  );

  assert.equal(period.todayStartIso, "2026-03-09T04:00:00.000Z");
  assert.equal(period.weekStartIso, "2026-03-09T04:00:00.000Z");
  assert.equal(period.monthStartIso, "2026-03-01T05:00:00.000Z");
  assert.equal(period.todayKey, "2026-03-09");
});

test("order analytics preserve currencies and rank products by units", () => {
  const period = createDashboardPeriod(new Date("2026-08-10T10:00:00.000Z"), -420);
  const orders = [
    order({
      id: 1,
      created_at: "2026-08-10T01:00:00.000Z",
      total_price: "1000",
      currency: "THB",
      fulfillment_status: null,
      line_items: [
        { id: 1, title: "Green shirt", product_id: 10, quantity: 2, price: "500" },
      ],
    }),
    order({
      id: 2,
      created_at: "2026-08-08T01:00:00.000Z",
      total_price: "500",
      currency: "THB",
      fulfillment_status: "fulfilled",
      line_items: [
        { id: 2, title: "Green shirt", product_id: 10, quantity: 1, price: "500" },
      ],
    }),
    order({
      id: 3,
      created_at: "2026-08-10T02:00:00.000Z",
      total_price: "12",
      currency: "USD",
      fulfillment_status: "partial",
      line_items: [
        { id: 3, title: "Coffee mug", product_id: 20, quantity: 1, price: "12" },
      ],
    }),
    order({
      id: 4,
      created_at: "2026-08-10T03:00:00.000Z",
      total_price: "900",
      currency: "THB",
      cancelled_at: "2026-08-10T04:00:00.000Z",
      line_items: [],
    }),
  ];

  const result = aggregateOrderAnalytics(orders, period);

  assert.deepEqual(result.revenue.today, [
    { currency: "THB", amount: 1000 },
    { currency: "USD", amount: 12 },
  ]);
  assert.deepEqual(result.revenue.month, [
    { currency: "THB", amount: 1500 },
    { currency: "USD", amount: 12 },
  ]);
  assert.equal(result.revenue.orderCountToday, 2);
  assert.deepEqual(result.revenue.currencyCounts, [
    { currency: "THB", today: 1, week: 1, month: 2 },
    { currency: "USD", today: 1, week: 1, month: 1 },
  ]);
  assert.equal(result.revenue.daily.length, 10);
  assert.equal(result.topProducts[0]?.title, "Green shirt");
  assert.equal(result.topProducts[0]?.units, 3);
  assert.deepEqual(result.topProducts[0]?.currencyStats, [
    { currency: "THB", units: 3, count: 2 },
  ]);
  assert.deepEqual(result.fulfillmentBreakdown, {
    fulfilled: 1,
    partial: 1,
    unfulfilled: 1,
  });
});

test("order analytics include authorized revenue and subtract line discounts", () => {
  const period = createDashboardPeriod(
    new Date("2026-08-10T10:00:00.000Z"),
    "Asia/Bangkok",
  );
  const result = aggregateOrderAnalytics(
    [
      order({
        financial_status: "authorized",
        total_price: "15",
        current_total_price: "15",
        currency: "USD",
        line_items: [
          {
            id: 1,
            title: "Discounted item",
            product_id: 10,
            quantity: 2,
            current_quantity: 2,
            price: "10",
            discount_allocations: [{ amount: "5" }],
          },
        ],
      }),
    ],
    period,
  );

  assert.deepEqual(result.revenue.today, [{ currency: "USD", amount: 15 }]);
  assert.deepEqual(result.topProducts[0]?.revenue, [{ currency: "USD", amount: 15 }]);
});

test("financial aggregation avoids binary floating-point drift", () => {
  const period = createDashboardPeriod(new Date("2026-08-10T10:00:00.000Z"), 0);
  const result = aggregateOrderAnalytics(
    [
      order({ id: 1, total_price: "0.1", current_total_price: "0.1" }),
      order({ id: 2, total_price: "0.2", current_total_price: "0.2" }),
    ],
    period,
  );

  assert.deepEqual(result.revenue.month, [{ currency: "USD", amount: 0.3 }]);
});

test("payment analytics exclude tests and transfer rows", () => {
  const payouts: ShopifyPayout[] = [
    {
      id: "1",
      status: "scheduled",
      date: "2026-08-11",
      currency: "USD",
      amount: "80",
      summary: {} as ShopifyPayout["summary"],
    },
    {
      id: "2",
      status: "paid",
      date: "2026-08-09",
      currency: "USD",
      amount: "120",
      summary: {} as ShopifyPayout["summary"],
    },
  ];
  const transactions = [
    transaction({ id: "10", amount: "100", fee: "-3", net: "97" }),
    transaction({ id: "11", amount: "50", fee: "-2", net: "48", test: true }),
    transaction({ id: "12", amount: "-80", fee: "0", net: "-80", type: "payout" }),
  ];

  const result = aggregatePaymentAnalytics(
    { currency: "USD", amount: "45" },
    payouts,
    transactions,
  );

  assert.deepEqual(result.balance, [{ currency: "USD", amount: 45 }]);
  assert.equal(result.payouts.pendingCount, 1);
  assert.deepEqual(result.payouts.currencyCounts, [
    {
      currency: "USD",
      count: 2,
      pendingCount: 1,
      paidCount: 1,
      failedCount: 0,
    },
  ]);
  assert.deepEqual(result.payouts.total, [{ currency: "USD", amount: 200 }]);
  assert.equal(result.transactions.count, 1);
  assert.deepEqual(result.transactions.currencyCounts, [{ currency: "USD", count: 1 }]);
  assert.deepEqual(result.transactions.net, [{ currency: "USD", amount: 97 }]);
});

function order(overrides: Partial<ShopifyOrder>): ShopifyOrder {
  return {
    id: 1,
    name: "#1",
    order_number: 1,
    created_at: "2026-08-10T01:00:00.000Z",
    financial_status: "paid",
    fulfillment_status: null,
    total_price: "0",
    currency: "USD",
    line_items: [],
    ...overrides,
  };
}

function transaction(
  overrides: Partial<ShopifyBalanceTransaction>,
): ShopifyBalanceTransaction {
  return {
    id: "1",
    type: "charge",
    test: false,
    payout_id: null,
    payout_status: "pending",
    currency: "USD",
    amount: "0",
    fee: "0",
    net: "0",
    source_id: null,
    source_type: null,
    source_order_id: null,
    source_order_transaction_id: null,
    processed_at: "2026-08-10T01:00:00.000Z",
    adjustment_order_transactions: [],
    adjustment_reason: null,
    ...overrides,
  };
}
