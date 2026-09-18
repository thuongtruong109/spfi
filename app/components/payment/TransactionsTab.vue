<script setup lang="ts">
import { Clock, Filter, RotateCcw } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useLocalization } from "~/composables/useLocalization";
import { useStoreFeedback } from "~/composables/useStoreFeedback";
import { useOrderStore } from "~/stores/order";
import { usePaymentStore } from "~/stores/payment";
import type { Transaction } from "~/stores/payment";
import type { ShopifyPaymentsBalanceTransactionSearchFilters } from "~~/types/shopify-payments-graphql";
import { capitalize, fmtDate } from "~~/helpers";
import { getAdjustmentOrderTransactions } from "~~/utils/payment-transactions";

const paymentStore = usePaymentStore();
const orderStore = useOrderStore();
const { storeId, token, isReady } = useActiveShopAuth();
const feedback = useStoreFeedback();
const { locale, t } = useLocalization();
const { formatPaymentLabel } = useShopifyPaymentLabel();

const transactionType = ref("");
const payoutStatus = ref("");
const payoutDate = ref("");
const processedFrom = ref("");
const processedThrough = ref("");
const currency = ref("");
const cardLast4 = ref("");
const paymentMethod = ref("");
const transferId = ref("");
const taxExempt = ref<"" | "yes" | "no">("");
const hideTransfers = ref(false);
const testMode = ref<"" | "live" | "test">("");
const sinceId = ref("");
const lastId = ref("");
const currentPage = ref(1);
const pageSize = ref(20);
const payoutStatusOptions = computed(() => [
  { label: t("payment.allStatuses"), value: "" },
  { label: t("payment.pendingNotPaidOut"), value: "pending" },
  { label: t("payment.scheduled"), value: "scheduled" },
  { label: t("payment.inTransit"), value: "in_transit" },
  { label: t("payment.paid"), value: "paid" },
  { label: t("payment.failed"), value: "failed" },
  { label: t("payment.canceled"), value: "canceled" },
  { label: t("payment.actionRequired"), value: "action_required" },
]);
const taxExemptOptions = computed(() => [
  { label: t("payment.all"), value: "" },
  { label: t("payment.exempt"), value: "yes" },
  { label: t("payment.notExempt"), value: "no" },
]);
const testModeOptions = computed(() => [
  { label: t("payment.liveAndTest"), value: "" },
  { label: t("payment.liveOnly"), value: "live" },
  { label: t("payment.testOnly"), value: "test" },
]);

const activeFilterCount = computed(
  () =>
    [
      transactionType.value,
      payoutStatus.value,
      payoutDate.value,
      processedFrom.value,
      processedThrough.value,
      currency.value,
      cardLast4.value,
      paymentMethod.value,
      transferId.value,
      taxExempt.value,
      hideTransfers.value ? "hide-transfers" : "",
      testMode.value,
      sinceId.value,
      lastId.value,
    ].filter(Boolean).length,
);

const sortedTransactions = computed(() =>
  [...paymentStore.visibleBalanceTransactions].sort(
    (left, right) =>
      new Date(right.processed_at).getTime() - new Date(left.processed_at).getTime(),
  ),
);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(sortedTransactions.value.length / pageSize.value)),
);
const paginatedTransactions = computed(() => {
  const safePage = Math.min(currentPage.value, totalPages.value);
  const start = (safePage - 1) * pageSize.value;
  return sortedTransactions.value.slice(start, start + pageSize.value);
});

watch(totalPages, (count) => {
  if (currentPage.value > count) currentPage.value = count;
});

function setPayoutStatus(value: unknown) {
  payoutStatus.value = typeof value === "string" ? value : "";
}

function setTaxExempt(value: unknown) {
  taxExempt.value = value === "yes" || value === "no" ? value : "";
}

function setTestMode(value: unknown) {
  testMode.value = value === "live" || value === "test" ? value : "";
}

