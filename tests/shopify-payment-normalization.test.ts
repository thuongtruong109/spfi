import assert from "node:assert/strict";
import test from "node:test";
import { ShopifyContractError } from "../server/utils/shopify-contract-error.ts";
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
    (error: unknown) => isStatusError(error, 502, "transaction must be an object"),
  );
});

test("rejects null adjustment entries", () => {
  assert.throws(
    () =>
      normalizeShopifyBalanceTransaction(
        transaction({ adjustment_order_transactions: [null] }),
      ),
    (error: unknown) =>
      isStatusError(error, 502, "adjustment_order_transactions[0] must be an object"),
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
        "adjustment_order_transactions[0].fees must be a non-empty string",
      ),
  );
});

test("rejects invalid root fields before they reach the UI", () => {
  assert.throws(
    () => normalizeShopifyBalanceTransaction(transaction({ test: "false" })),
    (error: unknown) => isStatusError(error, 502, "test must be a boolean"),
  );
});

for (const adjustments of [undefined, null, []]) {
  test(`accepts absent or empty adjustment lists (${String(adjustments)})`, () => {
    assert.deepEqual(
      normalizeShopifyBalanceTransaction(
        transaction({ adjustment_order_transactions: adjustments }),
      ).adjustment_order_transactions,
      [],
    );
  });
}

for (const adjustments of [{}, "invalid", false, 0]) {
  test(`rejects a non-array adjustment list (${String(adjustments)})`, () => {
    assert.throws(
      () =>
        normalizeShopifyBalanceTransaction(
          transaction({ adjustment_order_transactions: adjustments }),
        ),
      (error: unknown) => isStatusError(error, 502, "must be an array or null"),
    );
  });
}

function adjustment(overrides: Record<string, unknown> = {}) {
  return {
    id: "2",
    amount: "10.00",
    fee: "1.25",
    net: "8.75",
    order: { id: "3", name: "#1001" },
    ...overrides,
  };
}

for (const [fields, expectedFee] of [
  [{ fee: "1.25" }, "1.25"],
  [{ fee: undefined, fees: "1.25" }, "1.25"],
  [{ fee: null, fees: "1.25" }, "1.25"],
  [{ fee: "0.00", fees: "1.25" }, "0.00"],
] as const) {
  test(`normalizes fee aliases ${JSON.stringify(fields)}`, () => {
    const result = normalizeShopifyBalanceTransaction(
      transaction({
        adjustment_order_transactions: [adjustment(fields)],
      }),
    );
    assert.equal(result.adjustment_order_transactions[0]?.fee, expectedFee);
  });
}

for (const fields of [
  { fee: undefined },
  { fee: null, fees: null },
  { fee: 0 },
  { fee: "NaN" },
  { fee: "1.25", fees: {} },
  { amount: 10 },
  { net: [] },
  { id: Number.MAX_SAFE_INTEGER + 1 },
  { order: [] },
  { order: { id: {}, name: "#1001" } },
  { order: { id: "3", name: null } },
]) {
  test(`rejects malformed adjustment fields ${JSON.stringify(fields)}`, () => {
    assert.throws(
      () =>
        normalizeShopifyBalanceTransaction(
          transaction({
            adjustment_order_transactions: [adjustment(fields)],
          }),
        ),
      (error: unknown) => {
        assert.ok(error instanceof ShopifyContractError);
        assert.equal(error.statusCode, 502);
        assert.equal(error.data.success, false);
        assert.equal(error.data.error.code, "SHOPIFY_RESPONSE_CONTRACT_ERROR");
        assert.equal(error.data.error.status, 502);
        return true;
      },
    );
  });
}

for (const value of [undefined, [], "invalid", 1, false]) {
  test(`rejects a non-record transaction (${String(value)})`, () => {
    assert.throws(
      () => normalizeShopifyBalanceTransaction(value),
      (error: unknown) => isStatusError(error, 502, "transaction must be an object"),
    );
  });
}

function isStatusError(error: unknown, statusCode: number, message: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { statusCode?: number; statusMessage?: string };
  return (
    candidate.statusCode === statusCode &&
    Boolean(candidate.statusMessage?.includes(message))
  );
}
