<template>
  <NuxtLayout name="shop">
    <template #title>
      <div v-if="currentPayout && canDisplayPayout" class="breadcrumb">
        <NuxtLink :to="payoutsRoute" class="breadcrumb-back">
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M13 4l-6 6 6 6" />
          </svg>
        </NuxtLink>
        <span class="page-title">{{ t("payment.payoutDetails") }}</span>
        <span
          class="badge"
          :class="currentPayout.status === 'paid' ? 'badge-paid' : ''"
        >
          {{
            currentPayout.status === "paid"
              ? t("payment.deposited")
              : formatPaymentLabel(currentPayout.status)
          }}
        </span>
      </div>
      <div v-else class="breadcrumb">
        <NuxtLink :to="payoutsRoute" class="breadcrumb-back">
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M13 4l-6 6 6 6" />
          </svg>
        </NuxtLink>
        <span class="page-title">{{ t("common.loading") }}</span>
      </div>
    </template>

    <section class="page">
      <div
        v-if="
          payoutDetailState.status === 'idle' ||
          (payoutDetailState.status === 'loading' && !currentPayout)
        "
        class="empty"
        role="status"
      >
        {{ t("payment.loadingPayoutDetails") }}
      </div>
      <PayoutDataIssue
        v-else-if="payoutDetailState.status === 'not-found'"
        :title="t('payment.payoutNotFound')"
        :retryable="false"
      />
      <PayoutDataIssue
        v-else-if="payoutDetailState.status === 'unauthorized'"
        :title="t('payment.payoutUnauthorizedTitle')"
        :message="
          payoutDetailState.detailError || t('payment.payoutUnauthorizedDescription')
        "
        :loading="paymentStore.isLoadingPayoutDetail"
        @retry="retryPayoutDetail"
      />
      <PayoutDataIssue
        v-else-if="payoutDetailState.status === 'error' || !currentPayout"
        :title="t('payment.payoutLoadFailedTitle')"
        :message="
          payoutDetailState.detailError || t('payment.payoutLoadFailedDescription')
        "
        :loading="paymentStore.isLoadingPayoutDetail"
        @retry="retryPayoutDetail"
      />
      <div v-else class="screen">
        <div class="page-header" style="justify-content: flex-end">
          <CsvExportButton
            resource="payments"
            :filters="{ payout_id: payoutId }"
            :label="t('payment.export')"
          />
        </div>

        <!-- Overview Card -->
        <div class="card">
          <PayoutDataIssue
            v-if="payoutDetailState.metadataError"
            compact
            :title="t('payment.payoutMetadataFailedTitle')"
            :message="
              payoutDetailState.metadataError ||
              t('payment.payoutMetadataFailedDescription')
            "
            :loading="paymentStore.isLoadingPayoutDetail"
            @retry="retryPayoutDetail"
          />
          <div class="overview-card">
            <div class="overview-left">
              <div class="overview-label">{{ t("payment.total") }}</div>
              <div>
                <span class="overview-amount">{{
                  formatMoney(currentPayout.amount, currentPayout.currency)
                }}</span>
                <span class="overview-currency">{{ currentPayout.currency }}</span>
              </div>
              <div class="overview-provider">
                {{ t("payment.providerShopifyPayments") }}
              </div>
              <div class="overview-meta">
                <div class="meta-item">
                  <label>{{ t("payment.businessEntity") }}</label>
                  <span>{{
                    currentPayoutMetadata?.businessEntity.displayName ||
                    t("payment.unavailable")
                  }}</span>
                </div>
                <div class="meta-item">
                  <label>{{ t("payment.direction") }}</label>
                  <span>{{
                    formatPaymentLabel(currentPayoutMetadata?.transactionType) ||
                    t("payment.unavailable")
                  }}</span>
                </div>
                <div class="meta-item">
                  <label>{{ t("payment.issued") }}</label>
                  <span>{{
                    currentPayoutMetadata?.issuedAt
                      ? fmtDate(currentPayoutMetadata.issuedAt)
                      : currentPayout.date
                        ? fmtDate(currentPayout.date)
                        : "—"
                  }}</span>
                </div>
                <div v-if="currentPayoutMetadata?.externalTraceId" class="meta-item">
                  <label>{{ t("payment.bankTraceId") }}</label>
                  <span class="trace-id">{{
                    currentPayoutMetadata.externalTraceId
                  }}</span>
                </div>
              </div>
            </div>
            <div class="overview-right">
              <div class="summary-title">{{ t("payment.summary") }}</div>
              <div
                v-for="row in currentPayoutSummaryRows"
                :key="row.label"
                class="summary-row"
              >
                <span class="summary-label">
                  {{ row.label }}
                  <span v-if="row.chevron" class="chevron-icon">▾</span>
                </span>
                <span class="summary-value" :class="{ neg: row.neg }">{{
                  row.value
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Transactions Table Card -->
        <div class="card">
          <div class="table-header">
            <button
              v-for="option in transactionFilterOptions"
              :key="option.value"
              class="tab-btn"
              :class="{ active: transactionTypeFilter === option.value }"
              type="button"
              :aria-pressed="transactionTypeFilter === option.value"
              @click="transactionTypeFilter = option.value"
            >
              {{ option.label }}
            </button>
          </div>
          <PayoutDataIssue
            v-if="payoutDetailState.transactionsError"
            compact
            :title="t('payment.payoutTransactionsFailedTitle')"
            :message="
              payoutDetailState.transactionsError ||
              t('payment.payoutTransactionsFailedDescription')
            "
            :loading="paymentStore.isLoadingPayoutDetail"
            @retry="retryPayoutTransactions"
          />
          <table>
            <thead>
              <tr>
                <th aria-sort="descending">{{ t("payment.date") }}</th>
                <th>{{ t("payment.order") }}</th>
                <th>{{ t("payment.type") }}</th>
                <th>{{ t("payment.paymentMethod") }}</th>
                <th class="right">{{ t("payment.amount") }}</th>
                <th class="right">{{ t("payment.fee") }}</th>
                <th class="right">{{ t("payment.net") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tx in displayedPayoutTransactions" :key="tx.id">
                <td class="td-date">{{ fmtDate(tx.processed_at) }}</td>
                <td class="td-order">
                  <NuxtLink
                    v-if="tx.source_order_id"
                    class="link"
                    :to="`/order/${tx.source_order_id}`"
                  >
                    {{ getOrderName(tx) }}
                  </NuxtLink>
                  <span v-else>—</span>
                </td>
                <td class="td-type">
                  <strong>{{ formatPaymentLabel(tx.type) }}</strong>
                  <small v-if="tx.source_type">
                    {{
                      t("payment.source", {
                        type: formatPaymentLabel(tx.source_type),
                      })
                    }}
                  </small>
                  <details
                    v-if="getAdjustmentOrderTransactions(tx).length"
                    class="adjustment-orders"
                  >
                    <summary>
                      {{
                        t("payment.adjustedOrders", {
                          count: getAdjustmentOrderTransactions(tx).length,
                          label:
                            getAdjustmentOrderTransactions(tx).length === 1
                              ? t("payment.orderSingular")
                              : t("payment.orderPlural"),
                        })
                      }}
                    </summary>
                    <div
                      v-for="adjustment in getAdjustmentOrderTransactions(tx)"
                      :key="adjustment.id"
                    >
                      <NuxtLink
                        v-if="adjustment.order.id"
                        :to="`/order/${adjustment.order.id}`"
                      >
                        {{ adjustment.order.name }}
                      </NuxtLink>
                      <span v-else>{{ adjustment.order.name }}</span>
                    </div>
                  </details>
                </td>
                <td>
                  <span>—</span>
                </td>
                <td class="right td-amount">
                  {{ formatMoney(tx.amount, tx.currency) }}
                  <span class="chevron-sm">▾</span>
                </td>
                <td class="right td-fee">
                  <template v-if="hasNonZeroAmount(tx.fee)">
                    {{ formatMoney(tx.fee, tx.currency) }}
                    <span class="chevron-sm">▾</span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="right td-net">
                  {{ formatMoney(tx.net, tx.currency) }}
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-if="
              displayedPayoutTransactions.length === 0 &&
              paymentStore.isLoadingPayoutDetail
            "
            class="empty"
            role="status"
          >
            {{ t("payment.loadingPayoutTransactions") }}
          </div>
          <div
            v-else-if="
              displayedPayoutTransactions.length === 0 &&
              !payoutDetailState.transactionsError
            "
            class="empty"
          >
            {{ t("payment.noTransactionsForPayout") }}
          </div>
          <PaginationControls
            v-if="currentPayoutTransactions.length || payoutPageInfo.hasNextPage"
            :page="currentPage"
            :page-size="pageSize"
            :total-items="filteredPayoutTransactions.length"
            :has-next-page="currentPage < totalPages || payoutPageInfo.hasNextPage"
            :loading="paymentStore.isLoadingPayoutDetail"
            :item-label="t('payment.transactions')"
            @update:page="changePage"
            @update:page-size="updatePageSize"
          />
        </div>
      </div>
    </section>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useLocalization } from "~/composables/useLocalization";
import type { MessageKey } from "~/locales/messages";
import { buildPayoutsRoute } from "~/utils/payment-routes";
import type { Transaction } from "../../../stores/payment";
import { usePaymentStore } from "../../../stores/payment";
import type { PayoutDetailLoadState } from "~~/types/shopify-payment";
import { compareDecimalStrings } from "~~/utils/decimal-string";
import { getAdjustmentOrderTransactions } from "~~/utils/payment-transactions";
import {
  buildPayoutSummaryContributions,
  type PayoutSummaryCategory,
} from "~~/utils/payout-summary";

definePageMeta({ layout: false });

const route = useRoute();
const paymentStore = usePaymentStore();
const { storeId, token } = useActiveShopAuth();
const { locale, t } = useLocalization();
const { formatPaymentLabel } = useShopifyPaymentLabel();
const transactionTypeFilter = ref<"all" | "charge">("all");
const currentPage = ref(1);
const pageSize = ref(50);

const payoutId = computed(() =>
  String(
    Array.isArray(route.params.id) ? route.params.id[0] : route.params.id || "",
  ).trim(),
);
const payoutsRoute = computed(() => buildPayoutsRoute(route.query));

const payoutDetailState = computed<PayoutDetailLoadState>(
  () =>
    paymentStore.payoutDetailStates[payoutId.value] || {
      status: "idle",
      detailError: null,
      metadataError: null,
      transactionsError: null,
    },
);

const currentPayout = computed(
  () =>
    paymentStore.payoutDetails[payoutId.value] ||
    paymentStore.payouts.find((p) => String(p.id) === payoutId.value) ||
    null,
);

const canDisplayPayout = computed(
  () =>
    Boolean(currentPayout.value) &&
    ["loading", "success", "partial"].includes(payoutDetailState.value.status),
);

const currentPayoutMetadata = computed(
  () => paymentStore.payoutMetadata[payoutId.value] || null,
);

const currentPayoutTransactions = computed(() => {
  if (!payoutId.value) return [];
  return paymentStore
    .getTransactionsForPayout(payoutId.value)
    .filter((t) => t.type !== "payout");
});

const filteredPayoutTransactions = computed(() =>
  transactionTypeFilter.value === "charge"
    ? currentPayoutTransactions.value.filter(
        (transaction) => transaction.type === "charge",
      )
    : currentPayoutTransactions.value,
);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredPayoutTransactions.value.length / pageSize.value)),
);
const displayedPayoutTransactions = computed(() => {
  const safePage = Math.min(currentPage.value, totalPages.value);
  const start = (safePage - 1) * pageSize.value;
  return filteredPayoutTransactions.value.slice(start, start + pageSize.value);
});
const payoutPageInfo = computed(
  () =>
    paymentStore.payoutDetailPageInfo[payoutId.value] || {
      hasNextPage: false,
      hasPreviousPage: false,
      nextCursor: null,
      previousCursor: null,
    },
);

