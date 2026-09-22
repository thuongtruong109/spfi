<script setup lang="ts">
import { ExternalLink } from "@lucide/vue";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import { fmtDateTime, fmtMoney } from "~~/utils/order";
import { getSafeExternalUrl } from "~~/utils/safe-url";

const store = useCommerceOpsStore();
const { t } = useLocalization();
</script>

<template>
  <div class="ops-panel">
    <div class="ops-panel-toolbar">
      <div>
        <h3>{{ t("operations.checkout.title") }}</h3>
        <p>{{ t("operations.checkout.description") }}</p>
      </div>
    </div>
    <div v-if="store.errors.abandonedCheckouts" class="ops-resource-error" role="alert">
      <strong>{{ t("operations.checkout.unavailable") }}</strong>
      <span>{{ store.errors.abandonedCheckouts }}</span>
      <small>{{ t("operations.checkout.scopeHint") }}</small>
    </div>
    <div
      v-else-if="
        store.loadingResources.includes('abandonedCheckouts') &&
        !store.abandonedCheckouts.length
      "
      class="ops-empty is-loading"
      role="status"
    >
      <ApiLoadingIcon variant="section" aria-hidden="true" />
      <span>{{ t("operations.checkout.loading") }}</span>
    </div>
    <div v-else-if="store.abandonedCheckouts.length" class="ops-table-scroll">
      <table class="ops-table">
        <thead>
          <tr>
            <th>{{ t("operations.checkout.columnCheckout") }}</th>
            <th>{{ t("operations.columnCustomer") }}</th>
            <th>{{ t("operations.checkout.columnCart") }}</th>
            <th>{{ t("operations.columnTotal") }}</th>
            <th>{{ t("operations.checkout.columnActivity") }}</th>
            <th>{{ t("operations.columnStatus") }}</th>
            <th class="ops-actions-column">
              {{ t("operations.checkout.columnRecovery") }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="checkout in store.abandonedCheckouts" :key="checkout.id">
            <td>
              <strong>{{ checkout.name }}</strong>
            </td>
            <td>
              <span>{{ checkout.customerName || t("operations.guest") }}</span>
              <small>{{ checkout.email || t("operations.noEmail") }}</small>
            </td>
            <td>
              <span>{{
                t("operations.itemCount", { count: checkout.itemCount })
              }}</span>
              <small>{{
                checkout.itemTitles.slice(0, 2).join(", ") ||
                t("operations.checkout.cartUnavailable")
              }}</small>
            </td>
            <td>
              {{
                fmtMoney(checkout.totalPrice.amount, checkout.totalPrice.currencyCode)
              }}
            </td>
            <td>{{ fmtDateTime(checkout.updatedAt) }}</td>
            <td>
              <span class="ops-status">{{
                checkout.completedAt
                  ? t("operations.checkout.recovered")
                  : t("operations.checkout.open")
              }}</span>
            </td>
            <td>
              <a
                v-if="!checkout.completedAt && getSafeExternalUrl(checkout.recoveryUrl)"
                :href="getSafeExternalUrl(checkout.recoveryUrl) || undefined"
                class="ops-link-button"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t("operations.checkout.openRecovery") }}
                <ExternalLink :size="14" />
              </a>
              <small v-else>{{
                checkout.completedAt
                  ? t("operations.checkout.completed")
                  : t("operations.checkout.noSafeUrl")
              }}</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="ops-empty">{{ t("operations.checkout.empty") }}</div>
  </div>
</template>
