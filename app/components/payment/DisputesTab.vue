<script setup lang="ts">
import { Filter, RotateCcw } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useLocalization } from "~/composables/useLocalization";
import { useStoreFeedback } from "~/composables/useStoreFeedback";
import { usePaymentStore } from "~/stores/payment";
import type {
  ShopifyPaymentsDisputeFilters,
  ShopifyPaymentsDisputeStatus,
} from "~~/types/shopify-payments-graphql";
import { fmtDate } from "~~/helpers";

const paymentStore = usePaymentStore();
const { storeId, token, isReady } = useActiveShopAuth();
const feedback = useStoreFeedback();
const { locale, t } = useLocalization();
const { formatPaymentLabel } = useShopifyPaymentLabel();

const status = ref<"" | ShopifyPaymentsDisputeStatus>("");
const initiatedFrom = ref("");
const initiatedThrough = ref("");
const currentPage = ref(1);
const pageSize = ref(20);
const statusOptions = computed(() => [
  { label: t("payment.allStatuses"), value: "" },
  { label: t("payment.needsResponse"), value: "NEEDS_RESPONSE" },
  { label: t("payment.underReview"), value: "UNDER_REVIEW" },
  { label: t("payment.accepted"), value: "ACCEPTED" },
  { label: t("payment.prevented"), value: "PREVENTED" },
  { label: t("payment.won"), value: "WON" },
  { label: t("payment.lost"), value: "LOST" },
]);

const activeFilterCount = computed(
  () =>
    [status.value, initiatedFrom.value, initiatedThrough.value].filter(Boolean).length,
);

const sortedDisputes = computed(() =>
  [...paymentStore.visibleDisputes].sort(
    (left, right) =>
      new Date(right.initiatedAt).getTime() - new Date(left.initiatedAt).getTime(),
  ),
);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(sortedDisputes.value.length / pageSize.value)),
);
const paginatedDisputes = computed(() => {
  const safePage = Math.min(currentPage.value, totalPages.value);
  const start = (safePage - 1) * pageSize.value;
  return sortedDisputes.value.slice(start, start + pageSize.value);
});

watch(totalPages, (count) => {
  if (currentPage.value > count) currentPage.value = count;
});

function setStatus(value: unknown) {
  status.value =
    typeof value === "string" &&
    [
      "",
      "NEEDS_RESPONSE",
      "UNDER_REVIEW",
      "ACCEPTED",
      "PREVENTED",
      "WON",
      "LOST",
    ].includes(value)
      ? (value as "" | ShopifyPaymentsDisputeStatus)
      : "";
}

async function applyFilters(
  successMessage = t("payment.filtersApplied", {
    resource: t("payment.disputes"),
  }),
) {
  if (!isReady.value) {
    feedback.warning(t("payment.credentialsRequired"));
    return;
  }
  const filters = buildFilters();
  currentPage.value = 1;
  await paymentStore.fetchDisputes(storeId.value, token.value, filters, {
    force: true,
  });
  feedback.requestResult({
    errorMessage: paymentStore.error,
    successMessage,
    fallbackError: t("payment.filtersFailed", {
      resource: t("payment.disputes"),
    }),
  });
}

function buildFilters(): ShopifyPaymentsDisputeFilters {
  return {
    ...(status.value ? { status: status.value } : {}),
    ...(initiatedFrom.value ? { initiated_at_min: initiatedFrom.value } : {}),
    ...(initiatedThrough.value ? { initiated_at_max: initiatedThrough.value } : {}),
  };
}

async function resetFilters() {
  status.value = "";
  initiatedFrom.value = "";
  initiatedThrough.value = "";
  await applyFilters(
    t("payment.filtersReset", {
      resource: t("payment.disputes"),
    }),
  );
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

function deadlineClass(deadline: string | null, statusValue: string) {
  if (!deadline || statusValue !== "NEEDS_RESPONSE") return "";
  const days = (new Date(deadline).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "is-overdue";
  if (days <= 3) return "is-urgent";
  return "";
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
  if (!paymentStore.disputePageInfo.hasNextPage) return;
  await paymentStore.fetchMoreDisputes(storeId.value, token.value, buildFilters());
  if (!paymentStore.error) currentPage.value = Math.min(page, totalPages.value);
}
</script>

<template>
  <div class="disputes-tab">
    <PaymentFilterPanel
      :title="t('payment.disputeFilters')"
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
        <span>{{ t("payment.initiatedFrom") }}</span>
        <input v-model="initiatedFrom" class="payment-filter-input" type="date" />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.initiatedThrough") }}</span>
        <input v-model="initiatedThrough" class="payment-filter-input" type="date" />
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
          <th aria-sort="descending">{{ t("payment.initiated") }}</th>
          <th>{{ t("payment.order") }}</th>
          <th>{{ t("payment.status") }}</th>
          <th>{{ t("payment.typeReason") }}</th>
          <th>{{ t("payment.evidenceDue") }}</th>
          <th class="right">{{ t("payment.amount") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="dispute in paginatedDisputes" :key="dispute.id">
          <td class="td-date">{{ fmtDate(dispute.initiatedAt) }}</td>
          <td>
            <NuxtLink
              v-if="dispute.order"
              class="link"
              :to="`/order/${dispute.order.legacyResourceId}`"
            >
              {{ dispute.order.name }}
            </NuxtLink>
            <span v-else>—</span>
          </td>
          <td>
            <span class="status-badge" :class="`is-${dispute.status.toLowerCase()}`">
              {{ formatPaymentLabel(dispute.status) }}
            </span>
          </td>
          <td>
            <strong>{{ formatPaymentLabel(dispute.type) }}</strong>
            <small>{{ formatPaymentLabel(dispute.reasonDetails.reason) }}</small>
          </td>
          <td
            class="td-date"
            :class="deadlineClass(dispute.evidenceDueBy, dispute.status)"
          >
            {{ dispute.evidenceDueBy ? fmtDate(dispute.evidenceDueBy) : "—" }}
          </td>
          <td class="right td-amount">
            {{ formatMoney(dispute.amount.amount, dispute.amount.currencyCode) }}
          </td>
        </tr>
      </tbody>
    </table>

    <PaginationControls
      v-if="sortedDisputes.length || paymentStore.disputePageInfo.hasNextPage"
      :page="currentPage"
      :page-size="pageSize"
      :total-items="sortedDisputes.length"
      :has-next-page="
        currentPage < totalPages || paymentStore.disputePageInfo.hasNextPage
      "
      :loading="paymentStore.isLoadingDisputes"
      :item-label="t('payment.disputes')"
      @update:page="changePage"
      @update:page-size="updatePageSize"
    />
    <div v-else class="empty">{{ t("payment.noDisputes") }}</div>
  </div>
</template>

<style scoped>
td small {
  color: var(--text-sub);
  font-size: 11px;
}

td strong,
td small {
  display: block;
}

.status-badge {
  display: inline-flex;
  border-radius: 999px;
  padding: 3px 8px;
  background: var(--surface-soft);
  font-size: 11px;
  font-weight: 600;
}

.status-badge.is-needs_response,
.is-urgent {
  color: var(--amber);
}

.status-badge.is-won,
.status-badge.is-prevented {
  color: var(--green);
}

.status-badge.is-lost,
.is-overdue {
  color: var(--red);
}
</style>
