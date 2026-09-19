import type {
  DashboardTrafficDimensionKey,
  DashboardTrafficRange,
} from "~~/types/dashboard";

export type { DashboardTrafficDimensionKey } from "~~/types/dashboard";

export interface DashboardTrafficDimensionOption {
  key: DashboardTrafficDimensionKey;
  label: string;
}

export function trafficDimensionRequestKey(
  range: DashboardTrafficRange,
  dimension: DashboardTrafficDimensionKey,
) {
  return `${range}:${dimension}`;
}
