<script setup lang="ts">
import { Filter, RotateCcw } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useLocalization } from "~/composables/useLocalization";
import { useStoreFeedback } from "~/composables/useStoreFeedback";
import { usePaymentStore } from "~/stores/payment";
import { buildPayoutDetailRoute } from "~/utils/payment-routes";
import type {
  ShopifyPayoutFilters,
  ShopifyPayoutStatus,
} from "~~/types/shopify-payment";
import { capitalize, fmtDate } from "~~/helpers";

const paymentStore = usePaymentStore();
const router = useRouter();
const route = useRoute();
const { storeId, token, isReady } = useActiveShopAuth();
const feedback = useStoreFeedback();
const { locale, t } = useLocalization();
const { formatPaymentLabel } = useShopifyPaymentLabel();

const status = ref<"" | ShopifyPayoutStatus>("");
const date = ref("");
const dateMin = ref("");
const dateMax = ref("");
const sinceId = ref("");
const lastId = ref("");
const currentPage = ref(1);
const pageSize = ref(20);
const statusOptions = computed(() => [
  { label: t("payment.allStatuses"), value: "" },
  { label: t("payment.scheduled"), value: "scheduled" },
  { label: t("payment.inTransit"), value: "in_transit" },
  { label: t("payment.paid"), value: "paid" },
  { label: t("payment.failed"), value: "failed" },
  { label: t("payment.canceled"), value: "canceled" },
]);

const activeFilterCount = computed(
  () =>
    [
      status.value,
      date.value,
      dateMin.value,
      dateMax.value,
      sinceId.value,
      lastId.value,
    ].filter(Boolean).length,
);

const sortedPayouts = computed(() =>
  [...paymentStore.visiblePayouts].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
  ),
);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(sortedPayouts.value.length / pageSize.value)),
);
const paginatedPayouts = computed(() => {
  const safePage = Math.min(currentPage.value, totalPages.value);
  const start = (safePage - 1) * pageSize.value;
  return sortedPayouts.value.slice(start, start + pageSize.value);
});

watch(totalPages, (count) => {
  if (currentPage.value > count) currentPage.value = count;
});

function setStatus(value: unknown) {
  status.value =
    typeof value === "string" &&
    ["", "scheduled", "in_transit", "paid", "failed", "canceled"].includes(value)
      ? (value as "" | ShopifyPayoutStatus)
      : "";
}

async function applyFilters(
  successMessage = t("payment.filtersApplied", {
    resource: t("payment.payouts"),
  }),
) {
  if (!isReady.value) {
    feedback.warning(t("payment.credentialsRequired"));
    return;
  }
  const filters = buildFilters();
  currentPage.value = 1;
  await paymentStore.fetchPayouts(storeId.value, token.value, filters, {
    force: true,
  });
  feedback.requestResult({
    errorMessage: paymentStore.error,
    successMessage,
    fallbackError: t("payment.filtersFailed", {
      resource: t("payment.payouts"),
    }),
  });
}

function buildFilters(): ShopifyPayoutFilters {
  return {
    ...(status.value ? { status: status.value } : {}),
    ...(date.value ? { date: date.value } : {}),
    ...(dateMin.value ? { date_min: dateMin.value } : {}),
    ...(dateMax.value ? { date_max: dateMax.value } : {}),
    ...(sinceId.value ? { since_id: sinceId.value } : {}),
    ...(lastId.value ? { last_id: lastId.value } : {}),
  };
}

async function resetFilters() {
  status.value = "";
  date.value = "";
  dateMin.value = "";
  dateMax.value = "";
  sinceId.value = "";
  lastId.value = "";
  await applyFilters(
    t("payment.filtersReset", {
      resource: t("payment.payouts"),
    }),
  );
}

function getPayoutMetadata(payoutId: string | number) {
  return paymentStore.payoutMetadata[String(payoutId)] || null;
}

function statusBadge(statusValue: string) {
  if (statusValue === "paid") return "badge-paid";
  if (statusValue === "in_transit") return "badge-in-transit";
  return "badge-pending";
}

function formatMoney(amount: string, currency: string) {
  const numericAmount = Number(amount || 0);
  try {
    return new Intl.NumberFormat(locale.value, {
      style: "currency",
      currency,
    }).format(numericAmount);
  } catch {
    return `${numericAmount.toFixed(2)} ${currency}`;
  }
}

