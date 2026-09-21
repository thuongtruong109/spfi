import type { DashboardStoreFailure } from "../types/dashboard.ts";
import type {
  DashboardTrafficAvailabilityState,
  DashboardTrafficBreakdown,
  DashboardTrafficMetrics,
  DashboardTrafficOverviewAlias,
  DashboardTrafficPoint,
  DashboardTrafficRange,
  DashboardTrafficOverviewRange,
  DashboardTrafficReporting,
  DashboardTrafficRangeAvailability,
  DashboardTrafficRangeData,
  DashboardTrafficStoreReport,
  TrafficAvailability,
  TrafficOverviewResponse,
} from "../types/traffic.ts";
import {
  DASHBOARD_TRAFFIC_BLOCKS,
  DASHBOARD_TRAFFIC_OVERVIEW_ALIASES,
  DASHBOARD_TRAFFIC_OVERVIEW_RANGES,
  DASHBOARD_TRAFFIC_RANGES,
} from "../types/traffic.ts";

const BREAKDOWN_LIMIT = 8;

export interface DashboardTrafficAggregationContext {
  stores: Array<{
    storeId: string;
    label: string;
    traffic: TrafficOverviewResponse;
    message?: string | null;
  }>;
  failures: DashboardStoreFailure[];
}

export function emptyDashboardTraffic(): TrafficOverviewResponse {
  return {
    generatedAt: null,
    cacheAge: 0,
    isStale: false,
    available: false,
    availableStores: 0,
    reporting: emptyDashboardTrafficReporting(),
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
    rangeData: createTrafficRangeDataMap(() => emptyTrafficRangeData()),
  };
}

export function failedDashboardTraffic(): TrafficOverviewResponse {
  const traffic = emptyDashboardTraffic();
  traffic.availability = createDashboardTrafficAvailability("failed");
  traffic.rangeData = createTrafficRangeDataMap(() =>
    emptyTrafficRangeData(trafficRangeAvailability("failed")),
  );
  traffic.reporting = createSingleStoreTrafficReporting(traffic.rangeData, false, null);
  return traffic;
}

export function createSingleStoreTrafficReporting(
  rangeData: Record<DashboardTrafficRange, DashboardTrafficRangeData>,
  available: boolean,
  lastSuccessfulAt: string | null,
): DashboardTrafficReporting {
  return {
    totalStores: 1,
    reportingStores: available ? 1 : 0,
    lastSuccessfulAt: available ? normalizeIsoTimestamp(lastSuccessfulAt) : null,
    stores: [],
    coverage: createTrafficRangeCoverage(
      Object.fromEntries(
        trafficRanges().map((range) => [range, [rangeData[range]]]),
      ) as Record<DashboardTrafficRange, DashboardTrafficRangeData[]>,
      1,
    ),
  };
}

export function cloneDashboardTraffic(
  traffic: TrafficOverviewResponse,
): TrafficOverviewResponse {
  const available = isDashboardTrafficAvailable(traffic);
  const timeZone =
    typeof traffic.timeZone === "string" && traffic.timeZone.trim()
      ? traffic.timeZone.trim()
      : null;
  return {
    ...traffic,
    generatedAt: normalizeIsoTimestamp(traffic.generatedAt),
    cacheAge: normalizeCacheAge(traffic.cacheAge),
    isStale: Boolean(traffic.isStale),
    available,
    availableStores: available ? Math.max(1, traffic.availableStores || 0) : 0,
    reporting: cloneDashboardTrafficReporting(traffic.reporting, traffic, available),
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
    rangeData: createTrafficRangeDataMap((range) =>
      cloneTrafficRangeData(resolveDashboardTrafficRangeData(traffic, range)),
    ),
  };
}