async function applyFilters(
  successMessage = t("payment.filtersApplied", {
    resource: t("payment.transactions"),
  }),
) {
  if (!isReady.value) {
    feedback.warning(t("payment.credentialsRequired"));
    return;
  }
  const filters = buildFilters();
  currentPage.value = 1;
  await paymentStore.fetchGraphqlBalanceTransactions(
    storeId.value,
    token.value,
    filters,
    { force: true },
  );
  feedback.requestResult({
    errorMessage: paymentStore.error,
    warningMessage: paymentStore.graphqlWarning,
    successMessage,
    fallbackError: t("payment.filtersFailed", {
      resource: t("payment.transactions"),
    }),
  });
}

function buildFilters(): ShopifyPaymentsBalanceTransactionSearchFilters {
  return {
    ...(transactionType.value ? { transaction_type: transactionType.value } : {}),
    ...(payoutStatus.value ? { payout_status: payoutStatus.value } : {}),
    ...(payoutDate.value ? { payout_date: payoutDate.value } : {}),
    ...(processedFrom.value ? { processed_at_min: processedFrom.value } : {}),
    ...(processedThrough.value ? { processed_at_max: processedThrough.value } : {}),
    ...(currency.value ? { currency: currency.value } : {}),
    ...(cardLast4.value ? { credit_card_last4: cardLast4.value } : {}),
    ...(paymentMethod.value ? { payment_method_name: paymentMethod.value } : {}),
    ...(transferId.value ? { payments_transfer_id: transferId.value } : {}),
    ...(taxExempt.value ? { tax_reporting_exempt: taxExempt.value === "yes" } : {}),
    ...(hideTransfers.value ? { hide_transfers: true } : {}),
    ...(testMode.value ? { test: testMode.value === "test" } : {}),
    ...(sinceId.value ? { since_id: sinceId.value } : {}),
    ...(lastId.value ? { last_id: lastId.value } : {}),
  };
}

async function showPending() {
  payoutStatus.value = "pending";
  await applyFilters(t("payment.pendingShown"));
}

async function resetFilters() {
  transactionType.value = "";
  payoutStatus.value = "";
  payoutDate.value = "";
  processedFrom.value = "";
  processedThrough.value = "";
  currency.value = "";
  cardLast4.value = "";
  paymentMethod.value = "";
  transferId.value = "";
  taxExempt.value = "";
  hideTransfers.value = false;
  testMode.value = "";
  sinceId.value = "";
  lastId.value = "";
  await applyFilters(
    t("payment.filtersReset", {
      resource: t("payment.transactions"),
    }),
  );
}

function getOrderName(transaction: Transaction) {
  if (transaction.source_order_name) return transaction.source_order_name;
  if (!transaction.source_order_id) return null;
  const order = orderStore.orders.find(
    (item) => String(item.id) === String(transaction.source_order_id),
  );
  return order?.name || `#${transaction.source_order_id}`;
}

