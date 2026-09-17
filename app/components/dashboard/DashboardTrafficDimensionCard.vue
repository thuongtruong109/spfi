<script setup lang="ts">
import { ChevronDown, ChevronUp } from "@lucide/vue";
import type { Component } from "vue";
import type { DashboardTrafficDetailRow } from "~~/types/dashboard";
import {
  aggregateTrafficDimension,
  type DashboardTrafficDimensionKey,
  type DashboardTrafficDimensionOption,
} from "~~/utils/dashboard-traffic-dimensions";

const props = defineProps<{
  icon: Component;
  title: string;
  subtitle: string;
  rows: DashboardTrafficDetailRow[];
  options: DashboardTrafficDimensionOption[];
}>();

const { locale, t } = useLocalization();
const activeDimension = ref<DashboardTrafficDimensionKey>(
  props.options[0]?.key || "source",
);
const expanded = ref(false);

const dimensionRows = computed(() =>
  aggregateTrafficDimension(props.rows, activeDimension.value),
);
const chartRows = computed(() => dimensionRows.value.slice(0, 5));
const visibleRows = computed(() =>
  expanded.value ? dimensionRows.value : dimensionRows.value.slice(0, 6),
);
const totalSessions = computed(() =>
  dimensionRows.value.reduce((total, row) => total + row.sessions, 0),
);
const maximumSessions = computed(() => chartRows.value[0]?.sessions || 0);

watch(activeDimension, () => {
  expanded.value = false;
});

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

function sessionShare(value: number) {
  return totalSessions.value ? value / totalSessions.value : 0;
}

function chartWidth(value: number) {
  return `${maximumSessions.value ? Math.max(3, (value / maximumSessions.value) * 100) : 0}%`;
}
</script>

<template>
  <article class="traffic-dimension-card">
    <header>
      <div>
        <h3><component :is="icon" aria-hidden="true" />{{ title }}</h3>
        <p>{{ subtitle }}</p>
      </div>
      <span v-if="dimensionRows.length" class="traffic-dimension-count">
        {{
          t("dashboard.trafficDimensionValues", {
            count: dimensionRows.length,
          })
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

    <template v-if="dimensionRows.length">
      <div
        class="traffic-dimension-chart"
        role="img"
        :aria-label="t('dashboard.trafficDimensionChartLabel', { title })"
      >
        <div v-for="row in chartRows" :key="row.label">
          <span>
            <strong :title="row.label">{{ row.label }}</strong>
            <small>{{ formatPercent(sessionShare(row.sessions)) }}</small>
          </span>
          <div><i :style="{ width: chartWidth(row.sessions) }" /></div>
          <b>{{ formatNumber(row.sessions, true) }}</b>
        </div>
      </div>

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
    </template>

    <div v-else class="traffic-dimension-empty">
      {{ t("dashboard.trafficNoInsightData") }}
    </div>
  </article>
</template>

<style scoped>
.traffic-dimension-card {
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: var(--surface);
}

.traffic-dimension-card > header {
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

.traffic-dimension-chart {
  display: grid;
  gap: 8px;
  margin-bottom: 13px;
  padding: 11px;
  border-radius: 11px;
  background: var(--surface-soft);
}

.traffic-dimension-chart > div {
  display: grid;
  grid-template-columns: minmax(160px, 0.8fr) minmax(160px, 1.8fr) 54px;
  align-items: center;
  gap: 8px;
}

.traffic-dimension-chart span {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
}

.traffic-dimension-chart strong,
.traffic-dimension-chart small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.traffic-dimension-chart strong {
  color: var(--text);
  font-size: 10px;
}

.traffic-dimension-chart small {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 9px;
}

.traffic-dimension-chart > div > div {
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-low);
}

.traffic-dimension-chart i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--green), var(--blue));
}

.traffic-dimension-chart b {
  color: var(--text);
  font-size: 10px;
  text-align: right;
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
  min-width: 190px;
  max-width: 320px;
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

@media (max-width: 620px) {
  .traffic-dimension-card > header {
    flex-direction: column;
  }

  .traffic-dimension-chart > div {
    grid-template-columns: minmax(90px, 1fr) minmax(70px, 0.9fr) 38px;
  }
}
</style>
