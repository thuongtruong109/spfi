import { describe, expect, it } from "vitest";
import type { StoreDashboardSnapshot } from "~~/types/dashboard";
import { summarizeDashboardResource } from "~~/utils/dashboard-resource";

const GENERATED_AT = "2026-09-21T02:00:00.000Z";

function store(
  state: "available" | "partial" | "unavailable" | "failed" | "stale",
  dataAsOf: string | null = GENERATED_AT,
) {
  return {
    generatedAt: GENERATED_AT,
    resources: { orders: { state, dataAsOf } },
  } as StoreDashboardSnapshot;
}

describe("dashboard resource freshness", () => {
  it("keeps zero-valued available resources distinct from unavailable resources", () => {
    expect(summarizeDashboardResource([store("available")], [], "orders")).toEqual({
      resource: "orders",
      state: "available",
      reporting: 1,
      total: 1,
      dataAsOf: GENERATED_AT,
    });
    expect(
      summarizeDashboardResource([store("unavailable", null)], [], "orders").state,
    ).toBe("unavailable");
  });

  it("reports partial data when at least one selected store still has usable data", () => {
    const summary = summarizeDashboardResource(
      [store("available"), store("failed", null)],
      [],
      "orders",
    );

    expect(summary.state).toBe("partial");
    expect(summary.reporting).toBe(1);
    expect(summary.total).toBe(2);
  });

  it("reports a complete failure only when no selected store has usable data", () => {
    const summary = summarizeDashboardResource(
      [store("failed", null)],
      [{ storeId: "missing", label: "Missing", reason: "failed", message: "No data" }],
      "orders",
    );

    expect(summary.state).toBe("failed");
    expect(summary.reporting).toBe(0);
    expect(summary.total).toBe(2);
    expect(summary.dataAsOf).toBeNull();
  });

  it("preserves stale status and the oldest resource timestamp", () => {
    const summary = summarizeDashboardResource(
      [store("available"), store("stale", "2026-09-20T23:00:00.000Z")],
      [],
      "orders",
    );

    expect(summary.state).toBe("stale");
    expect(summary.dataAsOf).toBe("2026-09-20T23:00:00.000Z");
  });
});