watch([payoutId, transactionTypeFilter], () => {
  currentPage.value = 1;
});

const transactionFilterOptions = computed<
  Array<{ label: string; value: "all" | "charge" }>
>(() => [
  { label: t("payment.all"), value: "all" },
  { label: t("payment.charge"), value: "charge" },
]);

const payoutSummaryLabels = {
  charges: "payment.charges",
  refunds: "payment.refunds",
  adjustments: "payment.adjustments",
  advances: "payment.advances",
  reservedFunds: "payment.reservedFunds",
  retriedPayouts: "payment.retriedPayouts",
  usdcRebateCredit: "payment.usdcRebateCredit",
  fees: "payment.fee",
} as const satisfies Record<PayoutSummaryCategory, MessageKey>;

const currentPayoutSummaryRows = computed<
  Array<{ label: string; value: string; neg: boolean; chevron?: boolean }>
>(() => {
  if (!currentPayout.value || !currentPayout.value.summary) return [];
  const currency = currentPayout.value.currency;
  return buildPayoutSummaryContributions(currentPayout.value.summary).map(
    (contribution) => ({
      label: t(payoutSummaryLabels[contribution.category]),
      value: formatMoney(contribution.amount, currency),
      neg: contribution.negative,
      chevron: contribution.category === "fees",
    }),
  );
});

