import type {
  DashboardTrafficAvailability,
  DashboardTrafficAvailabilityState,
  DashboardTrafficBreakdown,
  DashboardTrafficMetrics,
  DashboardTrafficOverviewAlias,
  DashboardTrafficPoint,
  DashboardTrafficRange,
  DashboardTrafficRangeAvailability,
  DashboardTrafficRangeData,
  DashboardTrafficSummary,
} from "../types/dashboard.ts";
import { DASHBOARD_TRAFFIC_OVERVIEW_ALIASES } from "../types/dashboard.ts";

const BREAKDOWN_LIMIT = 8;

export function emptyDashboardTraffic(): DashboardTrafficSummary {
  return {
    available: false,
    availableStores: 0,
    timeZone: null,
    timeZoneMode: "unknown",
    availability: createDashboardTrafficAvailability(),
    today: null,
    last24Hours: null,
    last7Days: null,
    last30Days: null,
    hourly: null,
    daily: null,
    sources: null,
    countries: null,
    devices: null,
    trafficTypes: [],
    platforms: [],
    browsers: [],
    landingPages: [],
    campaigns: [],
    aiReferrals: [],
    rangeData: {
      "24h": emptyTrafficRangeData(),
      "7d": emptyTrafficRangeData(),
      "30d": emptyTrafficRangeData(),
    },
  };
}

export function cloneDashboardTraffic(
  traffic: DashboardTrafficSummary,
): DashboardTrafficSummary {
  const range24Hours = resolveDashboardTrafficRangeData(traffic, "24h");
  const range7Days = resolveDashboardTrafficRangeData(traffic, "7d");
  const range30Days = resolveDashboardTrafficRangeData(traffic, "30d");
  const available = isDashboardTrafficAvailable(traffic);
  const timeZone =
    typeof traffic.timeZone === "string" && traffic.timeZone.trim()
      ? traffic.timeZone.trim()
      : null;
  return {
    ...traffic,
    available,
    availableStores: available ? Math.max(1, traffic.availableStores || 0) : 0,
    timeZone,
    timeZoneMode: traffic.timeZoneMode || (timeZone ? "store" : "unknown"),
    availability: createDashboardTrafficAvailability("unknown", traffic.availability),
    today: cloneMetricsIfUsable(traffic.today, traffic.availability?.today),
    last24Hours: cloneMetricsIfUsable(
      traffic.last24Hours,
      traffic.availability?.last24Hours,
    ),
    last7Days: cloneMetricsIfUsable(traffic.last7Days, traffic.availability?.last7Days),
    last30Days: cloneMetricsIfUsable(
      traffic.last30Days,
      traffic.availability?.last30Days,
    ),
    hourly: cloneRowsIfUsable(traffic.hourly, traffic.availability?.hourly),
    daily: cloneRowsIfUsable(traffic.daily, traffic.availability?.daily),
    sources: cloneRowsIfUsable(traffic.sources, traffic.availability?.sources),
    countries: cloneRowsIfUsable(traffic.countries, traffic.availability?.countries),
    devices: cloneRowsIfUsable(traffic.devices, traffic.availability?.devices),
    trafficTypes: (traffic.trafficTypes || []).map((row) => ({ ...row })),
    platforms: (traffic.platforms || []).map((row) => ({ ...row })),
    browsers: (traffic.browsers || []).map((row) => ({ ...row })),
    landingPages: (traffic.landingPages || []).map((row) => ({ ...row })),
    campaigns: (traffic.campaigns || []).map((row) => ({ ...row })),
    aiReferrals: (traffic.aiReferrals || []).map((row) => ({ ...row })),
    rangeData: {
      "24h": cloneTrafficRangeData(range24Hours),
      "7d": cloneTrafficRangeData(range7Days),
      "30d": cloneTrafficRangeData(range30Days),
    },
  };
}

