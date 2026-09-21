<script setup lang="ts">
import {
  ChartLine,
  ChartNoAxesCombined,
  ChartPie,
  Clock3,
  Eye,
  MousePointerClick,
  ShoppingCart,
  UsersRound,
} from "@lucide/vue";
import ApiLoadingIcon from "~/components/ApiLoadingIcon.vue";
import type {
  DashboardTrafficBlock,
  DashboardTrafficBreakdown,
  DashboardTrafficDimensionKey,
  DashboardTrafficRange,
  DashboardTrafficSummary,
  TrafficDimensionLoadProgress,
} from "~~/types/dashboard";
import { DASHBOARD_TRAFFIC_RANGE_DEFINITIONS } from "~~/types/dashboard";
import { resolveDashboardTrafficRangeData } from "~~/utils/dashboard-traffic";

const props = defineProps<{
  traffic: DashboardTrafficSummary;
  loading?: boolean;
  loadingInsightDimensions?: string[];
  storeCount: number;
  showInsights?: boolean;
  exportPending?: boolean;
  fullLoading?: boolean;
  fullLoadProgress?: TrafficDimensionLoadProgress;
  lazyInsightLoading?: boolean;
  rangeLoading?: boolean;
}>();

const emit = defineEmits<{
  dimensionChange: [
    request: {
      range: DashboardTrafficRange;
      dimension: DashboardTrafficDimensionKey;
    },
  ];
  rangeChange: [range: DashboardTrafficRange];
}>();

const { locale, t } = useLocalization();
const range = ref<DashboardTrafficRange>("24h");
const breakdown = ref<"sources" | "countries" | "devices">("sources");

watch(range, (value) => emit("rangeChange", value), { immediate: true });

const breakdownOptions = computed(() => [
  { value: "sources" as const, label: t("dashboard.trafficSources") },
  { value: "countries" as const, label: t("dashboard.trafficCountries") },
  { value: "devices" as const, label: t("dashboard.trafficDevices") },
]);

const rangeLabel = computed(() =>
  t(DASHBOARD_TRAFFIC_RANGE_DEFINITIONS[range.value].labelKey),
);
const selectedRangeData = computed(() =>
  resolveDashboardTrafficRangeData(props.traffic, range.value),
);

const trendPoints = computed(() => selectedRangeData.value.trend);
const points = computed(() => trendPoints.value);
const granularity = computed(
  () => DASHBOARD_TRAFFIC_RANGE_DEFINITIONS[range.value].granularity,
);
const selectedBreakdownData = computed(() => selectedRangeData.value[breakdown.value]);
const breakdownRows = computed<DashboardTrafficBreakdown[]>(
  () => selectedBreakdownData.value || [],
);
const selectedMetrics = computed(() => selectedRangeData.value.metrics);
const metricsAvailability = computed(
  () => selectedRangeData.value.availability.metrics,
);
const trendAvailability = computed(() => selectedRangeData.value.availability.trend);
const trendUnavailable = computed(
  () => trendAvailability.value === "failed" || !trendPoints.value,
);
const breakdownAvailability = computed(
  () => selectedRangeData.value.availability[breakdown.value],
);
const metricsFailed = computed(
  () => metricsAvailability.value === "failed" || !selectedMetrics.value,
);
const breakdownUnavailable = computed(
  () => breakdownAvailability.value === "failed" || !selectedBreakdownData.value,
);
const selectedBreakdownLabel = computed(
  () =>
    breakdownOptions.value.find((option) => option.value === breakdown.value)?.label ||
    breakdown.value,
);
const trafficHasQueryFailure = computed(() =>
  Object.values(props.traffic.availability || {}).some(
    (state) => state === "failed" || state === "partial",
  ),
);
const trafficTimeZoneNote = computed(() => {
  if (props.traffic.timeZoneMode === "per-store") {
    return t("dashboard.trafficTimezonePerStore");
  }
  if (props.traffic.timeZone) {
    return t("dashboard.trafficTimezoneStore", {
      timeZone: props.traffic.timeZone,
    });
  }
  return "";
});
const reportingTotalStores = computed(() =>
  Math.max(0, props.storeCount, props.traffic.reporting?.totalStores || 0),
);
const hasReportingMetadata = computed(
  () => (props.traffic.reporting?.totalStores || 0) > 0,
);
const reportingStores = computed(() =>
  Math.min(
    reportingTotalStores.value,
    Math.max(
      0,
      hasReportingMetadata.value
        ? props.traffic.reporting.reportingStores
        : props.traffic.availableStores,
    ),
  ),
);
const breakdownCoverage = computed(() =>
  breakdownOptions.value.map((option) => {
    const coverage = resolveBlockCoverage(option.value);
    return { ...option, ...coverage };
  }),
);
const breakdownKnownTotal = computed(() => {
  const breakdownTotal = breakdownRows.value.reduce(
    (total, row) => total + Math.max(0, row.sessions),
    0,
  );
  return breakdownAvailability.value === "partial"
    ? breakdownTotal
    : selectedMetrics.value?.sessions || breakdownTotal;
});
const breakdownSegments = computed(() => {
  const leadingRows = breakdownRows.value
    .filter((row) => row.sessions > 0)
    .slice(0, 3)
    .map((row) => ({ label: row.label, value: row.sessions }));
  const leadingTotal = leadingRows.reduce((total, row) => total + row.value, 0);
  const remainder = Math.max(0, breakdownKnownTotal.value - leadingTotal);

  if (remainder > 0) {
    leadingRows.push({
      label: t("dashboard.trafficOther"),
      value: remainder,
    });
  }

  return leadingRows;
});

