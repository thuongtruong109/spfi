<script setup lang="ts">
import type {
  DashboardTrafficBlock,
  DashboardTrafficRange,
  DashboardTrafficStoreReport,
  DashboardTrafficSummary,
} from "~~/types/dashboard";
import { DASHBOARD_TRAFFIC_BLOCKS } from "~~/types/dashboard";
import { resolveDashboardTrafficRangeData } from "~~/utils/dashboard-traffic";

const props = defineProps<{
  traffic: DashboardTrafficSummary;
  loading?: boolean;
  storeCount: number;
  range: DashboardTrafficRange;
  rangeLabel: string;
}>();

const { locale, t } = useLocalization();
const totalStores = computed(() =>
  Math.max(0, props.storeCount, props.traffic.reporting?.totalStores || 0),
);
const hasReportingMetadata = computed(
  () => (props.traffic.reporting?.totalStores || 0) > 0,
);
const reportingStores = computed(() =>
  Math.min(
    totalStores.value,
    Math.max(
      0,
      hasReportingMetadata.value
        ? props.traffic.reporting.reportingStores
        : props.traffic.availableStores,
    ),
  ),
);
const problemStores = computed(() =>
  (props.traffic.reporting?.stores || []).filter(
    (store) => store.status !== "reporting",
  ),
);
const isStale = computed(() => Boolean(props.loading && props.traffic.available));
const lastSuccessfulAt = computed(
  () => props.traffic.reporting?.lastSuccessfulAt || null,
);
const freshnessKey = computed(() => {
  if (isStale.value) return "dashboard.trafficDataStale" as const;
  return lastSuccessfulAt.value
    ? ("dashboard.trafficDataFresh" as const)
    : ("dashboard.trafficDataNeverLoaded" as const);
});
const partialBlocks = computed(() =>
  DASHBOARD_TRAFFIC_BLOCKS.flatMap((block) => {
    const coverage = resolveBlockCoverage(block);
    return coverage.reportingStores < coverage.totalStores
      ? [{ block, ...coverage }]
      : [];
  }),
);

function resolveBlockCoverage(block: DashboardTrafficBlock) {
  const reported = hasReportingMetadata.value
    ? props.traffic.reporting?.coverage?.[props.range]?.[block]
    : undefined;
  const blockTotal = Math.max(totalStores.value, reported?.totalStores || 0);
  if (reported) {
    return {
      reportingStores: Math.min(blockTotal, Math.max(0, reported.reportingStores)),
      totalStores: blockTotal,
    };
  }

  const state = resolveDashboardTrafficRangeData(props.traffic, props.range)
    .availability[block];
  return {
    reportingStores:
      state === "available" || state === "partial" ? reportingStores.value : 0,
    totalStores: blockTotal,
  };
}

function formatCoverage(reporting: number, total: number) {
  const percent = total ? Math.round((reporting / total) * 100) : 0;
  return t("dashboard.trafficCoverageValue", { reporting, total, percent });
}

function blockLabel(block: DashboardTrafficBlock) {
  if (block === "metrics") return t("dashboard.trafficBlockMetrics");
  if (block === "trend") return t("dashboard.trafficTrend");
  if (block === "sources") return t("dashboard.trafficSources");
  if (block === "countries") return t("dashboard.trafficCountries");
  return t("dashboard.trafficDevices");
}

function rangeShortLabel(range: DashboardTrafficRange) {
  if (range === "24h") return t("dashboard.trafficRange24h");
  if (range === "7d") return t("dashboard.trafficRange7d");
  return t("dashboard.trafficRange30d");
}

function formatSuccessfulAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function storeDescription(store: DashboardTrafficStoreReport) {
  if (store.message) return store.message;
  if (!store.issues.length) return t("dashboard.trafficStoreIssueFallback");

  const visible = store.issues
    .slice(0, 3)
    .map((issue) => `${rangeShortLabel(issue.range)} · ${blockLabel(issue.block)}`);
  const remaining = store.issues.length - visible.length;
  return remaining > 0
    ? `${visible.join(", ")} · ${t("dashboard.trafficMoreIssues", { count: remaining })}`
    : visible.join(", ");
}
</script>

<template>
  <div v-if="totalStores" class="traffic-reporting">
    <div class="traffic-reporting-bar">
      <div class="traffic-reporting-summary">
        <strong>
          {{
            t("dashboard.trafficStoresReporting", {
              available: reportingStores,
              total: totalStores,
            })
          }}
        </strong>
        <span
          :class="[
            'traffic-freshness',
            { 'is-stale': isStale, 'has-no-success': !lastSuccessfulAt },
          ]"
        >
          {{ t(freshnessKey) }}
        </span>
        <span v-if="lastSuccessfulAt" class="traffic-last-success">
          {{
            t("dashboard.trafficLastSuccessfulAt", {
              time: formatSuccessfulAt(lastSuccessfulAt),
            })
          }}
        </span>
      </div>
      <details v-if="problemStores.length" class="traffic-store-issues">
        <summary>
          {{
            t("dashboard.trafficStoreIssues", {
              count: problemStores.length,
            })
          }}
        </summary>
        <ul>
          <li v-for="store in problemStores" :key="store.storeId">
            <strong>{{ store.label }}</strong>
            <span>{{ storeDescription(store) }}</span>
          </li>
        </ul>
      </details>
    </div>
    <div v-if="partialBlocks.length" class="traffic-coverage-warning" role="status">
      <strong>{{ t("dashboard.trafficPartialBlocks", { range: rangeLabel }) }}</strong>
      <span v-for="row in partialBlocks" :key="row.block">
        {{ blockLabel(row.block) }}
        {{ formatCoverage(row.reportingStores, row.totalStores) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.traffic-reporting-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.traffic-reporting-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 10px;
}

.traffic-reporting-summary > strong,
.traffic-freshness {
  padding: 4px 8px;
  border-radius: 999px;
}

.traffic-reporting-summary > strong {
  background: var(--green-soft);
  color: var(--green);
}

.traffic-freshness {
  background: var(--surface-soft);
  color: var(--green);
  font-weight: 700;
}

.traffic-freshness.is-stale {
  background: var(--amber-soft);
  color: var(--amber);
}

.traffic-freshness.has-no-success {
  color: var(--muted);
}

.traffic-last-success {
  font-size: 9px;
}

.traffic-store-issues {
  position: relative;
  flex: 0 0 auto;
  color: var(--amber);
  font-size: 10px;
}

.traffic-store-issues summary {
  cursor: pointer;
  font-weight: 700;
}

.traffic-store-issues ul {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 5;
  display: grid;
  width: min(360px, 75vw);
  max-height: 240px;
  gap: 8px;
  padding: 10px 12px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  margin: 0;
  background: var(--surface-overlay);
  box-shadow: var(--shadow-soft);
  list-style: none;
}

.traffic-store-issues li {
  display: grid;
  gap: 2px;
}

.traffic-store-issues li strong {
  color: var(--text);
}

.traffic-store-issues li span {
  color: var(--muted);
  line-height: 1.35;
}

.traffic-coverage-warning {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 12px;
  margin-bottom: 10px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--amber) 24%, transparent);
  border-radius: 9px;
  background: var(--amber-soft);
  color: var(--amber);
  font-size: 9px;
}

.traffic-coverage-warning strong {
  flex-basis: 100%;
  font-size: 10px;
}

@media (max-width: 620px) {
  .traffic-reporting-bar {
    flex-direction: column;
  }

  .traffic-store-issues ul {
    right: auto;
    left: 0;
  }
}
</style>
