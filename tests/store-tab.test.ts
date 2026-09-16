import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_STORE_TAB, resolveStoreTab, STORE_TABS } from "../types/store.ts";

test("resolveStoreTab keeps every supported tab", () => {
  for (const tab of STORE_TABS) {
    assert.equal(resolveStoreTab(tab), tab);
  }
});

test("resolveStoreTab uses transactions for missing or invalid query values", () => {
  assert.equal(DEFAULT_STORE_TAB, "transactions");
  assert.equal(resolveStoreTab(undefined), DEFAULT_STORE_TAB);
  assert.equal(resolveStoreTab("unknown"), DEFAULT_STORE_TAB);
  assert.equal(resolveStoreTab([]), DEFAULT_STORE_TAB);
});

test("resolveStoreTab accepts the first value from repeated query params", () => {
  assert.equal(resolveStoreTab(["products", "orders"]), "products");
});

test("resolveStoreTab recognizes the Shopify Markets view", () => {
  assert.equal(resolveStoreTab("markets"), "markets");
  assert.ok(STORE_TABS.includes("markets"));
});

test("resolveStoreTab recognizes the per-store traffic view", () => {
  assert.equal(resolveStoreTab("traffic"), "traffic");
  assert.ok(STORE_TABS.includes("traffic"));
});