function getCustomerName(transaction: Transaction) {
  if (!transaction.source_order_id) return "—";
  const customer = orderStore.orders.find(
    (item) => String(item.id) === String(transaction.source_order_id),
  )?.customer;
  if (!customer) return "—";
  return `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "—";
}

function payoutBadge(status: string) {
  if (status === "paid") return "badge-deposited";
  if (status === "in_transit") return "badge-in-transit";
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

function updatePageSize(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
}

async function changePage(page: number) {
  if (page <= totalPages.value) {
    currentPage.value = Math.max(1, page);
    return;
  }
  if (!paymentStore.transactionPageInfo.hasNextPage) return;
  await paymentStore.fetchMoreBalanceTransactions(
    storeId.value,
    token.value,
    buildFilters(),
  );
  if (!paymentStore.error) currentPage.value = Math.min(page, totalPages.value);
}
</script>

<template>
  <div class="transactions-tab">
    <PaymentFilterPanel
      :title="t('payment.transactionFilters')"
      :active-count="activeFilterCount"
      @submit="applyFilters()"
    >
      <template #toolbar>
        <CsvExportButton resource="payments" label="Export all CSV" />
      </template>
      <label class="payment-filter-field">
        <span>{{ t("payment.transactionType") }}</span>
        <input
          v-model.trim="transactionType"
          class="payment-filter-input"
          :placeholder="t('payment.transactionTypePlaceholder')"
        />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.payoutStatus") }}</span>
        <BaseSelect
          class-name="filter-select"
          :model-value="payoutStatus"
          :options="payoutStatusOptions"
          @update:model-value="setPayoutStatus"
        />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.payoutDate") }}</span>
        <input v-model="payoutDate" class="payment-filter-input" type="date" />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.processedFrom") }}</span>
        <input v-model="processedFrom" class="payment-filter-input" type="date" />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.processedThrough") }}</span>
        <input v-model="processedThrough" class="payment-filter-input" type="date" />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.currency") }}</span>
        <input
          v-model.trim="currency"
          class="payment-filter-input"
          maxlength="4"
          placeholder="USD"
        />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.cardLast4") }}</span>
        <input
          v-model.trim="cardLast4"
          class="payment-filter-input"
          inputmode="numeric"
          maxlength="4"
          placeholder="4242"
        />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.paymentMethod") }}</span>
        <input
          v-model.trim="paymentMethod"
          class="payment-filter-input"
          placeholder="Visa"
        />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.paymentsTransferId") }}</span>
        <input
          v-model.trim="transferId"
          class="payment-filter-input"
          inputmode="numeric"
          :placeholder="t('payment.transferIdPlaceholder')"
        />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.taxReporting") }}</span>
        <BaseSelect
          class-name="filter-select"
          :model-value="taxExempt"
          :options="taxExemptOptions"
          @update:model-value="setTaxExempt"
        />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.mode") }}</span>
        <BaseSelect
          class-name="filter-select"
          :model-value="testMode"
          :options="testModeOptions"
          @update:model-value="setTestMode"
        />
      </label>
      <label class="payment-filter-field">
        <span>{{ t("payment.afterTransactionId") }}</span>
        <input
          v-model.trim="sinceId"
          class="payment-filter-input"
          inputmode="numeric"
          placeholder="since_id"
        />
      </label>
      <div class="payment-filter-field payment-filter-checkbox">
        <span>{{ t("payment.transfers") }}</span>
        <BaseCheckbox v-model="hideTransfers" :label="t('payment.hideTransfers')" />
      </div>
      <label class="payment-filter-field">
        <span>{{ t("payment.beforeTransactionId") }}</span>
        <input
          v-model.trim="lastId"
          class="payment-filter-input"
          inputmode="numeric"
          placeholder="last_id"
        />
      </label>
      <template #actions>
        <BaseButton type="button" class="filter-action-pending" @click="showPending">
          <template #icon>
            <Clock />
          </template>
          {{ t("payment.showPending") }}
        </BaseButton>
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
          <th aria-sort="descending">{{ t("payment.processedAt") }}</th>
          <th>{{ t("payment.payoutStatus") }}</th>
          <th>{{ t("payment.order") }}</th>
          <th>{{ t("payment.customer") }}</th>
          <th>{{ t("payment.type") }}</th>
          <th>{{ t("payment.mode") }}</th>
          <th class="right">{{ t("payment.amount") }}</th>
          <th class="right">{{ t("payment.fee") }}</th>
          <th class="right">{{ t("payment.net") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="transaction in paginatedTransactions" :key="transaction.id">
          <td class="td-date">{{ fmtDate(transaction.processed_at) }}</td>
          <td>
            <span class="badge" :class="payoutBadge(transaction.payout_status)">
              {{
                transaction.payout_status === "paid"
                  ? t("payment.deposited")
                  : capitalize(transaction.payout_status)
              }}
            </span>
          </td>
          <td class="td-order">
            <NuxtLink
              v-if="transaction.source_order_id"
              class="link"
              :to="`/order/${transaction.source_order_id}`"
            >
              {{ getOrderName(transaction) }}
            </NuxtLink>
            <span v-else>—</span>
          </td>
          <td class="td-customer">{{ getCustomerName(transaction) }}</td>
          <td class="td-type">
            <strong>{{ formatPaymentLabel(transaction.type) }}</strong>
            <small v-if="transaction.source_type">
              {{
                t("payment.source", {
                  type: formatPaymentLabel(transaction.source_type),
                })
              }}
            </small>
            <details
              v-if="getAdjustmentOrderTransactions(transaction).length"
              class="adjustment-orders"
            >
              <summary>
                {{
                  t("payment.adjustedOrders", {
                    count: getAdjustmentOrderTransactions(transaction).length,
                    label:
                      getAdjustmentOrderTransactions(transaction).length === 1
                        ? t("payment.orderSingular")
                        : t("payment.orderPlural"),
                  })
                }}
              </summary>
              <div
                v-for="adjustment in getAdjustmentOrderTransactions(transaction)"
                :key="adjustment.id"
              >
                <NuxtLink
                  v-if="adjustment.order.id"
                  :to="`/order/${adjustment.order.id}`"
                >
                  {{ adjustment.order.name }}
                </NuxtLink>
                <span v-else>{{ adjustment.order.name }}</span>
                <span>
                  {{
                    t("payment.netSuffix", {
                      amount: formatMoney(adjustment.net, transaction.currency),
                    })
                  }}
                </span>
              </div>
            </details>
          </td>
          <td>
            <span v-if="transaction.test" class="mode-badge">{{
              t("payment.test")
            }}</span>
            <span v-else>{{ t("payment.live") }}</span>
          </td>
          <td class="right td-amount">
            {{ formatMoney(transaction.amount, transaction.currency) }}
          </td>
          <td class="right td-fee">
            {{ formatMoney(transaction.fee, transaction.currency) }}
          </td>
          <td class="right td-net">
            {{ formatMoney(transaction.net, transaction.currency) }}
          </td>
        </tr>
      </tbody>
    </table>

    <PaginationControls
      v-if="sortedTransactions.length || paymentStore.transactionPageInfo.hasNextPage"
      :page="currentPage"
      :page-size="pageSize"
      :total-items="sortedTransactions.length"
      :has-next-page="
        currentPage < totalPages || paymentStore.transactionPageInfo.hasNextPage
      "
      :loading="paymentStore.isLoadingTransactions"
      :item-label="t('payment.transactions')"
      @update:page="changePage"
      @update:page-size="updatePageSize"
    />
    <div v-else class="empty">{{ t("payment.noBalanceTransactions") }}</div>
  </div>
</template>

<style scoped>
.filter-action-pending {
  border-color: color-mix(in srgb, var(--amber) 35%, var(--border));
  background: var(--amber-soft);
  color: var(--amber);
}

.td-type strong,
.td-type small {
  display: block;
}

.td-type small {
  margin-top: 2px;
  color: var(--text-sub);
  font-size: 10px;
}

.adjustment-orders {
  margin-top: 5px;
  font-size: 10px;
}

.adjustment-orders summary {
  color: var(--text-link);
  cursor: pointer;
}

.adjustment-orders div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 3px;
}

.td-date {
  color: var(--text-secondary);
  white-space: nowrap;
}

.td-order a,
.link {
  color: var(--blue);
  font-weight: 500;
  text-decoration: none;
}

.td-customer {
  color: var(--text-primary);
  white-space: nowrap;
}

.td-order a:hover,
.link:hover {
  text-decoration: underline;
}

.td-type {
  color: var(--text-primary);
}

.td-amount,
.td-net {
  color: var(--text-primary);
  font-weight: 600;
}

.td-fee {
  color: var(--red);
  font-weight: 500;
}

.mode-badge {
  display: inline-flex;
  border-radius: 20px;
  padding: 2px 8px;
  background: var(--amber-soft);
  color: var(--amber);
  font-size: 11px;
  font-weight: 600;
}
</style>
