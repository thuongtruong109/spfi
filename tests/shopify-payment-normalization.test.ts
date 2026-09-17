import assert from "node:assert/strict";
import test from "node:test";
import { normalizeShopifyBalanceTransaction } from "../server/utils/shopify-payment-normalization.ts";

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    id: "9007199254740993",
    type: "charge",
    test: false,
    payout_id: null,
    payout_status: "paid",
    currency: "USD",
    amount: "10.00",
    fee: "1.00",
    net: "9.00",
    source_id: null,
    source_type: null,
    source_order_id: null,
    source_order_transaction_id: null,
    processed_at: "2026-09-17T00:00:00Z",
    adjustment_order_transactions: null,
    adjustment_reason: null,
    ...overrides,
  };
}

test("normalizes nullable REST adjustment orders to an empty list", () => {
  const normalized = normalizeShopifyBalanceTransaction(transaction());

  assert.equal(normalized.id, "9007199254740993");
  assert.deepEqual(normalized.adjustment_order_transactions, []);
});

test("normalizes the REST adjustment fees field without changing IDs", () => {
  const normalized = normalizeShopifyBalanceTransaction(
    transaction({
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
    }),
  );

  assert.deepEqual(normalized.adjustment_order_transactions, [
    {
      id: "9007199254740995",
      amount: "10.00",
      fee: "1.25",
      net: "8.75",
      order: { id: "9007199254740997", name: "#1001" },
    },
  ]);
});

test("rejects a null balance transaction with a controlled upstream error", () => {
  assert.throws(
    () => normalizeShopifyBalanceTransaction(null),
    (error: unknown) =>
      isStatusError(error, 502, "transaction must be an object"),
  );
});

test("rejects null adjustment entries", () => {
  assert.throws(
    () =>
      normalizeShopifyBalanceTransaction(
        transaction({ adjustment_order_transactions: [null] }),
      ),
    (error: unknown) =>
      isStatusError(
        error,
        502,
        "adjustment_order_transactions[0] must be an object",
      ),
  );
});

for (const invalidOrder of [undefined, null]) {
  test(`rejects adjustments with ${String(invalidOrder)} orders`, () => {
    assert.throws(
      () =>
        normalizeShopifyBalanceTransaction(
          transaction({
            adjustment_order_transactions: [
              {
                id: "2",
                amount: "1.00",
                fees: "0.10",
                net: "0.90",
                order: invalidOrder,
              },
            ],
          }),
        ),
      (error: unknown) =>
        isStatusError(
          error,
          502,
          "adjustment_order_transactions[0].order must be an object",
        ),
    );
  });
}

test("rejects adjustment fields with invalid runtime types", () => {
  assert.throws(
    () =>
      normalizeShopifyBalanceTransaction(
        transaction({
          adjustment_order_transactions: [
            {
              id: "2",
              amount: "1.00",
              fees: { amount: "0.10" },
              net: "0.90",
              order: { id: null, name: "#1001" },
            },
          ],
        }),
      ),
    (error: unknown) =>
      isStatusError(
        error,
        502,
        "adjustment_order_transactions[0].fee must be a non-empty string",
      ),
  );
});

test("rejects invalid root fields before they reach the UI", () => {
  assert.throws(
    () => normalizeShopifyBalanceTransaction(transaction({ test: "false" })),
    (error: unknown) => isStatusError(error, 502, "test must be a boolean"),
  );
});

function isStatusError(error: unknown, statusCode: number, message: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { statusCode?: number; statusMessage?: string };
  return (
    candidate.statusCode === statusCode &&
    Boolean(candidate.statusMessage?.includes(message))
  );
}
