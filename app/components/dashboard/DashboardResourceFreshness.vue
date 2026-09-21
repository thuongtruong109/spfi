<script setup lang="ts">
import { computed } from "vue";
import type {
  DashboardResourceState,
  DashboardService,
  DashboardStoreFailure,
  StoreDashboardSnapshot,
} from "~~/types/dashboard";
import { DASHBOARD_SERVICES } from "~~/types/dashboard";
import { summarizeDashboardResource } from "~~/utils/dashboard-resource";

const props = defineProps<{
  stores: StoreDashboardSnapshot[];
  failures?: DashboardStoreFailure[];
}>();

const { locale, t } = useLocalization();
const rows = computed(() =>
  DASHBOARD_SERVICES.map((resource) =>
    summarizeDashboardResource(props.stores, props.failures || [], resource),
  ),
);

function resourceLabel(resource: DashboardService) {
  if (resource === "profile") return t("dashboard.resource.profile");
  if (resource === "orders") return t("dashboard.resource.orders");
  if (resource === "customers") return t("dashboard.resource.customers");
  if (resource === "products") return t("dashboard.resource.products");
  if (resource === "payments") return t("dashboard.resource.payments");
  if (resource === "users") return t("dashboard.resource.users");
  return t("dashboard.resource.traffic");
}

function stateLabel(state: DashboardResourceState) {
  if (state === "available") return t("dashboard.resourceState.available");
  if (state === "stale") return t("dashboard.resourceState.stale");
  if (state === "partial") return t("dashboard.resourceState.partial");
  if (state === "failed") return t("dashboard.resourceState.failed");
  return t("dashboard.resourceState.unavailable");
}

function formatDataAsOf(value: string | null) {
  if (!value) return t("dashboard.dataAsOfUnknown");
  return t("dashboard.dataAsOf", {
    time: new Intl.DateTimeFormat(locale.value, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value)),
  });
}
</script>

<template>
  <section class="resource-freshness" :aria-label="t('dashboard.resourceFreshness')">
    <div v-for="row in rows" :key="row.resource" class="resource-chip">
      <span class="resource-dot" :class="`is-${row.state}`" aria-hidden="true" />
      <span>
        <strong>{{ resourceLabel(row.resource) }}</strong>
        <small>{{ formatDataAsOf(row.dataAsOf) }}</small>
      </span>
      <em :class="`is-${row.state}`">
        {{ stateLabel(row.state) }} · {{ row.reporting }}/{{ row.total }}
      </em>
    </div>
  </section>
</template>

<style scoped>
.resource-freshness {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 7px;
  margin: 10px 0 14px;
}

.resource-chip {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0 7px;
  align-items: center;
  min-width: 0;
  padding: 8px 9px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-low);
}

.resource-chip > span:nth-child(2) {
  min-width: 0;
  display: grid;
}

.resource-chip strong,
.resource-chip small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-chip strong {
  color: var(--text-primary);
  font-size: 10px;
}

.resource-chip small {
  color: var(--text-muted);
  font-size: 8.5px;
}

.resource-chip em {
  grid-column: 2;
  margin-top: 3px;
  color: var(--green);
  font-size: 8px;
  font-style: normal;
  font-weight: 700;
  text-transform: uppercase;
}

.resource-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
}

.resource-dot.is-stale {
  background: var(--amber);
}

.resource-chip em.is-stale {
  color: var(--amber);
}

.resource-dot.is-partial {
  background: var(--amber);
}

.resource-chip em.is-partial {
  color: var(--amber);
}

.resource-dot.is-failed {
  background: var(--red);
}

.resource-chip em.is-failed {
  color: var(--red);
}

.resource-dot.is-unavailable {
  background: var(--text-muted);
}

.resource-chip em.is-unavailable {
  color: var(--text-muted);
}
</style>
