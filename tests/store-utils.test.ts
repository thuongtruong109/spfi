import assert from "node:assert/strict";
import test from "node:test";
import { ref } from "vue";
import { usePerStoreCache } from "../app/composables/usePerStoreCache.ts";
import { fmtMoney, formatMoneyInput } from "../utils/order.ts";
import {
  buildOrderTransactionStatusMap,
  getAdjustmentOrderTransactions,
} from "../utils/payment-transactions.ts";
import { getStoreTokenState, resolveStoreAccessToken } from "../utils/shop-auth.ts";

test("store token resolver applies one expiry policy", () => {
  const now = 10_000;
  assert.equal(getStoreTokenState({}, now), "missing");
  assert.equal(getStoreTokenState({ accessToken: "legacy-token" }, now), "valid");
  assert.equal(
    getStoreTokenState({ accessToken: "expired", expiresTime: now }, now),
    "expired",
  );
  assert.equal(
    resolveStoreAccessToken(
      { accessToken: " valid-token ", expiresTime: now + 1 },
      now,
    ),
    "valid-token",
  );
});

test("money formatting honors ISO currency fraction digits", () => {
  assert.equal(formatMoneyInput(1234.4, "JPY"), "1234");
  assert.equal(formatMoneyInput(1.2344, "KWD"), "1.234");
  assert.equal(formatMoneyInput(1.2344, "IQD"), "1.234");
  assert.equal(fmtMoney(1234, "JPY"), "JPY 1,234");
  assert.equal(fmtMoney(1.234, "KWD"), "KWD 1.234");
});

test("transaction status lookup uses an order-indexed map", () => {
  const statuses = buildOrderTransactionStatusMap([
    { source_order_id: 42, payout_status: "in_transit" },
    { source_order_id: 43, payout_status: "paid" },
  ]);

  assert.equal(statuses.get("42"), "in_transit");
  assert.equal(statuses.get("43"), "paid");
});

test("adjustment order lookup tolerates nullable REST data", () => {
  assert.deepEqual(
    getAdjustmentOrderTransactions({ adjustment_order_transactions: null }),
    [],
  );
});

test("per-store cache restores and evicts isolated snapshots", () => {
  const value = ref(0);
  const cache = usePerStoreCache({
    capture: () => ({ value: value.value }),
    restore: (snapshot) => {
      value.value = snapshot.value;
    },
    reset: () => {
      value.value = 0;
    },
  });

  cache.activate("a");
  value.value = 7;
  cache.remember();
  value.value = 9;
  assert.equal(cache.hydrate("a"), true);
  assert.equal(value.value, 7);
  cache.evict("a");
  assert.equal(value.value, 0);
  assert.equal(cache.hydrate("a"), false);
});

test("per-store cache evicts the least recently used inactive store", () => {
  let value = 0;
  const cache = usePerStoreCache({
    capture: () => value,
    restore: (snapshot) => {
      value = snapshot;
    },
    reset: () => {
      value = 0;
    },
    maxEntries: 2,
  });

  cache.set("alpha", 1);
  cache.set("beta", 2);
  assert.equal(cache.get("alpha"), 1);
  cache.set("gamma", 3);

  assert.equal(cache.get("beta"), undefined);
  assert.equal(cache.get("alpha"), 1);
  assert.equal(cache.get("gamma"), 3);
});