// ── Helpers ──────────────────────────────────────────────
function fmtDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat(locale.value, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function getOrderName(tx: Transaction) {
  if (tx.source_order_name) return tx.source_order_name;
  if (!tx.source_order_id) return null;
  return `#${tx.source_order_id}`;
}

function hasNonZeroAmount(amount: string) {
  return compareDecimalStrings(amount || "0", "0") !== 0;
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
  if (!payoutPageInfo.value.hasNextPage || !payoutId.value) return;
  await paymentStore.fetchMorePayoutTransactions(
    storeId.value,
    token.value,
    payoutId.value,
  );
  if (!payoutDetailState.value.transactionsError) {
    currentPage.value = Math.min(page, totalPages.value);
  }
}

function retryPayoutDetail() {
  if (!payoutId.value) return;
  return paymentStore.fetchPayoutDetail(
    storeId.value,
    token.value,
    payoutId.value,
    true,
  );
}

function retryPayoutTransactions() {
  if (!payoutId.value) return;
  return paymentStore.retryPayoutTransactions(
    storeId.value,
    token.value,
    payoutId.value,
  );
}

function formatMoney(amount: string, currency: string) {
  const numericAmount = (amount || "0") as `${number}`;
  try {
    return new Intl.NumberFormat(locale.value, {
      style: "currency",
      currency,
    }).format(numericAmount);
  } catch {
    return `${numericAmount} ${currency}`;
  }
}
</script>

<style scoped>
.screen {
  display: block;
  animation: fadeIn 0.18s ease;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
}
.breadcrumb-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  color: var(--text-primary, #1a1a1a);
}
.breadcrumb-back:hover {
  background: var(--surface-soft);
}
.page-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
}
.badge-deposited,
.badge-paid {
  background: var(--green-soft);
  color: var(--green);
}

