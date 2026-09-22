import type {
  DashboardResourceState,
  DashboardResourceSummary,
  DashboardService,
  DashboardStoreFailure,
  StoreDashboardSnapshot,
} from "~~/types/dashboard";

export function summarizeDashboardResource(
  stores: StoreDashboardSnapshot[],
  failures: DashboardStoreFailure[],
  resource: DashboardService,
): DashboardResourceSummary {
  const snapshots = stores.map(
    (store) =>
      store.resources?.[resource] || {
        state: "available" as const,
        dataAsOf: store.generatedAt,
      },
  );
  const reporting = snapshots.filter(
    (snapshot) =>
      snapshot.state === "available" ||
      snapshot.state === "partial" ||
      snapshot.state === "stale",
  ).length;
  let state: DashboardResourceState = "available";
  if (
    snapshots.some(
      (snapshot) => snapshot.state === "failed" || snapshot.state === "partial",
    ) ||
    failures.length
  ) {
    state = reporting > 0 ? "partial" : "failed";
  } else if (snapshots.some((snapshot) => snapshot.state === "stale")) {
    state = "stale";
  } else if (
    !snapshots.length ||
    snapshots.every((item) => item.state === "unavailable")
  ) {
    state = "unavailable";
  }

  const timestamps = snapshots
    .flatMap((snapshot) => (snapshot.dataAsOf ? [snapshot.dataAsOf] : []))
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(left) - Date.parse(right));

  return {
    resource,
    state,
    reporting,
    total: snapshots.length + failures.length,
    dataAsOf: timestamps[0] || null,
  };
}
