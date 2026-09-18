import assert from "node:assert/strict";
import test from "node:test";
import { DASHBOARD_SERVICES } from "../types/dashboard.ts";
import {
  isDashboardServiceList,
  normalizeDashboardServices,
  normalizeDashboardStoreIds,
} from "../utils/dashboard-load.ts";

test("dashboard load options default to all stores and services", () => {
  assert.deepEqual(normalizeDashboardStoreIds(undefined, ["a", "b"]), ["a", "b"]);
  assert.deepEqual(normalizeDashboardServices(), [...DASHBOARD_SERVICES]);
});

test("dashboard load options remove unknown stores and duplicate services", () => {
  assert.deepEqual(normalizeDashboardStoreIds(["b", "unknown", "b"], ["a", "b"]), [
    "b",
  ]);
  assert.deepEqual(normalizeDashboardServices(["orders", "orders", "traffic"]), [
    "orders",
    "traffic",
  ]);
  assert.equal(isDashboardServiceList(["orders", "traffic"]), true);
  assert.equal(isDashboardServiceList(["orders", "unknown"]), false);
});