export function resolveDashboardTrafficRangeData(
  traffic: TrafficOverviewResponse,
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
      trend: cloneRowsIfUsable(existing.trend, availability.trend),
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
        : range === "30d"
          ? traffic.last30Days
          : null;
  const trend =
    range === "24h"
      ? traffic.hourly
      : range === "7d"
        ? traffic.daily?.slice(-7) || null
        : range === "30d"
          ? traffic.daily
          : null;
  const sources = range === "30d" ? traffic.sources : null;
  const countries = range === "30d" ? traffic.countries : null;
  const devices = range === "30d" ? traffic.devices : null;
  return {
    metrics: cloneMetricsIfUsable(metrics, fallbackAvailability.metrics),
    trend: cloneRowsIfUsable(trend, fallbackAvailability.trend),
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
  traffic: TrafficOverviewResponse[],
  context?: DashboardTrafficAggregationContext,
): TrafficOverviewResponse {
  const available = traffic.filter(isDashboardTrafficAvailable);
  const reporting = aggregateDashboardTrafficReporting(traffic, context);
  const failedStoreCount = context?.failures.length || 0;
  const availabilityRows = [
    ...traffic.map((item) =>
      createDashboardTrafficAvailability("unknown", item.availability),
    ),
    ...Array.from({ length: failedStoreCount }, () =>
      createDashboardTrafficAvailability("failed"),
    ),
  ];
  const failedRanges = Array.from({ length: failedStoreCount }, () =>
    trafficRangeAvailability("failed"),
  );
  if (!available.length) {
    const empty = emptyDashboardTraffic();
    empty.reporting = reporting;
    if (!availabilityRows.length) return empty;
    empty.availability = aggregateTrafficAvailability(availabilityRows);
    empty.rangeData = createTrafficRangeDataMap((range) =>
      aggregateTrafficRangeData(
        [],
        [
          ...traffic.map((item) => resolveDashboardTrafficRangeData(item, range)),
          ...failedRanges.map((availability) => emptyTrafficRangeData(availability)),
        ],
      ),
    );
    return empty;
  }

  return {
    ...aggregateTrafficDiagnostics(available),
    available: true,
    availableStores: reporting.reportingStores,
    reporting,
    ...aggregateTimeZoneContext(available),
    availability: aggregateTrafficAvailability(availabilityRows),
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
    rangeData: createTrafficRangeDataMap((range) =>
      aggregateTrafficRangeData(
        available.map((item) => resolveDashboardTrafficRangeData(item, range)),
        [
          ...traffic.map((item) => resolveDashboardTrafficRangeData(item, range)),
          ...failedRanges.map((availability) => emptyTrafficRangeData(availability)),
        ],
      ),
    ),
  };
}

export function isDashboardTrafficAvailable(traffic: TrafficOverviewResponse) {
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

function emptyTrafficRangeData(
  availability = trafficRangeAvailability("unknown"),
): DashboardTrafficRangeData {
  return {
    metrics: null,
    trend: null,
    sources: null,
    countries: null,
    devices: null,
    dimensions: {},
    availability,
  };
}

function cloneTrafficRangeData(
  range: DashboardTrafficRangeData,
): DashboardTrafficRangeData {
  return {
    metrics: range.metrics ? { ...range.metrics } : null,
    trend: range.trend?.map((row) => ({ ...row })) || null,
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
  const trend = ranges.flatMap((range) => (range.trend ? [range.trend] : []));
  const sources = ranges.flatMap((range) => (range.sources ? [range.sources] : []));
  const countries = ranges.flatMap((range) =>
    range.countries ? [range.countries] : [],
  );
  const devices = ranges.flatMap((range) => (range.devices ? [range.devices] : []));
  return {
    metrics: aggregateNullableMetrics(metrics),
    trend: aggregateNullablePoints(trend),
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
  overrides?: Partial<TrafficAvailability>,
): TrafficAvailability {
  return Object.fromEntries(
    DASHBOARD_TRAFFIC_OVERVIEW_ALIASES.map((alias) => [
      alias,
      overrides?.[alias] || defaultState,
    ]),
  ) as TrafficAvailability;
}

function aggregateTrafficAvailability(
  rows: TrafficAvailability[],
): TrafficAvailability {
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
  availability: TrafficAvailability,
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
  if (range === "30d") {
    return {
      metrics: availability.last30Days,
      trend: availability.daily,
      sources: availability.sources,
      countries: availability.countries,
      devices: availability.devices,
    };
  }
  return trafficRangeAvailability("unknown");
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
  traffic: TrafficOverviewResponse[],
  alias: DashboardTrafficOverviewAlias,
  select: (item: TrafficOverviewResponse) => T | null | undefined,
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

function emptyDashboardTrafficReporting(totalStores = 0): DashboardTrafficReporting {
  return {
    totalStores,
    reportingStores: 0,
    lastSuccessfulAt: null,
    stores: [],
    coverage: createTrafficRangeCoverage(
      { "24h": [], "7d": [], "30d": [] },
      totalStores,
    ),
  };
}

function cloneDashboardTrafficReporting(
  reporting: DashboardTrafficReporting | undefined,
  traffic: TrafficOverviewResponse,
  available: boolean,
): DashboardTrafficReporting {
  if (!reporting) {
    const totalStores = available ? Math.max(1, traffic.availableStores || 0) : 0;
    const ranges = {
      "24h": resolveDashboardTrafficRangeData(traffic, "24h"),
      "7d": resolveDashboardTrafficRangeData(traffic, "7d"),
      "30d": resolveDashboardTrafficRangeData(traffic, "30d"),
    };
    return {
      totalStores,
      reportingStores: available ? totalStores : 0,
      lastSuccessfulAt: null,
      stores: [],
      coverage: Object.fromEntries(
        trafficRanges().map((range) => [
          range,
          Object.fromEntries(
            DASHBOARD_TRAFFIC_BLOCKS.map((block) => [
              block,
              {
                reportingStores: isReportingState(
                  normalizeRangeAvailability(ranges[range].availability)[block],
                )
                  ? totalStores
                  : 0,
                totalStores,
              },
            ]),
          ),
        ]),
      ) as DashboardTrafficReporting["coverage"],
    };
  }

  return {
    totalStores: nonNegativeInteger(reporting.totalStores),
    reportingStores: nonNegativeInteger(reporting.reportingStores),
    lastSuccessfulAt: normalizeIsoTimestamp(reporting.lastSuccessfulAt),
    stores: (reporting.stores || []).map((store) => ({
      ...store,
      issues: (store.issues || []).map((issue) => ({ ...issue })),
    })),
    coverage: Object.fromEntries(
      trafficRanges().map((range) => [
        range,
        Object.fromEntries(
          DASHBOARD_TRAFFIC_BLOCKS.map((block) => {
            const row = reporting.coverage?.[range]?.[block];
            return [
              block,
              {
                reportingStores: nonNegativeInteger(row?.reportingStores),
                totalStores: nonNegativeInteger(
                  row?.totalStores ?? reporting.totalStores,
                ),
              },
            ];
          }),
        ),
      ]),
    ) as DashboardTrafficReporting["coverage"],
  };
}

function aggregateDashboardTrafficReporting(
  traffic: TrafficOverviewResponse[],
  context?: DashboardTrafficAggregationContext,
): DashboardTrafficReporting {
  const totalStores = context
    ? context.stores.length + context.failures.length
    : traffic.length;
  const reportingStores = context
    ? context.stores.filter((store) => isDashboardTrafficAvailable(store.traffic))
        .length
    : traffic.filter(isDashboardTrafficAvailable).length;
  const rangeRows = Object.fromEntries(
    trafficRanges().map((range) => [
      range,
      traffic.map((item) => resolveDashboardTrafficRangeData(item, range)),
    ]),
  ) as Record<DashboardTrafficRange, DashboardTrafficRangeData[]>;

  return {
    totalStores,
    reportingStores,
    lastSuccessfulAt: latestSuccessfulTimestamp(
      traffic.map((item) => item.reporting?.lastSuccessfulAt),
    ),
    stores: context ? createTrafficStoreReports(context) : [],
    coverage: createTrafficRangeCoverage(rangeRows, totalStores),
  };
}

function createTrafficRangeCoverage(
  ranges: Record<DashboardTrafficOverviewRange, DashboardTrafficRangeData[]>,
  totalStores: number,
): DashboardTrafficReporting["coverage"] {
  return Object.fromEntries(
    trafficRanges().map((range) => [
      range,
      Object.fromEntries(
        DASHBOARD_TRAFFIC_BLOCKS.map((block) => [
          block,
          {
            reportingStores: ranges[range].filter((row) =>
              isReportingState(normalizeRangeAvailability(row.availability)[block]),
            ).length,
            totalStores,
          },
        ]),
      ),
    ]),
  ) as DashboardTrafficReporting["coverage"];
}

function createTrafficStoreReports(
  context: DashboardTrafficAggregationContext,
): DashboardTrafficStoreReport[] {
  const reports = context.stores.map((store): DashboardTrafficStoreReport => {
    const issues = trafficRanges().flatMap((range) => {
      const availability = normalizeRangeAvailability(
        resolveDashboardTrafficRangeData(store.traffic, range).availability,
      );
      return DASHBOARD_TRAFFIC_BLOCKS.flatMap((block) => {
        const state = availability[block];
        return state === "available" ? [] : [{ range, block, state }];
      });
    });
    const available = isDashboardTrafficAvailable(store.traffic);
    return {
      storeId: store.storeId,
      label: store.label,
      status: !available ? "failed" : issues.length ? "partial" : "reporting",
      lastSuccessfulAt: normalizeIsoTimestamp(
        store.traffic.reporting?.lastSuccessfulAt,
      ),
      issues,
      message: store.message?.trim() || null,
    };
  });

  reports.push(
    ...context.failures.map((failure): DashboardTrafficStoreReport => ({
      storeId: failure.storeId,
      label: failure.label,
      status: "failed",
      lastSuccessfulAt: null,
      issues: [],
      message: failure.message,
    })),
  );

  return reports.sort(
    (a, b) =>
      trafficReportStatusRank(a.status) - trafficReportStatusRank(b.status) ||
      a.label.localeCompare(b.label),
  );
}

function trafficReportStatusRank(status: DashboardTrafficStoreReport["status"]) {
  if (status === "failed") return 0;
  if (status === "partial") return 1;
  return 2;
}

function latestSuccessfulTimestamp(values: Array<string | null | undefined>) {
  const timestamps = values.flatMap((value) => {
    const normalized = normalizeIsoTimestamp(value);
    return normalized ? [{ value: normalized, time: Date.parse(normalized) }] : [];
  });
  return timestamps.sort((a, b) => b.time - a.time)[0]?.value || null;
}

function normalizeIsoTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeCacheAge(value: unknown) {
  const age = Number(value);
  return Number.isFinite(age) && age > 0 ? Math.floor(age) : 0;
}

function isReportingState(state: DashboardTrafficAvailabilityState) {
  return state === "available" || state === "partial";
}

function trafficRanges(): DashboardTrafficOverviewRange[] {
  return [...DASHBOARD_TRAFFIC_OVERVIEW_RANGES];
}

function createTrafficRangeDataMap(
  create: (range: DashboardTrafficRange) => DashboardTrafficRangeData,
): Record<DashboardTrafficRange, DashboardTrafficRangeData> {
  return Object.fromEntries(
    DASHBOARD_TRAFFIC_RANGES.map((range) => [range, create(range)]),
  ) as Record<DashboardTrafficRange, DashboardTrafficRangeData>;
}

function trafficRangeAvailability(
  state: DashboardTrafficAvailabilityState,
): DashboardTrafficRangeAvailability {
  return {
    metrics: state,
    trend: state,
    sources: state,
    countries: state,
    devices: state,
  };
}

function nonNegativeInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function aggregateTimeZoneContext(
  traffic: TrafficOverviewResponse[],
): Pick<TrafficOverviewResponse, "timeZone" | "timeZoneMode"> {
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

function aggregateTrafficDiagnostics(
  traffic: TrafficOverviewResponse[],
): Pick<TrafficOverviewResponse, "generatedAt" | "cacheAge" | "isStale"> {
  const generated = traffic.flatMap((item) => {
    const value = normalizeIsoTimestamp(item.generatedAt);
    return value ? [{ value, timestamp: Date.parse(value) }] : [];
  });

  return {
    // The oldest source determines the freshness of an aggregate view.
    generatedAt:
      generated.sort((left, right) => left.timestamp - right.timestamp)[0]?.value ||
      null,
    cacheAge: Math.max(0, ...traffic.map((item) => normalizeCacheAge(item.cacheAge))),
    isStale: traffic.some((item) => Boolean(item.isStale)),
  };
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
