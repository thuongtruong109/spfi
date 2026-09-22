import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardReconciliation } from "../utils/dashboard-reconciliation.ts";

test("dashboard reconciliation calculates decimal differences without float drift", () => {
  const result = buildDashboardReconciliation(
    [{ currency: "USD", amount: 0.1 }],
    [{ currency: "USD", amount: 0.3 }],
    true,
    "2026-09-21T02:00:00.000Z",
  );

  assert.equal(result.rows[0]?.difference, 0.2);
  assert.equal(result.rows[0]?.status, "mismatch");
});

test("dashboard reconciliation stays unavailable until both sources are available", () => {
  assert.deepEqual(
    buildDashboardReconciliation([], [], false, "2026-09-21T02:00:00.000Z"),
    { available: false, dataAsOf: null, rows: [] },
  );
});
