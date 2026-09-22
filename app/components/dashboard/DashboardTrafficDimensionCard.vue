<script setup lang="ts">
import { ChevronDown, ChevronUp } from "@lucide/vue";
import type { Component } from "vue";
import type {
  DashboardTrafficDimensionKey,
  DashboardTrafficDimensions,
  DashboardTrafficRange,
} from "~~/types/dashboard";
import {
  trafficDimensionRequestKey,
  type DashboardTrafficDimensionOption,
} from "~~/utils/dashboard-traffic-dimensions";

const props = withDefaults(
  defineProps<{
    icon: Component;
    title: string;
    subtitle: string;
    dimensions: DashboardTrafficDimensions;
    options: DashboardTrafficDimensionOption[];
    range: DashboardTrafficRange;
    rangeLabel: string;
    loadingDimensions?: string[];
    lazyLoading?: boolean;
  }>(),
  { lazyLoading: true },
);

const emit = defineEmits<{
  dimensionChange: [dimension: DashboardTrafficDimensionKey];
}>();

const { locale, t } = useLocalization();
const activeDimension = ref<DashboardTrafficDimensionKey>(
  props.options[0]?.key || "source",
);
const expanded = ref(false);

const dimensionResult = computed(() => props.dimensions[activeDimension.value]);
const dimensionRows = computed(() => dimensionResult.value?.rows || []);
const loading = computed(() =>
  (props.loadingDimensions || []).includes(
    trafficDimensionRequestKey(props.range, activeDimension.value),
  ),
);
const visibleRows = computed(() =>
  expanded.value ? dimensionRows.value : dimensionRows.value.slice(0, 6),
);
const totalSessions = computed(() =>
  Math.max(
    dimensionResult.value?.totalSessions || 0,
    dimensionRows.value.reduce((total, row) => total + row.sessions, 0),
  ),
);
const activeDimensionLabel = computed(
  () =>
    props.options.find((option) => option.key === activeDimension.value)?.label ||
    props.title,
);
const donutSegments = computed(() => {
  const populatedRows = dimensionRows.value.filter((row) => row.sessions > 0);
  const returnedTotal = populatedRows.reduce((total, row) => total + row.sessions, 0);
  if (
    populatedRows.length <= 4 &&
    !dimensionResult.value?.hasMore &&
    returnedTotal >= totalSessions.value
  ) {
    return populatedRows.map((row) => ({
      label: row.label,
      value: row.sessions,
    }));
  }

  const leadingRows = populatedRows.slice(0, 3).map((row) => ({
    label: row.label,
    value: row.sessions,
  }));
  const leadingTotal = leadingRows.reduce((total, row) => total + row.value, 0);
  const remainder = Math.max(0, totalSessions.value - leadingTotal);
  if (remainder > 0) {
    leadingRows.push({
      label: t("dashboard.trafficOther"),
      value: remainder,
    });
  }
  return leadingRows;
});

watch(
  () =>
    [
      props.range,
      activeDimension.value,
      Boolean(props.dimensions[activeDimension.value]),
      props.lazyLoading,
    ] as const,
  ([, dimension, , lazyLoading]) => {
    expanded.value = false;
    if (lazyLoading) emit("dimensionChange", dimension);
  },
  { immediate: true },
);

