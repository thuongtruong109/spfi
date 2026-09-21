<script setup lang="ts">
import {
  BarChart3,
  FileText,
  Funnel,
  MapPin,
  Megaphone,
  MonitorSmartphone,
} from "@lucide/vue";
import type {
  DashboardTrafficDimensionKey,
  DashboardTrafficRange,
  DashboardTrafficRangeData,
} from "~~/types/dashboard";
import {
  DASHBOARD_TRAFFIC_DIMENSION_GROUPS,
  DASHBOARD_TRAFFIC_DIMENSION_LABEL_KEYS,
  type DashboardTrafficDimensionOption,
} from "~~/utils/dashboard-traffic-dimensions";

const props = withDefaults(
  defineProps<{
    data: DashboardTrafficRangeData;
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
const metrics = computed(() => props.data.metrics);

const acquisitionOptions = computed(() =>
  dimensionOptions(DASHBOARD_TRAFFIC_DIMENSION_GROUPS.acquisition),
);
const audienceOptions = computed(() =>
  dimensionOptions(DASHBOARD_TRAFFIC_DIMENSION_GROUPS.audience),
);
const technologyOptions = computed(() =>
  dimensionOptions(DASHBOARD_TRAFFIC_DIMENSION_GROUPS.technology),
);
const contentOptions = computed(() =>
  dimensionOptions(DASHBOARD_TRAFFIC_DIMENSION_GROUPS.content),
);

const funnelStages = computed(() => {
  if (!metrics.value) return [];
  return [
    {
      key: "sessions",
      label: t("dashboard.trafficFunnelSessions"),
      value: metrics.value.sessions,
    },
    {
      key: "cart",
      label: t("dashboard.trafficFunnelCart"),
      value: metrics.value.cartAdditions,
    },
    {
      key: "checkout",
      label: t("dashboard.trafficFunnelCheckout"),
      value: metrics.value.reachedCheckouts,
    },
    {
      key: "purchase",
      label: t("dashboard.trafficFunnelPurchase"),
      value: metrics.value.completedCheckouts,
    },
  ];
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

function sessionShare(value: number) {
  return metrics.value?.sessions ? value / metrics.value.sessions : 0;
}

function width(value: number) {
  return `${Math.max(0, Math.min(100, sessionShare(value) * 100))}%`;
}

function dimensionOptions(
  dimensions: readonly DashboardTrafficDimensionKey[],
): DashboardTrafficDimensionOption[] {
  return dimensions.map((key) => ({
    key,
    label: t(DASHBOARD_TRAFFIC_DIMENSION_LABEL_KEYS[key]),
  }));
}
</script>

<template>
  <section class="traffic-insights">
    <header class="traffic-analysis-header">
      <div>
        <h3><BarChart3 />{{ t("dashboard.trafficAnalysisTitle") }}</h3>
        <p>{{ t("dashboard.trafficAnalysisSubtitle") }}</p>
      </div>
    </header>

    <article
      v-if="data.availability.metrics !== 'failed' && data.metrics"
      class="traffic-funnel-card"
    >
      <header>
        <div>
          <h3><Funnel />{{ t("dashboard.trafficFunnelTitle") }}</h3>
          <p>{{ t("dashboard.trafficFunnelSubtitle") }}</p>
        </div>
        <span>{{ rangeLabel }}</span>
      </header>

      <div class="traffic-funnel-steps">
        <div v-for="stage in funnelStages" :key="stage.key">
          <span>{{ stage.label }}</span>
          <strong>{{ formatNumber(stage.value) }}</strong>
          <div class="traffic-funnel-bar">
            <i :style="{ width: width(stage.value) }" />
          </div>
          <small>
            {{
              t("dashboard.trafficSessionShare", {
                value: formatPercent(sessionShare(stage.value)),
              })
            }}
          </small>
        </div>
      </div>
      <p v-if="data.availability.metrics === 'partial'" class="traffic-funnel-warning">
        {{ t("dashboard.trafficQueryPartial") }}
      </p>
    </article>
    <div v-else class="traffic-funnel-card traffic-funnel-unavailable">
      {{ t("dashboard.trafficMetricsQueryFailed", { range: rangeLabel }) }}
    </div>

    <div class="traffic-analysis-grid">
      <DashboardTrafficDimensionCard
        :icon="Megaphone"
        :title="t('dashboard.trafficAcquisitionTitle')"
        :subtitle="t('dashboard.trafficAcquisitionIntegratedSubtitle')"
        :dimensions="data.dimensions"
        :options="acquisitionOptions"
        :range="range"
        :range-label="rangeLabel"
        :loading-dimensions="loadingDimensions"
        :lazy-loading="lazyLoading"
        @dimension-change="emit('dimensionChange', $event)"
      />
      <DashboardTrafficDimensionCard
        :icon="MapPin"
        :title="t('dashboard.trafficAudienceTitle')"
        :subtitle="t('dashboard.trafficAudienceSubtitle')"
        :dimensions="data.dimensions"
        :options="audienceOptions"
        :range="range"
        :range-label="rangeLabel"
        :loading-dimensions="loadingDimensions"
        :lazy-loading="lazyLoading"
        @dimension-change="emit('dimensionChange', $event)"
      />
      <DashboardTrafficDimensionCard
        :icon="MonitorSmartphone"
        :title="t('dashboard.trafficTechnologyTitle')"
        :subtitle="t('dashboard.trafficTechnologySubtitle')"
        :dimensions="data.dimensions"
        :options="technologyOptions"
        :range="range"
        :range-label="rangeLabel"
        :loading-dimensions="loadingDimensions"
        :lazy-loading="lazyLoading"
        @dimension-change="emit('dimensionChange', $event)"
      />
      <DashboardTrafficDimensionCard
        :icon="FileText"
        :title="t('dashboard.trafficContentTitle')"
        :subtitle="t('dashboard.trafficContentSubtitle')"
        :dimensions="data.dimensions"
        :options="contentOptions"
        :range="range"
        :range-label="rangeLabel"
        :loading-dimensions="loadingDimensions"
        :lazy-loading="lazyLoading"
        @dimension-change="emit('dimensionChange', $event)"
      />
    </div>
  </section>
</template>

<style scoped>
.traffic-insights {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.traffic-analysis-header,
.traffic-funnel-card > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.traffic-analysis-header {
  padding: 2px 2px 0;
}

.traffic-analysis-header h3,
.traffic-funnel-card h3 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
  font-size: 12px;
}

.traffic-analysis-header h3 svg,
.traffic-funnel-card h3 svg {
  width: 14px;
  height: 14px;
  color: var(--green);
}

.traffic-analysis-header p,
.traffic-funnel-card header p {
  margin-top: 3px;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.4;
}

.traffic-analysis-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.traffic-funnel-card {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: var(--surface);
}

.traffic-funnel-warning {
  margin-top: 9px;
  color: var(--amber);
  font-size: 9px;
}

.traffic-funnel-unavailable {
  display: grid;
  min-height: 150px;
  place-items: center;
  color: var(--amber);
  font-size: 11px;
  text-align: center;
}

.traffic-funnel-card > header {
  margin-bottom: 12px;
}

.traffic-funnel-card header > span {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
}

.traffic-funnel-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.traffic-funnel-steps > div {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 11px;
  border-radius: 11px;
  background: var(--surface-soft);
}

.traffic-funnel-steps span {
  overflow: hidden;
  color: var(--muted);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.traffic-funnel-steps strong {
  color: var(--text);
  font-size: 18px;
}

.traffic-funnel-steps small {
  color: var(--muted);
  font-size: 8px;
}

.traffic-funnel-bar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-low);
}

.traffic-funnel-bar i {
  display: block;
  height: 100%;
  min-width: 2px;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--green), var(--blue));
}

@media (max-width: 620px) {
  .traffic-analysis-header,
  .traffic-funnel-card > header {
    flex-direction: column;
  }

  .traffic-funnel-steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 390px) {
  .traffic-funnel-steps {
    grid-template-columns: 1fr;
  }
}
</style>