function formatNumber(value: number) {
  return new Intl.NumberFormat(locale.value, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat(locale.value, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDuration(value: number) {
  const seconds = Math.max(0, Math.round(value));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function resolveBlockCoverage(block: DashboardTrafficBlock) {
  const reported = hasReportingMetadata.value
    ? props.traffic.reporting?.coverage?.[range.value]?.[block]
    : undefined;
  const totalStores = Math.max(reportingTotalStores.value, reported?.totalStores || 0);
  if (reported) {
    return {
      reportingStores: Math.min(totalStores, Math.max(0, reported.reportingStores)),
      totalStores,
    };
  }

  const state = selectedRangeData.value.availability[block];
  return {
    reportingStores:
      state === "available" || state === "partial" ? reportingStores.value : 0,
    totalStores,
  };
}

function formatCoverage(reporting: number, total: number) {
  const percent = total ? Math.round((reporting / total) * 100) : 0;
  return t("dashboard.trafficCoverageValue", { reporting, total, percent });
}
</script>

<template>
  <article class="dashboard-panel traffic-panel">
    <DashboardTrafficReportingStatus
      :traffic="traffic"
      :loading="loading"
      :store-count="storeCount"
      :range="range"
      :range-label="rangeLabel"
    >
      <template #actions>
        <div v-if="traffic.available" class="traffic-toolbar-actions">
          <slot name="controls-prefix" />
          <DashboardTrafficControls
            v-model="range"
            :data="selectedRangeData"
            :points="points"
            :range-label="rangeLabel"
            :export-pending="exportPending"
            :extended-ranges="showInsights"
          />
        </div>
      </template>
    </DashboardTrafficReportingStatus>
    <div v-if="loading && !traffic.available" class="traffic-state">
      {{ t("dashboard.trafficLoading") }}
    </div>
    <div v-else-if="!traffic.available" class="traffic-state traffic-unavailable">
      <ChartLine />
      <strong>{{
        t(
          trafficHasQueryFailure
            ? "dashboard.trafficQueryFailed"
            : "dashboard.trafficUnavailable",
        )
      }}</strong>
      <span v-if="!trafficHasQueryFailure">{{
        t("dashboard.trafficPermissionHint")
      }}</span>
    </div>
    <div v-else class="traffic-data-stage" :aria-busy="fullLoading || rangeLoading">
      <div
        class="traffic-data-content"
        :class="{ 'is-loading': fullLoading || rangeLoading }"
      >
        <div
          v-if="metricsFailed || metricsAvailability === 'partial'"
          class="traffic-query-warning"
          role="status"
        >
          {{
            t(
              metricsAvailability === "partial" && !metricsFailed
                ? "dashboard.trafficQueryPartial"
                : "dashboard.trafficMetricsQueryFailed",
              { range: rangeLabel },
            )
          }}
        </div>
        <div class="traffic-overview-row">
          <section class="traffic-metric-grid">
            <div>
              <span
                ><MousePointerClick />{{ t("dashboard.trafficMetricSessions") }}</span
              >
              <strong>{{
                metricsFailed ? "—" : formatNumber(selectedMetrics?.sessions || 0)
              }}</strong>
              <small>{{ rangeLabel }}</small>
            </div>
            <div>
              <span><UsersRound />{{ t("dashboard.trafficMetricVisitors") }}</span>
              <strong>{{
                metricsFailed ? "—" : formatNumber(selectedMetrics?.visitors || 0)
              }}</strong>
              <small>{{ t("dashboard.trafficUniqueShopify") }}</small>
            </div>
            <div>
              <span><Eye />{{ t("dashboard.trafficMetricPageviews") }}</span>
              <strong>{{
                metricsFailed ? "—" : formatNumber(selectedMetrics?.pageviews || 0)
              }}</strong>
              <small v-if="!metricsFailed">
                {{
                  t("dashboard.trafficViewsPerSession", {
                    value: (selectedMetrics?.pageviewsPerSession || 0).toFixed(1),
                  })
                }}
              </small>
            </div>
            <div>
              <span
                ><ChartNoAxesCombined />{{ t("dashboard.trafficMetricBounce") }}</span
              >
              <strong>{{
                metricsFailed ? "—" : formatPercent(selectedMetrics?.bounceRate || 0)
              }}</strong>
              <small v-if="!metricsFailed">
                {{
                  t("dashboard.trafficBouncesDetail", {
                    count: formatNumber(selectedMetrics?.bounces || 0),
                  })
                }}
              </small>
            </div>
            <div>
              <span><ShoppingCart />{{ t("dashboard.trafficMetricConversion") }}</span>
              <strong>{{
                metricsFailed
                  ? "—"
                  : formatPercent(selectedMetrics?.conversionRate || 0)
              }}</strong>
              <small v-if="!metricsFailed">
                {{
                  t("dashboard.trafficConversionsDetail", {
                    count: formatNumber(selectedMetrics?.completedCheckouts || 0),
                  })
                }}
              </small>
            </div>
            <div>
              <span><Clock3 />{{ t("dashboard.trafficMetricDuration") }}</span>
              <strong>
                {{
                  metricsFailed
                    ? "—"
                    : formatDuration(selectedMetrics?.averageSessionDuration || 0)
                }}
              </strong>
              <small>{{ rangeLabel }}</small>
            </div>
          </section>
        </div>

        <section class="traffic-content-grid">
          <div class="traffic-chart-card">
            <div class="traffic-section-heading">
              <strong><ChartNoAxesCombined />{{ t("dashboard.trafficTrend") }}</strong>
              <span class="traffic-active-range">{{ rangeLabel }}</span>
            </div>
            <div v-if="trendUnavailable" class="traffic-query-error">
              {{ t("dashboard.trafficTrendQueryFailed", { range: rangeLabel }) }}
            </div>
            <template v-else>
              <p v-if="trafficTimeZoneNote" class="traffic-timezone-note">
                {{ trafficTimeZoneNote }}
              </p>
              <DashboardTrafficChart
                :points="points || []"
                :granularity="granularity"
              />
              <p v-if="trendAvailability === 'partial'" class="traffic-query-note">
                {{ t("dashboard.trafficQueryPartial") }}
              </p>
            </template>
          </div>

          <div class="traffic-breakdown-card">
            <div class="traffic-section-heading traffic-breakdown-heading">
              <strong><ChartPie />{{ t("dashboard.trafficBreakdown") }}</strong>
              <div
                class="dashboard-segmented-control"
                :aria-label="t('dashboard.trafficBreakdown')"
              >
                <button
                  v-for="option in breakdownOptions"
                  :key="option.value"
                  type="button"
                  :class="{ active: breakdown === option.value }"
                  @click="breakdown = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
            <div
              v-if="breakdownUnavailable"
              class="traffic-breakdown-empty traffic-query-error"
            >
              {{
                t("dashboard.trafficBreakdownQueryFailed", {
                  dimension: selectedBreakdownLabel,
                  range: rangeLabel,
                })
              }}
            </div>
            <div v-else-if="breakdownSegments.length" class="traffic-breakdown-chart">
              <DashboardDonutChart
                :segments="breakdownSegments"
                :center-label="t('dashboard.trafficSessions')"
                :center-value="formatNumber(breakdownKnownTotal)"
                :ariaLabel="t('dashboard.trafficBreakdownChartLabel')"
                :size="154"
              />
            </div>
            <div v-else class="traffic-breakdown-empty">
              {{ t("dashboard.trafficNoBreakdown") }}
            </div>
            <p v-if="breakdownAvailability === 'partial'" class="traffic-query-note">
              {{ t("dashboard.trafficQueryPartial") }}
            </p>
            <div class="traffic-breakdown-coverage">
              <span
                v-for="row in breakdownCoverage"
                :key="row.value"
                :class="{ 'is-partial': row.reportingStores < row.totalStores }"
              >
                {{ row.label }}
                {{ formatCoverage(row.reportingStores, row.totalStores) }}
              </span>
            </div>
          </div>
        </section>

        <DashboardTrafficInsights
          v-if="showInsights"
          :data="selectedRangeData"
          :range="range"
          :range-label="rangeLabel"
          :loading-dimensions="loadingInsightDimensions"
          :lazy-loading="lazyInsightLoading"
          @dimension-change="emit('dimensionChange', { range, dimension: $event })"
        />
      </div>
      <div
        v-if="rangeLoading"
        class="traffic-range-loading"
        role="status"
        aria-live="polite"
      >
        <ApiLoadingIcon :size="20" aria-hidden="true" />
        <strong>{{ t("dashboard.trafficRangeLoading", { range: rangeLabel }) }}</strong>
      </div>
      <DashboardTrafficLoadingOverlay
        v-else-if="fullLoading && fullLoadProgress"
        :range-label="rangeLabel"
        :progress="fullLoadProgress"
      />
    </div>
  </article>
</template>

<style scoped>
.traffic-panel {
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 10px;
  margin-top: 14px;
  background: var(--surface);
}

.traffic-availability {
  flex: 0 0 auto;
  padding: 5px 9px;
  border-radius: 999px;
  background: var(--green-soft);
  color: var(--green);
  font-size: 9px;
  font-weight: 700;
}

.traffic-state {
  display: grid;
  min-height: 180px;
  place-items: center;
  color: var(--muted);
  font-size: 12px;
}

.traffic-data-stage {
  position: relative;
  min-height: 320px;
}

.traffic-data-content {
  transition:
    opacity 0.18s ease,
    filter 0.18s ease;
}

.traffic-data-content.is-loading {
  pointer-events: none;
  user-select: none;
  opacity: 0.28;
  filter: saturate(0.45);
}

.traffic-range-loading {
  position: absolute;
  z-index: 4;
  top: 48px;
  left: 50%;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 12px 16px;
  border: 1px solid color-mix(in srgb, var(--green) 30%, var(--border));
  border-radius: 12px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-soft);
  color: var(--green);
  font-size: 11px;
  transform: translateX(-50%);
}

.traffic-unavailable {
  align-content: center;
  gap: 6px;
  padding: 24px;
  border: 1px dashed var(--border);
  border-radius: 13px;
  background: var(--surface-soft);
  text-align: center;
}

.traffic-unavailable svg {
  width: 28px;
  color: var(--amber);
}

.traffic-unavailable strong {
  color: var(--text);
}

.traffic-unavailable span {
  max-width: 560px;
}

.traffic-query-warning {
  margin-bottom: 10px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--amber) 24%, transparent);
  border-radius: 9px;
  background: var(--amber-soft);
  color: var(--amber);
  font-size: 10px;
  font-weight: 600;
}

.traffic-query-error {
  display: grid;
  min-height: 210px;
  place-items: center;
  color: var(--amber);
  font-size: 11px;
  text-align: center;
}

.traffic-query-note {
  margin-top: 6px;
  color: var(--amber);
  font-size: 9px;
  line-height: 1.4;
}

.traffic-breakdown-coverage {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 8px;
  margin-top: 7px;
  color: var(--muted);
  font-size: 8px;
}

.traffic-breakdown-coverage .is-partial {
  color: var(--amber);
}

.traffic-timezone-note {
  margin: 0 0 4px;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.4;
}

.traffic-overview-row {
  margin-bottom: 12px;
}

.traffic-toolbar-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.traffic-metric-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

.traffic-metric-grid > div {
  display: grid;
  min-width: 0;
  min-height: 104px;
  align-content: center;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-soft);
}