function formatNumber(value: number, compact = false) {
  return new Intl.NumberFormat(locale.value, {
    ...(compact ? { notation: "compact" as const } : {}),
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat(locale.value, {
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
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}
</script>

<template>
  <article class="traffic-dimension-card">
    <div class="traffic-dimension-main">
      <header>
        <div>
          <h3><component :is="icon" aria-hidden="true" />{{ title }}</h3>
          <p>{{ subtitle }}</p>
        </div>
        <span v-if="dimensionResult" class="traffic-dimension-count">
          {{
            t(
              dimensionResult.hasMore
                ? "dashboard.trafficDimensionValuesMore"
                : "dashboard.trafficDimensionValues",
              {
                count: dimensionRows.length,
              },
            )
          }}
        </span>
      </header>

      <div class="traffic-dimension-switch" :aria-label="title">
        <button
          v-for="option in options"
          :key="option.key"
          type="button"
          :class="{ active: activeDimension === option.key }"
          :aria-pressed="activeDimension === option.key"
          @click="activeDimension = option.key"
        >
          {{ option.label }}
        </button>
      </div>

      <div v-if="loading && !dimensionResult" class="traffic-dimension-empty">
        {{ t("dashboard.trafficInsightsLoading") }}
      </div>

      <template v-else-if="dimensionRows.length">
        <div class="traffic-dimension-table-area">
          <div class="traffic-dimension-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{{ t("dashboard.trafficDimension") }}</th>
                  <th>{{ t("dashboard.trafficSessions") }}</th>
                  <th>{{ t("dashboard.trafficPageviews") }}</th>
                  <th>{{ t("dashboard.trafficDetailViewsPerSession") }}</th>
                  <th>{{ t("dashboard.trafficDetailBounceRate") }}</th>
                  <th>{{ t("dashboard.trafficDetailDuration") }}</th>
                  <th>{{ t("dashboard.trafficFunnelPurchase") }}</th>
                  <th>{{ t("dashboard.trafficDetailConversionRate") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in visibleRows" :key="row.label">
                  <td :title="row.label">{{ row.label }}</td>
                  <td>{{ formatNumber(row.sessions) }}</td>
                  <td>{{ formatNumber(row.pageviews) }}</td>
                  <td>{{ formatDecimal(row.pageviewsPerSession) }}</td>
                  <td>{{ formatPercent(row.bounceRate) }}</td>
                  <td>{{ formatDuration(row.averageSessionDuration) }}</td>
                  <td>{{ formatNumber(row.completedCheckouts) }}</td>
                  <td>{{ formatPercent(row.conversionRate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <button
            v-if="dimensionRows.length > 6"
            type="button"
            class="traffic-dimension-expand"
            @click="expanded = !expanded"
          >
            <ChevronUp v-if="expanded" aria-hidden="true" />
            <ChevronDown v-else aria-hidden="true" />
            {{
              expanded
                ? t("dashboard.trafficDimensionShowLess")
                : t("dashboard.trafficDimensionShowAll", {
                    count: dimensionRows.length,
                  })
            }}
          </button>
        </div>
      </template>

      <div v-else class="traffic-dimension-empty">
        {{ t("dashboard.trafficNoInsightData") }}
      </div>
    </div>

    <aside v-if="dimensionRows.length" class="traffic-dimension-donut">
      <header>
        <strong>{{ activeDimensionLabel }}</strong>
        <span>{{ rangeLabel }}</span>
      </header>
      <DashboardDonutChart
        :segments="donutSegments"
        :center-value="formatNumber(totalSessions, true)"
        :ariaLabel="
          t('dashboard.trafficDimensionChartLabel', {
            title: activeDimensionLabel,
          })
        "
        :size="150"
        :strokeWidth="12"
      />
    </aside>
  </article>
</template>

<style scoped>
.traffic-dimension-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 200px;
  align-items: start;
  gap: 14px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: var(--surface);
}

.traffic-dimension-main {
  min-width: 0;
}

.traffic-dimension-main > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 11px;
}

.traffic-dimension-card h3 {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text);
  font-size: 13px;
}

.traffic-dimension-card h3 svg {
  width: 15px;
  height: 15px;
  color: var(--green);
}

.traffic-dimension-card header p {
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.4;
}

.traffic-dimension-count {
  flex: 0 0 auto;
  padding: 4px 7px;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
}

.traffic-dimension-switch {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  overflow-x: auto;
  scrollbar-width: thin;
}

.traffic-dimension-switch button {
  flex: 0 0 auto;
  min-height: 27px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-low);
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  font-weight: 650;
}

.traffic-dimension-switch button:hover,
.traffic-dimension-switch button.active {
  border-color: color-mix(in srgb, var(--green) 30%, var(--border));
  background: var(--green-soft);
  color: var(--green);
}

.traffic-dimension-switch button:focus-visible,
.traffic-dimension-expand:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.traffic-dimension-table-area {
  min-width: 0;
}

.traffic-dimension-donut {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--surface-soft);
}

.traffic-dimension-donut > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.traffic-dimension-donut > header strong {
  overflow: hidden;
  color: var(--text);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.traffic-dimension-donut > header span {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
}

.traffic-dimension-donut :deep(.donut-layout) {
  gap: 8px;
}

.traffic-dimension-donut :deep(.donut-legend) {
  gap: 7px;
}

.traffic-dimension-donut :deep(.donut-legend div) {
  font-size: 10px;
}

.traffic-dimension-donut :deep(.donut-legend span) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.traffic-dimension-table-scroll {
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.traffic-dimension-table-scroll table {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.traffic-dimension-table-scroll th,
.traffic-dimension-table-scroll td {
  min-width: 92px;
  padding: 8px 9px;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 10px;
  text-align: right;
  white-space: nowrap;
}

.traffic-dimension-table-scroll th {
  position: sticky;
  z-index: 2;
  top: 0;
  background: var(--surface-low);
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.025em;
  text-transform: uppercase;
}

.traffic-dimension-table-scroll th:first-child,
.traffic-dimension-table-scroll td:first-child {
  position: sticky;
  z-index: 1;
  left: 0;
  width: 150px;
  min-width: 130px;
  max-width: 190px;
  overflow: hidden;
  background: var(--surface);
  text-align: left;
  text-overflow: ellipsis;
}

.traffic-dimension-table-scroll th:first-child {
  z-index: 3;
  background: var(--surface-low);
}

.traffic-dimension-table-scroll tr:last-child td {
  border-bottom: 0;
}

.traffic-dimension-table-scroll th:last-child,
.traffic-dimension-table-scroll td:last-child {
  border-right: 0;
}

.traffic-dimension-table-scroll tbody tr:hover td {
  background: var(--surface-soft);
}

.traffic-dimension-expand {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 5px;
  margin-top: 9px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-low);
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  font-weight: 650;
}

.traffic-dimension-expand svg {
  width: 12px;
}

.traffic-dimension-empty {
  display: grid;
  min-height: 210px;
  place-items: center;
  color: var(--muted);
  font-size: 10px;
  text-align: center;
}

@media (max-width: 900px) {
  .traffic-dimension-card {
    grid-template-columns: minmax(0, 1fr);
  }

  .traffic-dimension-donut {
    width: min(100%, 420px);
  }
}

@media (max-width: 620px) {
  .traffic-dimension-main > header {
    flex-direction: column;
  }
}
</style>
