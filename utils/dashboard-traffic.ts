import type {
  DashboardTrafficBreakdown,
  DashboardTrafficMetrics,
  DashboardTrafficPoint,
  DashboardTrafficSummary,
} from "~~/types/dashboard";

const BREAKDOWN_LIMIT = 8;

export function emptyDashboardTraffic(): DashboardTrafficSummary {
  return {
    available: false,
    availableStores: 0,
    today: emptyTrafficMetrics(),
    last7Days: emptyTrafficMetrics(),
    last30Days: emptyTrafficMetrics(),
    hourly: [],
    daily: [],
    sources: [],
    countries: [],
    devices: [],
    trafficTypes: [],
    platforms: [],
    browsers: [],
    landingPages: [],
    campaigns: [],
    aiReferrals: [],
  };
}

export function cloneDashboardTraffic(
  traffic: DashboardTrafficSummary,
): DashboardTrafficSummary {
  return {
    ...traffic,
    today: { ...traffic.today },
    last7Days: { ...traffic.last7Days },
    last30Days: { ...traffic.last30Days },
    hourly: traffic.hourly.map((point) => ({ ...point })),
    daily: traffic.daily.map((point) => ({ ...point })),
    sources: traffic.sources.map((row) => ({ ...row })),
    countries: traffic.countries.map((row) => ({ ...row })),
    devices: traffic.devices.map((row) => ({ ...row })),
    trafficTypes: traffic.trafficTypes.map((row) => ({ ...row })),
    platforms: traffic.platforms.map((row) => ({ ...row })),
    browsers: traffic.browsers.map((row) => ({ ...row })),
    landingPages: traffic.landingPages.map((row) => ({ ...row })),
    campaigns: traffic.campaigns.map((row) => ({ ...row })),
    aiReferrals: traffic.aiReferrals.map((row) => ({ ...row })),
  };
}

export function createTrafficMetrics(
  input: Partial<DashboardTrafficMetrics>,
): DashboardTrafficMetrics {
  const sessions = finiteNonNegative(input.sessions);
  const visitors = finiteNonNegative(input.visitors);
  const pageviews = finiteNonNegative(input.pageviews);
  const bounces = finiteNonNegative(input.bounces);
  const cartAdditions = finiteNonNegative(input.cartAdditions);
  const reachedCheckouts = finiteNonNegative(input.reachedCheckouts);
  const completedCheckouts = finiteNonNegative(input.completedCheckouts);
  const averageSessionDuration = finiteNonNegative(input.averageSessionDuration);

  return {
    sessions,
    visitors,
    pageviews,
    bounces,
    cartAdditions,
    reachedCheckouts,
    completedCheckouts,
    pageviewsPerSession: sessions ? pageviews / sessions : 0,
    averageSessionDuration,
    bounceRate: sessions ? bounces / sessions : 0,
    conversionRate: sessions ? completedCheckouts / sessions : 0,
  };
}

export function aggregateDashboardTraffic(
  traffic: DashboardTrafficSummary[],
): DashboardTrafficSummary {
  const available = traffic.filter((item) => item.available);
  if (!available.length) return emptyDashboardTraffic();

  return {
    available: true,
    availableStores: available.reduce(
      (total, item) => total + Math.max(1, item.availableStores),
      0,
    ),
    today: aggregateMetrics(available.map((item) => item.today)),
    last7Days: aggregateMetrics(available.map((item) => item.last7Days)),
    last30Days: aggregateMetrics(available.map((item) => item.last30Days)),
    hourly: aggregatePoints(available.flatMap((item) => item.hourly)),
    daily: aggregatePoints(available.flatMap((item) => item.daily)),
    sources: aggregateBreakdowns(available.flatMap((item) => item.sources)),
    countries: aggregateBreakdowns(available.flatMap((item) => item.countries)),
    devices: aggregateBreakdowns(available.flatMap((item) => item.devices)),
    trafficTypes: aggregateBreakdowns(available.flatMap((item) => item.trafficTypes)),
    platforms: aggregateBreakdowns(available.flatMap((item) => item.platforms)),
    browsers: aggregateBreakdowns(available.flatMap((item) => item.browsers)),
    landingPages: aggregateBreakdowns(available.flatMap((item) => item.landingPages)),
    campaigns: aggregateBreakdowns(available.flatMap((item) => item.campaigns)),
    aiReferrals: aggregateBreakdowns(available.flatMap((item) => item.aiReferrals)),
  };
}

function emptyTrafficMetrics(): DashboardTrafficMetrics {
  return createTrafficMetrics({});
}

function aggregateMetrics(rows: DashboardTrafficMetrics[]) {
  const totals = rows.reduce(
    (result, row) => {
      result.sessions += finiteNonNegative(row.sessions);
      result.visitors += finiteNonNegative(row.visitors);
      result.pageviews += finiteNonNegative(row.pageviews);
      result.bounces += finiteNonNegative(row.bounces);
      result.cartAdditions += finiteNonNegative(row.cartAdditions);
      result.reachedCheckouts += finiteNonNegative(row.reachedCheckouts);
      result.completedCheckouts += finiteNonNegative(row.completedCheckouts);
      result.weightedDuration +=
        finiteNonNegative(row.averageSessionDuration) * finiteNonNegative(row.sessions);
      return result;
    },
    {
      sessions: 0,
      visitors: 0,
      pageviews: 0,
      bounces: 0,
      cartAdditions: 0,
      reachedCheckouts: 0,
      completedCheckouts: 0,
      weightedDuration: 0,
    },
  );

  return createTrafficMetrics({
    ...totals,
    averageSessionDuration: totals.sessions
      ? totals.weightedDuration / totals.sessions
      : 0,
  });
}

function aggregatePoints(rows: DashboardTrafficPoint[]) {
  const points = new Map<string, DashboardTrafficPoint>();
  for (const row of rows) {
    const period = String(row.period || "").trim();
    if (!period) continue;
    const existing = points.get(period) || {
      period,
      sessions: 0,
      visitors: 0,
      pageviews: 0,
    };
    existing.sessions += finiteNonNegative(row.sessions);
    existing.visitors += finiteNonNegative(row.visitors);
    existing.pageviews += finiteNonNegative(row.pageviews);
    points.set(period, existing);
  }
  return [...points.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function aggregateBreakdowns(rows: DashboardTrafficBreakdown[]) {
  const groups = new Map<string, DashboardTrafficBreakdown>();
  for (const row of rows) {
    const label = String(row.label || "").trim() || "Unknown";
    const key = label.toLocaleLowerCase();
    const existing = groups.get(key) || { label, sessions: 0, visitors: 0 };
    existing.sessions += finiteNonNegative(row.sessions);
    existing.visitors += finiteNonNegative(row.visitors);
    groups.set(key, existing);
  }
  return [...groups.values()]
    .sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label))
    .slice(0, BREAKDOWN_LIMIT);
}

function finiteNonNegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
