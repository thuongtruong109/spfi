<script setup lang="ts">
import { CircleCheck, Scale, TriangleAlert } from "@lucide/vue";
import type { DashboardReconciliation } from "~~/types/dashboard";

const props = defineProps<{ reconciliation: DashboardReconciliation }>();
const { locale, t } = useLocalization();
const mismatches = computed(
  () => props.reconciliation.rows.filter((row) => row.status === "mismatch").length,
);

function money(value: number, currency: string) {
  return new Intl.NumberFormat(locale.value, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
</script>

<template>
  <article class="dashboard-panel reconciliation-panel">
    <header class="dashboard-panel-header">
      <div>
        <h2><Scale /> {{ t("dashboard.reconciliationTitle") }}</h2>
        <p>{{ t("dashboard.reconciliationSubtitle") }}</p>
      </div>
      <span v-if="reconciliation.available" :class="{ 'has-mismatch': mismatches }">
        <TriangleAlert v-if="mismatches" />
        <CircleCheck v-else />
        {{
          mismatches
            ? t("dashboard.reconciliationMismatchCount", { count: mismatches })
            : t("dashboard.reconciliationMatched")
        }}
      </span>
    </header>

    <div v-if="!reconciliation.available" class="dashboard-list-placeholder">
      {{ t("dashboard.reconciliationUnavailable") }}
    </div>
    <div v-else-if="!reconciliation.rows.length" class="dashboard-list-placeholder">
      {{ t("dashboard.reconciliationEmpty") }}
    </div>
    <div v-else class="dashboard-table-scroll">
      <table class="dashboard-data-table">
        <thead>
          <tr>
            <th>{{ t("dashboard.currencies") }}</th>
            <th class="numeric">{{ t("dashboard.reconciliationOrders") }}</th>
            <th class="numeric">{{ t("dashboard.reconciliationPayments") }}</th>
            <th class="numeric">{{ t("dashboard.reconciliationDifference") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in reconciliation.rows" :key="row.currency">
            <td>{{ row.currency }}</td>
            <td class="numeric">{{ money(row.orderTotal, row.currency) }}</td>
            <td class="numeric">{{ money(row.paymentGross, row.currency) }}</td>
            <td class="numeric" :class="{ 'has-mismatch': row.status === 'mismatch' }">
              {{ money(row.difference, row.currency) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="reconciliation-note">{{ t("dashboard.reconciliationNote") }}</p>
  </article>
</template>

<style scoped>
.reconciliation-panel {
  margin-top: 14px;
}

.dashboard-panel-header p,
.reconciliation-note {
  color: var(--text-muted);
  font-size: 9px;
}

.dashboard-panel-header > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--green);
  font-size: 10px;
  font-weight: 700;
}

.dashboard-panel-header > span.has-mismatch,
td.has-mismatch {
  color: var(--amber);
}

.dashboard-panel-header > span svg {
  width: 14px;
  height: 14px;
}

.reconciliation-note {
  margin: 10px 0 0;
}
</style>
