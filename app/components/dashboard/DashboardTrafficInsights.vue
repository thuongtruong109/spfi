<script setup lang="ts">
import type {
  DashboardTrafficBreakdown,
  DashboardTrafficSummary,
} from "~~/types/dashboard";

const props = defineProps<{
  traffic: DashboardTrafficSummary;
}>();

type AcquisitionView = "trafficTypes" | "platforms" | "aiReferrals";
type DiscoveryView = "landingPages" | "campaigns" | "browsers";

const { locale, t } = useLocalization();
const acquisitionView = ref<AcquisitionView>("trafficTypes");
const discoveryView = ref<DiscoveryView>("landingPages");

const acquisitionOptions = computed(() => [
  { value: "trafficTypes" as const, label: t("dashboard.trafficTypes") },
  { value: "platforms" as const, label: t("dashboard.trafficPlatforms") },
  { value: "aiReferrals" as const, label: t("dashboard.trafficAiReferrals") },
]);

const discoveryOptions = computed(() => [
  { value: "landingPages" as const, label: t("dashboard.trafficLandingPages") },
  { value: "campaigns" as const, label: t("dashboard.trafficCampaigns") },
  { value: "browsers" as const, label: t("dashboard.trafficBrowsers") },
]);

const funnelStages = computed(() => [
  {
    key: "sessions",
    label: t("dashboard.trafficFunnelSessions"),
    value: props.traffic.last30Days.sessions,
  },
  {
    key: "cart",
    label: t("dashboard.trafficFunnelCart"),
    value: props.traffic.last30Days.cartAdditions,
  },
  {
    key: "checkout",
    label: t("dashboard.trafficFunnelCheckout"),
    value: props.traffic.last30Days.reachedCheckouts,
  },
  {
    key: "purchase",
    label: t("dashboard.trafficFunnelPurchase"),
    value: props.traffic.last30Days.completedCheckouts,
  },
]);

const acquisitionRows = computed<DashboardTrafficBreakdown[]>(
  () => props.traffic[acquisitionView.value],
);
const discoveryRows = computed<DashboardTrafficBreakdown[]>(
  () => props.traffic[discoveryView.value],
);

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
  return props.traffic.last30Days.sessions
    ? value / props.traffic.last30Days.sessions
    : 0;
}

function width(value: number) {
  return `${Math.max(0, Math.min(100, sessionShare(value) * 100))}%`;
}
</script>

<template>
  <section class="traffic-insights">
    <article class="traffic-insight-card traffic-funnel-card">
      <header>
        <div>
          <h3>{{ t("dashboard.trafficFunnelTitle") }}</h3>
          <p>{{ t("dashboard.trafficFunnelSubtitle") }}</p>
        </div>
        <span>{{ t("dashboard.trafficThirtyDays") }}</span>
      </header>

      <div class="traffic-funnel-steps">
        <div v-for="stage in funnelStages" :key="stage.key">
          <span>{{ stage.label }}</span>
          <strong>{{ formatNumber(stage.value) }}</strong>
          <div class="traffic-insight-bar">
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
    </article>

    <div class="traffic-insight-grid">
      <article class="traffic-insight-card">
        <header>
          <div>
            <h3>{{ t("dashboard.trafficAcquisitionTitle") }}</h3>
            <p>{{ t("dashboard.trafficAcquisitionSubtitle") }}</p>
          </div>
        </header>
        <div
          class="traffic-insight-switch"
          :aria-label="t('dashboard.trafficAcquisitionTitle')"
        >
          <button
            v-for="option in acquisitionOptions"
            :key="option.value"
            type="button"
            :class="{ active: acquisitionView === option.value }"
            :aria-pressed="acquisitionView === option.value"
            @click="acquisitionView = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <div v-if="acquisitionRows.length" class="traffic-insight-list">
          <div v-for="row in acquisitionRows" :key="row.label">
            <span>
              <strong :title="row.label">{{ row.label }}</strong>
              <small>{{ formatPercent(sessionShare(row.sessions)) }}</small>
            </span>
            <div class="traffic-insight-bar">
              <i :style="{ width: width(row.sessions) }" />
            </div>
            <b>{{ formatNumber(row.sessions) }}</b>
          </div>
        </div>
        <div v-else class="traffic-insight-empty">
          {{ t("dashboard.trafficNoInsightData") }}
        </div>
      </article>

      <article class="traffic-insight-card">
        <header>
          <div>
            <h3>{{ t("dashboard.trafficDiscoveryTitle") }}</h3>
            <p>{{ t("dashboard.trafficDiscoverySubtitle") }}</p>
          </div>
        </header>
        <div
          class="traffic-insight-switch"
          :aria-label="t('dashboard.trafficDiscoveryTitle')"
        >
          <button
            v-for="option in discoveryOptions"
            :key="option.value"
            type="button"
            :class="{ active: discoveryView === option.value }"
            :aria-pressed="discoveryView === option.value"
            @click="discoveryView = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <div v-if="discoveryRows.length" class="traffic-insight-list">
          <div v-for="row in discoveryRows" :key="row.label">
            <span>
              <strong :title="row.label">{{ row.label }}</strong>
              <small>{{ formatPercent(sessionShare(row.sessions)) }}</small>
            </span>
            <div class="traffic-insight-bar">
              <i :style="{ width: width(row.sessions) }" />
            </div>
            <b>{{ formatNumber(row.sessions) }}</b>
          </div>
        </div>
        <div v-else class="traffic-insight-empty">
          {{ t("dashboard.trafficNoInsightData") }}
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.traffic-insights {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.traffic-insight-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.traffic-insight-card {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: var(--surface);
}

.traffic-insight-card > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.traffic-insight-card h3 {
  color: var(--text);
  font-size: 12px;
}

.traffic-insight-card header p {
  margin-top: 3px;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.4;
}

.traffic-insight-card header > span {
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

.traffic-insight-switch {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
  overflow-x: auto;
}

.traffic-insight-switch button {
  flex: 0 0 auto;
  min-height: 27px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-low);
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 9px;
  font-weight: 650;
}

.traffic-insight-switch button:hover,
.traffic-insight-switch button.active {
  border-color: color-mix(in srgb, var(--green) 30%, var(--border));
  background: var(--green-soft);
  color: var(--green);
}

.traffic-insight-switch button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.traffic-insight-list {
  display: grid;
  gap: 9px;
}

.traffic-insight-list > div {
  display: grid;
  grid-template-columns: minmax(100px, 1fr) minmax(70px, 0.8fr) 42px;
  align-items: center;
  gap: 8px;
}

.traffic-insight-list span {
  display: flex;
  min-width: 0;
  justify-content: space-between;
  gap: 6px;
}

.traffic-insight-list strong,
.traffic-insight-list small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.traffic-insight-list strong {
  color: var(--text);
  font-size: 9px;
}

.traffic-insight-list small {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 8px;
}

.traffic-insight-list b {
  color: var(--text);
  font-size: 9px;
  text-align: right;
}

.traffic-insight-bar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-low);
}

.traffic-insight-bar i {
  display: block;
  height: 100%;
  min-width: 2px;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--green), var(--blue));
}

.traffic-insight-empty {
  display: grid;
  min-height: 150px;
  place-items: center;
  color: var(--muted);
  font-size: 10px;
  text-align: center;
}

@media (max-width: 850px) {
  .traffic-insight-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
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