.card {
  background: var(--surface, #fff);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  margin-bottom: 16px;
}

.overview-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.overview-left {
  padding: 20px 24px;
  border-right: 1px solid var(--border, #e5e5e5);
}
.overview-right {
  padding: 20px 24px;
}
.overview-label {
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 4px;
}
.overview-amount {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.5px;
  color: var(--text);
}
.overview-currency {
  font-size: 28px;
  font-weight: 300;
  color: var(--text-sub);
  margin-left: 4px;
}
.overview-provider {
  font-size: 13px;
  color: var(--text-sub);
  margin-top: 6px;
}
.overview-meta {
  display: flex;
  gap: 40px;
  margin-top: 16px;
}
.meta-item label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: block;
  margin-bottom: 2px;
  font-weight: 400;
}
.meta-item span {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}
.trace-id {
  overflow-wrap: anywhere;
  font-family: var(--font-mono);
  font-size: 11px !important;
}
.text-muted {
  color: var(--text-muted) !important;
}

.summary-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;
}
.summary-row:not(:last-child) {
  border-bottom: 1px solid var(--border);
}
.summary-label {
  color: var(--text-sub);
  display: flex;
  align-items: center;
  gap: 4px;
}
.summary-value {
  font-weight: 600;
  color: var(--text);
}
.summary-value.neg {
  color: var(--red);
}

.table-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border, #e5e5e5);
}
.tab-btn {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--text-sub);
}
.tab-btn.active {
  background: var(--surface-soft);
  color: var(--text);
}

table {
  width: 100%;
  border-collapse: collapse;
}
thead th {
  padding: 10px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-sub);
  border-bottom: 1px solid var(--border, #e5e5e5);
}
thead th.right {
  text-align: right;
}
tbody tr {
  border-bottom: 1px solid var(--border, #e5e5e5);
  transition: background 0.12s;
}
tbody tr:hover {
  background: var(--surface-soft);
}
td {
  padding: 12px 16px;
  font-size: 13px;
  color: var(--text);
}
td.right {
  text-align: right;
}
.td-date {
  color: var(--text-sub);
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
.td-order a {
  color: var(--text-link);
  font-weight: 500;
}
.td-fee {
  color: var(--red);
}
.empty {
  text-align: center;
  padding: 32px;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
