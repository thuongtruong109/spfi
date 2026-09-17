import assert from "node:assert/strict";
import test from "node:test";
import { normalizeShopifyBalanceTransaction } from "../server/utils/shopify-payment-normalization.ts";

test("normalizes nullable REST adjustment orders to an empty list", () => {
  const transaction = normalizeShopifyBalanceTransaction({
    id: "9007199254740993",
    type: "charge",
    adjustment_order_transactions: null,
  });

  assert.equal(transaction.id, "9007199254740993");
  assert.deepEqual(transaction.adjustment_order_transactions, []);
});

test("normalizes the REST adjustment fees field without changing IDs", () => {
  const transaction = normalizeShopifyBalanceTransaction({
    id: "9007199254740993",
    type: "adjustment",
    adjustment_order_transactions: [
      {
        id: "9007199254740995",
        amount: "10.00",
        fees: "1.25",
        net: "8.75",
        order: { id: "9007199254740997", name: "#1001" },
      },
    ],
  });

  assert.deepEqual(transaction.adjustment_order_transactions, [
    {
      id: "9007199254740995",
      amount: "10.00",
      fee: "1.25",
      net: "8.75",
      order: { id: "9007199254740997", name: "#1001" },
    },
  ]);
});
