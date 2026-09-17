<script setup lang="ts">
import {
  BarChart3,
  FileText,
  Funnel,
  MapPin,
  Megaphone,
  MonitorSmartphone,
} from "@lucide/vue";
import type { DashboardTrafficSummary } from "~~/types/dashboard";
import type { DashboardTrafficDimensionOption } from "~~/utils/dashboard-traffic-dimensions";

const props = defineProps<{
  traffic: DashboardTrafficSummary;
}>();

const { locale, t } = useLocalization();

const acquisitionOptions = computed<DashboardTrafficDimensionOption[]>(() => [
  { key: "source", label: t("dashboard.trafficDetailSource") },
  { key: "referrerDomain", label: t("dashboard.trafficDetailReferrerDomain") },
  { key: "referrerTerms", label: t("dashboard.trafficDetailReferrerTerms") },
  { key: "trafficType", label: t("dashboard.trafficDetailTrafficType") },
  { key: "platform", label: t("dashboard.trafficDetailPlatform") },
  { key: "channel", label: t("dashboard.trafficDetailChannel") },
  { key: "medium", label: t("dashboard.trafficDetailMedium") },
  { key: "aiReferral", label: t("dashboard.trafficDetailAiReferral") },
]);

const audienceOptions = computed<DashboardTrafficDimensionOption[]>(() => [
  { key: "country", label: t("dashboard.trafficDetailCountry") },
  { key: "region", label: t("dashboard.trafficDetailRegion") },
  { key: "city", label: t("dashboard.trafficDetailCity") },
]);

const technologyOptions = computed<DashboardTrafficDimensionOption[]>(() => [
  { key: "deviceType", label: t("dashboard.trafficDetailDevice") },
  { key: "browser", label: t("dashboard.trafficDetailBrowser") },
  { key: "browserVersion", label: t("dashboard.trafficDetailBrowserVersion") },
  { key: "operatingSystem", label: t("dashboard.trafficDetailOs") },
  {
    key: "operatingSystemVersion",
    label: t("dashboard.trafficDetailOsVersion"),
  },
  { key: "apiClient", label: t("dashboard.trafficDetailApiClient") },
]);

const contentOptions = computed<DashboardTrafficDimensionOption[]>(() => [
  { key: "landingPagePath", label: t("dashboard.trafficDetailLandingPath") },
  { key: "landingPageType", label: t("dashboard.trafficDetailLandingType") },
  { key: "campaign", label: t("dashboard.trafficDetailCampaign") },
  {
    key: "campaignContent",
    label: t("dashboard.trafficDetailCampaignContent"),
  },
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
    <header class="traffic-analysis-header">
      <div>
        <h3><BarChart3 />{{ t("dashboard.trafficAnalysisTitle") }}</h3>
        <p>{{ t("dashboard.trafficAnalysisSubtitle") }}</p>
      </div>
      <span v-if="traffic.detailLimitReached">
        {{
          t("dashboard.trafficDetailLimited", {
            count: traffic.details.length,
          })
        }}
      </span>
    </header>

    <article class="traffic-funnel-card">
      <header>
        <div>
          <h3><Funnel />{{ t("dashboard.trafficFunnelTitle") }}</h3>
          <p>{{ t("dashboard.trafficFunnelSubtitle") }}</p>
        </div>
        <span>{{ t("dashboard.trafficThirtyDays") }}</span>
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
    </article>

    <div class="traffic-analysis-grid">
      <DashboardTrafficDimensionCard
        :icon="Megaphone"
        :title="t('dashboard.trafficAcquisitionTitle')"
        :subtitle="t('dashboard.trafficAcquisitionIntegratedSubtitle')"
        :rows="traffic.details"
        :options="acquisitionOptions"
      />
      <DashboardTrafficDimensionCard
        :icon="MapPin"
        :title="t('dashboard.trafficAudienceTitle')"
        :subtitle="t('dashboard.trafficAudienceSubtitle')"
        :rows="traffic.details"
        :options="audienceOptions"
      />
      <DashboardTrafficDimensionCard
        :icon="MonitorSmartphone"
        :title="t('dashboard.trafficTechnologyTitle')"
        :subtitle="t('dashboard.trafficTechnologySubtitle')"
        :rows="traffic.details"
        :options="technologyOptions"
      />
      <DashboardTrafficDimensionCard
        :icon="FileText"
        :title="t('dashboard.trafficContentTitle')"
        :subtitle="t('dashboard.trafficContentSubtitle')"
        :rows="traffic.details"
        :options="contentOptions"
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

.traffic-analysis-header > span {
  flex: 0 0 auto;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--amber-soft);
  color: var(--amber);
  font-size: 8px;
  font-weight: 700;
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
