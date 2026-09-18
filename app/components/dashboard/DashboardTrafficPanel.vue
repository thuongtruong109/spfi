<script setup lang="ts">
import {
  CalendarDays,
  CalendarRange,
  ChartLine,
  ChartNoAxesCombined,
  ChartPie,
  Eye,
  MousePointerClick,
  ShoppingCart,
  UsersRound,
} from "@lucide/vue";
import type {
  DashboardTrafficBreakdown,
  DashboardTrafficSummary,
} from "~~/types/dashboard";

const props = defineProps<{
  traffic: DashboardTrafficSummary;
  loading?: boolean;
  storeCount: number;
  showInsights?: boolean;
}>();

const { locale, t } = useLocalization();
const range = ref<"24h" | "7d" | "30d">("24h");
const breakdown = ref<"sources" | "countries" | "devices">("sources");

const rangeOptions = [
  { value: "24h" as const, label: "24H" },
  { value: "7d" as const, label: "7D" },
  { value: "30d" as const, label: "30D" },
];

const breakdownOptions = computed(() => [
  { value: "sources" as const, label: t("dashboard.trafficSources") },
  { value: "countries" as const, label: t("dashboard.trafficCountries") },
  { value: "devices" as const, label: t("dashboard.trafficDevices") },
]);

const points = computed(() => {
  if (range.value === "24h") return props.traffic.hourly;
  return range.value === "7d" ? props.traffic.daily.slice(-7) : props.traffic.daily;
});
const granularity = computed(() => (range.value === "24h" ? "hour" : "day"));
const breakdownRows = computed<DashboardTrafficBreakdown[]>(
  () => props.traffic[breakdown.value],
);
const breakdownSegments = computed(() => {
  const leadingRows = breakdownRows.value
    .filter((row) => row.sessions > 0)
    .slice(0, 3)
    .map((row) => ({ label: row.label, value: row.sessions }));
  const leadingTotal = leadingRows.reduce((total, row) => total + row.value, 0);
  const knownTotal = props.traffic.last30Days.sessions || leadingTotal;
  const remainder = Math.max(0, knownTotal - leadingTotal);

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
</script>

<template>
  <article class="dashboard-panel traffic-panel">
    <div v-if="loading && !traffic.available" class="traffic-state">
      {{ t("dashboard.trafficLoading") }}
    </div>
    <div v-else-if="!traffic.available" class="traffic-state traffic-unavailable">
      <ChartLine />
      <strong>{{ t("dashboard.trafficUnavailable") }}</strong>
      <span>{{ t("dashboard.trafficPermissionHint") }}</span>
    </div>
    <template v-else>
      <section class="traffic-metric-grid">
        <div>
          <span><MousePointerClick />{{ t("dashboard.trafficTodaySessions") }}</span>
          <strong>{{ formatNumber(traffic.today.sessions) }}</strong>
          <small>
            {{
              t("dashboard.trafficBounceRate", {
                value: formatPercent(traffic.today.bounceRate),
              })
            }}
          </small>
        </div>
        <div>
          <span><UsersRound />{{ t("dashboard.trafficTodayVisitors") }}</span>
          <strong>{{ formatNumber(traffic.today.visitors) }}</strong>
          <small>{{ t("dashboard.trafficUniqueShopify") }}</small>
        </div>
        <div>
          <span><Eye />{{ t("dashboard.trafficTodayPageviews") }}</span>
          <strong>{{ formatNumber(traffic.today.pageviews) }}</strong>
          <small>
            {{
              t("dashboard.trafficViewsPerSession", {
                value: traffic.today.pageviewsPerSession.toFixed(1),
              })
            }}
          </small>
        </div>
        <div>
          <span><CalendarDays />{{ t("dashboard.trafficSevenDaySessions") }}</span>
          <strong>{{ formatNumber(traffic.last7Days.sessions) }}</strong>
          <small>
            {{
              t("dashboard.trafficVisitorsDetail", {
                count: formatNumber(traffic.last7Days.visitors),
              })
            }}
          </small>
        </div>
        <div>
          <span><CalendarRange />{{ t("dashboard.trafficThirtyDaySessions") }}</span>
          <strong>{{ formatNumber(traffic.last30Days.sessions) }}</strong>
          <small>
            {{
              t("dashboard.trafficVisitorsDetail", {
                count: formatNumber(traffic.last30Days.visitors),
              })
            }}
          </small>
        </div>
        <div>
          <span><ShoppingCart />{{ t("dashboard.trafficConversion") }}</span>
          <strong>{{ formatPercent(traffic.last30Days.conversionRate) }}</strong>
          <small>
            {{
              t("dashboard.trafficAverageDuration", {
                value: formatDuration(traffic.last30Days.averageSessionDuration),
              })
            }}
          </small>
        </div>
      </section>

      <section class="traffic-content-grid">
        <div class="traffic-chart-card">
          <div class="traffic-section-heading">
            <strong><ChartNoAxesCombined />{{ t("dashboard.trafficTrend") }}</strong>
            <div
              class="dashboard-segmented-control"
              :aria-label="t('dashboard.trafficRange')"
            >
              <button
                v-for="option in rangeOptions"
                :key="option.value"
                type="button"
                :class="{ active: range === option.value }"
                @click="range = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <DashboardTrafficChart :points="points" :granularity="granularity" />
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
          <div v-if="breakdownSegments.length" class="traffic-breakdown-chart">
            <DashboardDonutChart
              :segments="breakdownSegments"
              :center-label="t('dashboard.trafficSessions')"
              :center-value="formatNumber(traffic.last30Days.sessions)"
              :ariaLabel="t('dashboard.trafficBreakdownChartLabel')"
              :size="154"
            />
          </div>
          <div v-else class="traffic-breakdown-empty">
            {{ t("dashboard.trafficNoBreakdown") }}
          </div>
        </div>
      </section>

      <DashboardTrafficInsights v-if="showInsights" :traffic="traffic" />
    </template>
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

.traffic-metric-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.traffic-metric-grid > div {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-soft);
}

.traffic-metric-grid span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.045em;
  text-transform: uppercase;
}

.traffic-metric-grid span svg {
  width: 12px;
  height: 12px;
  color: var(--green);
}

.traffic-metric-grid strong {
  overflow: hidden;
  color: var(--text);
  font-size: 20px;
  line-height: 1.2;
  text-overflow: ellipsis;
}

.traffic-metric-grid small {
  overflow: hidden;
  color: var(--muted);
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
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
