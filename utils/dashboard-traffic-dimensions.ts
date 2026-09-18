import type { DashboardTrafficDetailRow } from "~~/types/dashboard";

export type DashboardTrafficDimensionKey =
  | "source"
  | "referrerDomain"
  | "referrerTerms"
  | "country"
  | "region"
  | "city"
  | "browser"
  | "browserVersion"
  | "operatingSystem"
  | "operatingSystemVersion"
  | "deviceType"
  | "apiClient"
  | "trafficType"
  | "platform"
  | "channel"
  | "medium"
  | "landingPageType"
  | "landingPagePath"
  | "campaign"
  | "campaignContent"
  | "aiReferral";

export interface DashboardTrafficDimensionOption {
  key: DashboardTrafficDimensionKey;
  label: string;
}

export interface DashboardTrafficDimensionSummary {
  label: string;
  sessions: number;
  pageviews: number;
  pageviewsPerSession: number;
  bounces: number;
  bounceRate: number;
  averageSessionDuration: number;
  cartAdditions: number;
  reachedCheckouts: number;
  completedCheckouts: number;
  conversionRate: number;
}

interface TrafficDimensionAccumulator {
  label: string;
  sessions: number;
  pageviews: number;
  bounces: number;
  durationTotal: number;
  cartAdditions: number;
  reachedCheckouts: number;
  completedCheckouts: number;
}

export function aggregateTrafficDimension(
  rows: DashboardTrafficDetailRow[],
  dimension: DashboardTrafficDimensionKey,
): DashboardTrafficDimensionSummary[] {
  const groups = new Map<string, TrafficDimensionAccumulator>();

  for (const row of rows) {
    const rawLabel = row[dimension];
    const label = typeof rawLabel === "string" && rawLabel.trim() ? rawLabel : "—";
    const current = groups.get(label) || {
      label,
      sessions: 0,
      pageviews: 0,
      bounces: 0,
      durationTotal: 0,
      cartAdditions: 0,
      reachedCheckouts: 0,
      completedCheckouts: 0,
    };

    current.sessions += row.sessions;
    current.pageviews += row.pageviews;
    current.bounces += row.bounces;
    current.durationTotal += row.averageSessionDuration * row.sessions;
    current.cartAdditions += row.cartAdditions;
    current.reachedCheckouts += row.reachedCheckouts;
    current.completedCheckouts += row.completedCheckouts;
    groups.set(label, current);
  }

  return [...groups.values()]
    .map((group) => ({
      label: group.label,
      sessions: group.sessions,
      pageviews: group.pageviews,
      pageviewsPerSession: divide(group.pageviews, group.sessions),
      bounces: group.bounces,
      bounceRate: divide(group.bounces, group.sessions),
      averageSessionDuration: divide(group.durationTotal, group.sessions),
      cartAdditions: group.cartAdditions,
      reachedCheckouts: group.reachedCheckouts,
      completedCheckouts: group.completedCheckouts,
      conversionRate: divide(group.completedCheckouts, group.sessions),
    }))
    .sort(
      (left, right) =>
        right.sessions - left.sessions || left.label.localeCompare(right.label),
    );
}

function divide(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}
