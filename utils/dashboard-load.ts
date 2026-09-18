import { DASHBOARD_SERVICES, type DashboardService } from "../types/dashboard.ts";

const DASHBOARD_SERVICE_SET = new Set<string>(DASHBOARD_SERVICES);

export function isDashboardService(value: unknown): value is DashboardService {
  return typeof value === "string" && DASHBOARD_SERVICE_SET.has(value);
}

export function isDashboardServiceList(value: unknown): value is DashboardService[] {
  return Array.isArray(value) && value.every(isDashboardService);
}

export function normalizeDashboardServices(
  services?: readonly DashboardService[],
): DashboardService[] {
  return services
    ? [...new Set(services)].filter(isDashboardService)
    : [...DASHBOARD_SERVICES];
}

export function normalizeDashboardStoreIds(
  requestedStoreIds: readonly string[] | undefined,
  knownStoreIds: readonly string[],
) {
  if (!requestedStoreIds) return [...knownStoreIds];

  const known = new Set(knownStoreIds);
  return [...new Set(requestedStoreIds)].filter(
    (storeId) => typeof storeId === "string" && known.has(storeId),
  );
}