.traffic-metric-grid span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  justify-content: flex-start;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.045em;
  line-height: 1.35;
  text-align: left;
}

.traffic-metric-grid span svg {
  width: 12px;
  height: 12px;
  color: var(--green);
}

.traffic-metric-grid strong {
  overflow: hidden;
  color: var(--text);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  text-align: left;
  white-space: nowrap;
}

.traffic-metric-grid small {
  overflow: hidden;
  min-height: 1.35em;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.35;
  text-overflow: ellipsis;
}

.traffic-content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(320px, 0.85fr);
  gap: 12px;
}

.traffic-chart-card,
.traffic-breakdown-card {
  min-width: 0;
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: 13px;
}

.traffic-section-heading {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}

.traffic-section-heading > strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
  font-size: 11px;
}

.traffic-section-heading > strong svg {
  width: 14px;
  height: 14px;
  color: var(--green);
}

.traffic-active-range {
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
}

.dashboard-segmented-control {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-low);
}

.dashboard-segmented-control button {
  min-height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 9px;
  font-weight: 600;
}

.dashboard-segmented-control button:hover {
  color: var(--text);
}

.dashboard-segmented-control button.active {
  background: var(--surface);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--text) 10%, transparent);
  color: var(--green);
}

.dashboard-segmented-control button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.traffic-breakdown-chart {
  padding: 5px 0 1px;
}

.traffic-breakdown-chart :deep(.donut-layout) {
  grid-template-columns: 154px minmax(100px, 1fr);
  justify-items: stretch;
  gap: 10px;
}

.traffic-breakdown-chart :deep(.donut-layout canvas) {
  justify-self: center;
}

.traffic-breakdown-chart :deep(.donut-legend) {
  gap: 7px;
}

.traffic-breakdown-chart :deep(.donut-legend div) {
  font-size: 9px;
}

.traffic-breakdown-chart :deep(.donut-legend span) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.traffic-breakdown-empty {
  display: grid;
  min-height: 210px;
  place-items: center;
  color: var(--muted);
  font-size: 11px;
}

.traffic-note {
  margin-top: 10px;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.45;
}

@media (max-width: 1120px) {
  .traffic-metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 850px) {
  .traffic-content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .traffic-toolbar-actions {
    width: 100%;
    flex-wrap: wrap;
    margin-left: 0;
  }

  .traffic-section-heading.traffic-breakdown-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .traffic-metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .traffic-availability {
    align-self: flex-start;
  }

  .traffic-breakdown-chart :deep(.donut-layout) {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 390px) {
  .traffic-metric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