export function resolveDashboardTrafficRangeData(
  traffic: DashboardTrafficSummary,
  range: DashboardTrafficRange,
): DashboardTrafficRangeData {
  const existing = traffic.rangeData?.[range];
  const fallbackAvailability = rangeAvailability(
    createDashboardTrafficAvailability("unknown", traffic.availability),
    range,
  );
  if (existing) {
    const availability = normalizeRangeAvailability(
      existing.availability,
      fallbackAvailability,
    );
    return {
      ...existing,
      metrics: cloneMetricsIfUsable(existing.metrics, availability.metrics),
      sources: cloneRowsIfUsable(existing.sources, availability.sources),
      countries: cloneRowsIfUsable(existing.countries, availability.countries),
      devices: cloneRowsIfUsable(existing.devices, availability.devices),
      availability,
    };
  }

  const metrics =
    range === "24h"
      ? traffic.last24Hours
      : range === "7d"
        ? traffic.last7Days
        : traffic.last30Days;
  const sources = range === "30d" ? traffic.sources : null;
  const countries = range === "30d" ? traffic.countries : null;
  const devices = range === "30d" ? traffic.devices : null;
  return {
    metrics: cloneMetricsIfUsable(metrics, fallbackAvailability.metrics),
    sources: cloneRowsIfUsable(sources, fallbackAvailability.sources),
    countries: cloneRowsIfUsable(countries, fallbackAvailability.countries),
    devices: cloneRowsIfUsable(devices, fallbackAvailability.devices),
    dimensions: {},
    availability: fallbackAvailability,
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
  const available = traffic.filter(isDashboardTrafficAvailable);
  if (!available.length) {
    const empty = emptyDashboardTraffic();
    if (!traffic.length) return empty;
    empty.availability = aggregateTrafficAvailability(
      traffic.map((item) =>
        createDashboardTrafficAvailability("unknown", item.availability),
      ),
    );
    empty.rangeData = {
      "24h": aggregateTrafficRangeData(
        [],
        traffic.map((item) => resolveDashboardTrafficRangeData(item, "24h")),
      ),
      "7d": aggregateTrafficRangeData(
        [],
        traffic.map((item) => resolveDashboardTrafficRangeData(item, "7d")),
      ),
      "30d": aggregateTrafficRangeData(
        [],
        traffic.map((item) => resolveDashboardTrafficRangeData(item, "30d")),
      ),
    };
    return empty;
  }

  return {
    available: true,
    availableStores: available.reduce(
      (total, item) => total + Math.max(1, item.availableStores),
      0,
    ),
    ...aggregateTimeZoneContext(available),
    availability: aggregateTrafficAvailability(
      traffic.map((item) =>
        createDashboardTrafficAvailability("unknown", item.availability),
      ),
    ),
    today: aggregateNullableMetrics(
      collectAliasValues(traffic, "today", (item) => item.today),
    ),
    last24Hours: aggregateNullableMetrics(
      collectAliasValues(traffic, "last24Hours", (item) => item.last24Hours),
    ),
    last7Days: aggregateNullableMetrics(
      collectAliasValues(traffic, "last7Days", (item) => item.last7Days),
    ),
    last30Days: aggregateNullableMetrics(
      collectAliasValues(traffic, "last30Days", (item) => item.last30Days),
    ),
    hourly: aggregateNullablePoints(
      collectAliasValues(traffic, "hourly", (item) => item.hourly),
    ),
    daily: aggregateNullablePoints(
      collectAliasValues(traffic, "daily", (item) => item.daily),
    ),
    sources: aggregateNullableBreakdowns(
      collectAliasValues(traffic, "sources", (item) => item.sources),
    ),
    countries: aggregateNullableBreakdowns(
      collectAliasValues(traffic, "countries", (item) => item.countries),
    ),
    devices: aggregateNullableBreakdowns(
      collectAliasValues(traffic, "devices", (item) => item.devices),
    ),
    trafficTypes: aggregateBreakdowns(
      available.flatMap((item) => item.trafficTypes || []),
    ),
    platforms: aggregateBreakdowns(available.flatMap((item) => item.platforms || [])),
    browsers: aggregateBreakdowns(available.flatMap((item) => item.browsers || [])),
    landingPages: aggregateBreakdowns(
      available.flatMap((item) => item.landingPages || []),
    ),
    campaigns: aggregateBreakdowns(available.flatMap((item) => item.campaigns || [])),
    aiReferrals: aggregateBreakdowns(
      available.flatMap((item) => item.aiReferrals || []),
    ),
    rangeData: {
      "24h": aggregateTrafficRangeData(
        available.map((item) => resolveDashboardTrafficRangeData(item, "24h")),
        traffic.map((item) => resolveDashboardTrafficRangeData(item, "24h")),
      ),
      "7d": aggregateTrafficRangeData(
        available.map((item) => resolveDashboardTrafficRangeData(item, "7d")),
        traffic.map((item) => resolveDashboardTrafficRangeData(item, "7d")),
      ),
      "30d": aggregateTrafficRangeData(
        available.map((item) => resolveDashboardTrafficRangeData(item, "30d")),
        traffic.map((item) => resolveDashboardTrafficRangeData(item, "30d")),
      ),
    },
  };
}

export function isDashboardTrafficAvailable(traffic: DashboardTrafficSummary) {
  if (traffic.available) return true;

  const metricGroups = [
    traffic.today,
    traffic.last24Hours,
    traffic.last7Days,
    traffic.last30Days,
  ];
  return (
    metricGroups.some((metrics) =>
      [
        metrics?.sessions,
        metrics?.visitors,
        metrics?.pageviews,
        metrics?.bounces,
        metrics?.cartAdditions,
        metrics?.reachedCheckouts,
        metrics?.completedCheckouts,
        metrics?.averageSessionDuration,
      ].some((value) => finiteNonNegative(value) > 0),
    ) ||
    [
      traffic.hourly,
      traffic.daily,
      traffic.sources,
      traffic.countries,
      traffic.devices,
    ].some((rows) => Array.isArray(rows) && rows.length > 0)
  );
}

function emptyTrafficRangeData(): DashboardTrafficRangeData {
  return {
    metrics: null,
    sources: null,
    countries: null,
    devices: null,
    dimensions: {},
    availability: {
      metrics: "unknown",
      trend: "unknown",
      sources: "unknown",
      countries: "unknown",
      devices: "unknown",
    },
  };
}

function cloneTrafficRangeData(
  range: DashboardTrafficRangeData,
): DashboardTrafficRangeData {
  return {
    metrics: range.metrics ? { ...range.metrics } : null,
    sources: range.sources?.map((row) => ({ ...row })) || null,
    countries: range.countries?.map((row) => ({ ...row })) || null,
    devices: range.devices?.map((row) => ({ ...row })) || null,
    dimensions: Object.fromEntries(
      Object.entries(range.dimensions || {}).map(([dimension, result]) => [
        dimension,
        result
          ? {
              ...result,
              rows: result.rows.map((row) => ({ ...row })),
            }
          : result,
      ]),
    ),
    availability: normalizeRangeAvailability(range.availability),
  };
}

function aggregateTrafficRangeData(
  ranges: DashboardTrafficRangeData[],
  availabilityRanges: DashboardTrafficRangeData[] = ranges,
): DashboardTrafficRangeData {
  const metrics = ranges.flatMap((range) => (range.metrics ? [range.metrics] : []));
  const sources = ranges.flatMap((range) => (range.sources ? [range.sources] : []));
  const countries = ranges.flatMap((range) =>
    range.countries ? [range.countries] : [],
  );
  const devices = ranges.flatMap((range) => (range.devices ? [range.devices] : []));
  return {
    metrics: aggregateNullableMetrics(metrics),
    sources: aggregateNullableBreakdowns(sources),
    countries: aggregateNullableBreakdowns(countries),
    devices: aggregateNullableBreakdowns(devices),
    dimensions: {},
    availability: {
      metrics: aggregateAvailabilityState(
        availabilityRanges.map(
          (range) => normalizeRangeAvailability(range.availability).metrics,
        ),
      ),
      trend: aggregateAvailabilityState(
        availabilityRanges.map(
          (range) => normalizeRangeAvailability(range.availability).trend,
        ),
      ),
      sources: aggregateAvailabilityState(
        availabilityRanges.map(
          (range) => normalizeRangeAvailability(range.availability).sources,
        ),
      ),
      countries: aggregateAvailabilityState(
        availabilityRanges.map(
          (range) => normalizeRangeAvailability(range.availability).countries,
        ),
      ),
      devices: aggregateAvailabilityState(
        availabilityRanges.map(
          (range) => normalizeRangeAvailability(range.availability).devices,
        ),
      ),
    },
  };
}

export function createDashboardTrafficAvailability(
  defaultState: DashboardTrafficAvailabilityState = "unknown",
  overrides?: Partial<DashboardTrafficAvailability>,
): DashboardTrafficAvailability {
  return Object.fromEntries(
    DASHBOARD_TRAFFIC_OVERVIEW_ALIASES.map((alias) => [
      alias,
      overrides?.[alias] || defaultState,
    ]),
  ) as DashboardTrafficAvailability;
}

function aggregateTrafficAvailability(
  rows: DashboardTrafficAvailability[],
): DashboardTrafficAvailability {
  return createDashboardTrafficAvailability(
    "unknown",
    Object.fromEntries(
      DASHBOARD_TRAFFIC_OVERVIEW_ALIASES.map((alias) => [
        alias,
        aggregateAvailabilityState(rows.map((row) => row[alias])),
      ]),
    ),
  );
}

function aggregateAvailabilityState(
  states: DashboardTrafficAvailabilityState[],
): DashboardTrafficAvailabilityState {
  if (!states.length || states.every((state) => state === "unknown")) return "unknown";
  if (states.every((state) => state === "available")) return "available";
  if (states.every((state) => state === "failed")) return "failed";
  return "partial";
}

function rangeAvailability(
  availability: DashboardTrafficAvailability,
  range: DashboardTrafficRange,
): DashboardTrafficRangeAvailability {
  if (range === "24h") {
    return {
      metrics: availability.last24Hours,
      trend: availability.hourly,
      sources: availability.sources24Hours,
      countries: availability.countries24Hours,
      devices: availability.devices24Hours,
    };
  }
  if (range === "7d") {
    return {
      metrics: availability.last7Days,
      trend: availability.daily,
      sources: availability.sources7Days,
      countries: availability.countries7Days,
      devices: availability.devices7Days,
    };
  }
  return {
    metrics: availability.last30Days,
    trend: availability.daily,
    sources: availability.sources,
    countries: availability.countries,
    devices: availability.devices,
  };
}

function normalizeRangeAvailability(
  availability?: Partial<DashboardTrafficRangeAvailability>,
  fallback: DashboardTrafficRangeAvailability = {
    metrics: "unknown",
    trend: "unknown",
    sources: "unknown",
    countries: "unknown",
    devices: "unknown",
  },
): DashboardTrafficRangeAvailability {
  return {
    metrics: availability?.metrics || fallback.metrics,
    trend: availability?.trend || fallback.trend,
    sources: availability?.sources || fallback.sources,
    countries: availability?.countries || fallback.countries,
    devices: availability?.devices || fallback.devices,
  };
}

function cloneMetricsIfUsable(
  metrics: DashboardTrafficMetrics | null | undefined,
  availability?: DashboardTrafficAvailabilityState,
): DashboardTrafficMetrics | null {
  return availability === "failed" || !metrics ? null : { ...metrics };
}

function cloneRowsIfUsable<T extends object>(
  rows: T[] | null | undefined,
  availability?: DashboardTrafficAvailabilityState,
): T[] | null {
  return availability === "failed" || !Array.isArray(rows)
    ? null
    : rows.map((row) => ({ ...row }));
}

function collectAliasValues<T>(
  traffic: DashboardTrafficSummary[],
  alias: DashboardTrafficOverviewAlias,
  select: (item: DashboardTrafficSummary) => T | null | undefined,
): T[] {
  return traffic.flatMap((item) => {
    if (item.availability?.[alias] === "failed") return [];
    const value = select(item);
    return value === null || value === undefined ? [] : [value];
  });
}

function aggregateNullableMetrics(
  rows: DashboardTrafficMetrics[],
): DashboardTrafficMetrics | null {
  return rows.length ? aggregateMetrics(rows) : null;
}

function aggregateNullablePoints(
  rows: DashboardTrafficPoint[][],
): DashboardTrafficPoint[] | null {
  return rows.length ? aggregatePoints(rows.flat()) : null;
}

function aggregateNullableBreakdowns(
  rows: DashboardTrafficBreakdown[][],
): DashboardTrafficBreakdown[] | null {
  return rows.length ? aggregateBreakdowns(rows.flat()) : null;
}

function aggregateTimeZoneContext(
  traffic: DashboardTrafficSummary[],
): Pick<DashboardTrafficSummary, "timeZone" | "timeZoneMode"> {
  const timeZones = traffic.map((item) => item.timeZone?.trim() || null);
  if (!timeZones.length || timeZones.some((timeZone) => !timeZone)) {
    return { timeZone: null, timeZoneMode: "unknown" };
  }

  const distinctTimeZones = Array.from(new Set(timeZones as string[]));
  if (
    distinctTimeZones.length > 1 ||
    traffic.some((item) => item.timeZoneMode === "per-store")
  ) {
    return { timeZone: null, timeZoneMode: "per-store" };
  }

  return { timeZone: distinctTimeZones[0] || null, timeZoneMode: "store" };
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