function openPayoutDetail(payoutId: string | number) {
  void router.push(buildPayoutDetailRoute(payoutId, route.query, storeId.value));
}

function updatePageSize(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
}

async function changePage(page: number) {
  if (page <= totalPages.value) {
    currentPage.value = Math.max(1, page);
    return;
  }
  if (!paymentStore.payoutPageInfo.hasNextPage) return;
  await paymentStore.fetchMorePayouts(storeId.value, token.value, buildFilters());
  if (!paymentStore.error) currentPage.value = Math.min(page, totalPages.value);
}
</script>

<template>
  <div class="payouts-tab">
    <PaymentAccountSummary />

    <PaymentFilterPanel
      :title="t('payment.payoutFilters')"
      :active-count="activeFilterCount"
      @submit="applyFilters()"
    >
      <label class="payment-filter-field">
        <span>{{ t("payment.status") }}</span>
        <BaseSelect
          class-name="filter-select"
          :model-value="status"
          :options="statusOptions"
          @update:model-value="setStatus"
        />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.exactDate") }}</span>
        <input v-model="date" class="payment-filter-input" type="date" />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.from") }}</span>
        <input v-model="dateMin" class="payment-filter-input" type="date" />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.through") }}</span>
        <input v-model="dateMax" class="payment-filter-input" type="date" />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.afterPayoutId") }}</span>
        <input
          v-model.trim="sinceId"
          class="payment-filter-input"
          inputmode="numeric"
          placeholder="since_id"
        />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.beforePayoutId") }}</span>
        <input
          v-model.trim="lastId"
          class="payment-filter-input"
          inputmode="numeric"
          placeholder="last_id"
        />
      </label>
      <template #actions>
        <BaseButton type="button" @click="resetFilters">
          <template #icon>
            <RotateCcw />
          </template>
          {{ t("common.reset") }}
        </BaseButton>
        <BaseButton type="submit" variant="primary" :loading="paymentStore.isLoading">
          <template #icon>
            <Filter />
          </template>
          {{
            paymentStore.isLoading ? t("payment.loading") : t("payment.applyFilters")
          }}
        </BaseButton>
      </template>
    </PaymentFilterPanel>

    <table>
      <thead>
        <tr>
          <th aria-sort="descending">{{ t("payment.payoutDate") }}</th>
          <th>{{ t("payment.status") }}</th>
          <th>{{ t("payment.direction") }}</th>
          <th>{{ t("payment.businessEntity") }}</th>
          <th>{{ t("payment.bankTrace") }}</th>
          <th class="right">{{ t("payment.amount") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="payout in paginatedPayouts"
          :key="payout.id"
          @click="openPayoutDetail(payout.id)"
        >
          <td class="td-date">{{ fmtDate(payout.date) }}</td>
          <td>
            <span class="badge" :class="statusBadge(payout.status)">
              {{
                payout.status === "paid"
                  ? t("payment.deposited")
                  : capitalize(payout.status)
              }}
            </span>
          </td>
          <td>
            {{
              formatPaymentLabel(getPayoutMetadata(payout.id)?.transactionType) || "—"
            }}
          </td>
          <td>
            {{ getPayoutMetadata(payout.id)?.businessEntity.displayName || "—" }}
          </td>
          <td class="trace-id">
            {{ getPayoutMetadata(payout.id)?.externalTraceId || "—" }}
          </td>
          <td class="right td-net">
            {{ formatMoney(payout.amount, payout.currency) }}
          </td>
        </tr>
      </tbody>
    </table>

    <PaginationControls
      v-if="sortedPayouts.length || paymentStore.payoutPageInfo.hasNextPage"
      :page="currentPage"
      :page-size="pageSize"
      :total-items="sortedPayouts.length"
      :has-next-page="
        currentPage < totalPages || paymentStore.payoutPageInfo.hasNextPage
      "
      :loading="paymentStore.isLoadingPayouts"
      :item-label="t('payment.payouts')"
      @update:page="changePage"
      @update:page-size="updatePageSize"
    />
    <div v-else class="empty">{{ t("payment.noPayouts") }}</div>
  </div>
</template>

<style scoped>
.td-date {
  color: var(--text-secondary);
  white-space: nowrap;
}

.td-net {
  color: var(--text-primary);
  font-weight: 600;
}

.trace-id {
  max-width: 180px;
  overflow-wrap: anywhere;
  color: var(--text-sub);
  font-family: var(--font-mono);
  font-size: 11px;
}
</style>
