<template>
  <NuxtLayout name="shop">
    <template #shop-bar-left>
      <StoreViewTabs
        :active-tab="activeTab"
        :active-label="activeTabLabel"
        @select="setActiveTab"
      />
    </template>

    <section class="page">
      <ShopEmptyState
        v-if="!formStore.storeId"
        :title="storeEmptyState.title"
        :description="storeEmptyState.description"
      >
        <template #icon>
          <IconsHero v-if="storeEmptyState.kind === 'no-stores'" />
          <IconsCheck v-else />
        </template>
        <template #actions>
          <NuxtLink
            v-if="storeEmptyState.kind === 'no-stores'"
            to="/manager"
            class="shop-empty-action primary"
          >
            <IconsAdd />
            {{ t("profile.addStore") }}
          </NuxtLink>
          <span v-else class="shop-empty-hint">
            {{ t("profile.pickStoreHint") }}
          </span>
        </template>
      </ShopEmptyState>

      <!-- LOADING STATE -->
      <ShopEmptyState
        v-else-if="isPaymentTab && paymentStore.isLoading && !hasPaymentData"
        :title="t('store.loadingPaymentData')"
        :description="t('store.loadingPaymentDescription')"
        loading
      >
        <template #icon>
          <IconsSync />
        </template>
      </ShopEmptyState>

      <!-- EMPTY / NOT FETCHED -->
      <ShopEmptyState
        v-else-if="
          isPaymentTab &&
          !paymentStore.isLoading &&
          !hasPaymentData &&
          !paymentStore.error
        "
        :title="storeEmptyState.title"
        :description="storeEmptyState.description"
      >
        <template #icon>
          <IconsHero v-if="storeEmptyState.kind === 'no-stores'" />
          <IconsCheck v-else-if="storeEmptyState.kind === 'no-selection'" />
          <IconsDate v-else />
        </template>
        <template #actions>
          <NuxtLink
            v-if="storeEmptyState.kind === 'no-stores'"
            to="/manager"
            class="shop-empty-action primary"
          >
            <IconsAdd />
            {{ t("profile.addStore") }}
          </NuxtLink>
          <button
            v-else-if="formStore.storeId"
            class="shop-empty-action primary"
            type="button"
            @click="refreshCurrentStore"
          >
            <IconsRefresh />
            {{ t("store.refreshPayment") }}
          </button>
          <span v-else class="shop-empty-hint">
            {{ t("profile.pickStoreHint") }}
          </span>
        </template>
      </ShopEmptyState>

      <!-- CONTENT -->
      <div v-else class="screen">
        <div
          v-if="isPaymentTab && paymentStore.error"
          class="payment-alert"
          role="alert"
        >
          {{ paymentStore.error }}
        </div>

        <StoreTrafficTab v-if="activeTab === 'traffic'" />

        <StoreMarketsTab v-else-if="activeTab === 'markets'" />

        <StoreProductsTab v-else-if="activeTab === 'products'" />

        <div v-else-if="showsStoreSummary" class="card data-card">
          <PaymentPayoutsTab v-if="activeTab === 'payouts'" />

          <PaymentTransactionsTab v-else-if="activeTab === 'transactions'" />

          <PaymentDisputesTab v-else-if="activeTab === 'disputes'" />

          <PaymentOrdersTab v-else-if="activeTab === 'orders'" />
        </div>

        <StoreCustomersTab v-else-if="activeTab === 'customers'" />

        <OperationsWorkspace v-else-if="activeTab === 'operations'" />

        <StoreProfileTab v-else-if="activeTab === 'profile'" />
      </div>
    </section>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useLocalization } from "~/composables/useLocalization";
import { useStoreFeedback } from "~/composables/useStoreFeedback";
import { useStoreTabData } from "~/composables/useStoreTabData";
import { useCustomerStore } from "~/stores/customers";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import { useFormStore } from "~/stores/form";
import { useMarketStore } from "~/stores/market";
import { useOrderStore } from "~/stores/order";
import { usePaymentStore } from "~/stores/payment";
import { useProductStore } from "~/stores/product";
import { useShopProfileStore } from "~/stores/shopProfile";
import { useTrafficStore } from "~/stores/traffic";
import { resolveStoreTab, type StoreTab } from "~~/types/store";

definePageMeta({ layout: false });

const formStore = useFormStore();
const marketStore = useMarketStore();
const customerStore = useCustomerStore();
const commerceOpsStore = useCommerceOpsStore();
const orderStore = useOrderStore();
const paymentStore = usePaymentStore();
const productStore = useProductStore();
const profileStore = useShopProfileStore();
const trafficStore = useTrafficStore();
const router = useRouter();
const route = useRoute();
const { token: activeToken } = useActiveShopAuth();
const { loadStoreTabData } = useStoreTabData();
const feedback = useStoreFeedback();
const { t } = useLocalization();

const activeTab = computed<StoreTab>(() => resolveStoreTab(route.query.tab));
const isPageActive = ref(true);

function setActiveTab(tab: StoreTab) {
  void router.replace({
    path: "/store",
    query: {
      ...route.query,
      shop: route.query.shop || formStore.storeId || undefined,
      tab: tab === "transactions" ? undefined : tab,
    },
  });
}

async function refreshCurrentStore() {
  if (!formStore.storeId) {
    feedback.warning(t("store.selectBeforeRefresh"));
    return;
  }

  await loadStoreTabData(activeTab.value, formStore.storeId, true);
  feedback.requestResult({
    errorMessage: activeTabError.value,
    successMessage: t("store.dataRefreshed"),
    fallbackError: t("store.dataRefreshFailed"),
  });
}

const balances = computed(() => {
  const b = paymentStore.balance;
  if (!b) return [];
  return Array.isArray(b) ? b : [b];
});

const transactionsCount = computed(() => paymentStore.balanceTransactions.length);
const payoutsCount = computed(() => paymentStore.payouts.length);
const isPaymentTab = computed(() =>
  ["transactions", "payouts", "disputes"].includes(activeTab.value),
);
const showsStoreSummary = computed(() =>
  ["transactions", "payouts", "disputes", "orders"].includes(activeTab.value),
);
const hasPaymentData = computed(
  () =>
    balances.value.length > 0 ||
    transactionsCount.value > 0 ||
    payoutsCount.value > 0 ||
    (activeTab.value === "disputes" && paymentStore.hasFetchedDisputes),
);
const activeTabError = computed(() => {
  if (["transactions", "payouts", "disputes"].includes(activeTab.value)) {
    return paymentStore.error;
  }
  if (activeTab.value === "orders") return orderStore.error;
  if (activeTab.value === "products") return productStore.error;
  if (activeTab.value === "customers") return customerStore.error;
  if (activeTab.value === "markets") return marketStore.error;
  if (activeTab.value === "traffic") return trafficStore.error;
  if (activeTab.value === "operations") return commerceOpsStore.mutationError;
  return profileStore.error;
});

const activeTabLabel = computed(
  () =>
    ({
      transactions: t("store.moneyMovement"),
      payouts: t("store.settlementSchedule"),
      disputes: t("store.disputesDeadlines"),
      orders: t("store.salesConnected"),
      products: t("store.catalog"),
      customers: t("store.customerDirectory"),
      markets: t("store.marketConfiguration"),
      traffic: t("store.trafficOverview"),
      operations: "Commerce operations",
      profile: t("store.profileDetails"),
    })[activeTab.value],
);
const storeEmptyState = computed(() => {
  const isMarketView = activeTab.value === "markets";
  const isTrafficView = activeTab.value === "traffic";

  if (!formStore.knownStores.length) {
    return {
      kind: "no-stores",
      title: t("store.noStoresTitle"),
      description: t(
        isMarketView
          ? "store.noStoresMarketDescription"
          : isTrafficView
            ? "store.noStoresTrafficDescription"
            : "store.noStoresPaymentDescription",
      ),
    };
  }

  if (!formStore.storeId) {
    return {
      kind: "no-selection",
      title: t(
        isMarketView
          ? "store.chooseMarketStoreTitle"
          : isTrafficView
            ? "store.chooseTrafficStoreTitle"
            : "store.choosePaymentStoreTitle",
      ),
      description: t(
        isMarketView
          ? "store.chooseMarketStoreDescription"
          : isTrafficView
            ? "store.chooseTrafficStoreDescription"
            : "store.choosePaymentStoreDescription",
      ),
    };
  }

  return {
    kind: "empty-data",
    title: t("store.noPaymentActivityTitle"),
    description: t("store.noPaymentActivityDescription"),
  };
});

onActivated(() => {
  isPageActive.value = true;
});

onDeactivated(() => {
  isPageActive.value = false;
});

watch(
  [() => formStore.storeId, activeTab, activeToken, isPageActive],
  async ([storeId, tab, , pageActive]) => {
    if (!pageActive || !storeId) return;
    await loadStoreTabData(tab, storeId);
  },
  { immediate: true, flush: "post" },
);

watch([activeTabError, activeTab], ([message]) => {
  if (message) feedback.error(message, t("store.dataLoadFailed"));
});
</script>

<style scoped>
.screen {
  display: block;
  animation: fadeIn 0.18s ease;
}

.payment-alert {
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid rgba(180, 49, 43, 0.18);
  border-radius: 10px;
  background: var(--red-soft);
  color: var(--red);
  font-size: 12px;
  font-weight: 600;
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

.card {
  background: var(--surface);
  border-radius: 14px;
  box-shadow: var(--shadow);
  overflow: hidden;
  margin-bottom: 16px;
}

.data-card {
  border: 1px solid var(--border);
  box-shadow: 0 16px 44px rgba(20, 34, 27, 0.075);
}

:deep(.badge) {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
}
:deep(.badge-deposited),
:deep(.badge-paid) {
  background: var(--green-bg);
  color: var(--green);
}
:deep(.badge-pending) {
  background: var(--surface-soft);
  color: var(--text-sub);
}
:deep(.badge-in-transit) {
  background: var(--amber-soft);
  color: var(--amber);
}
:deep(.badge-fulfilled) {
  background: var(--badge-fulfilled);
  color: var(--badge-fulfilled-text);
}
:deep(.badge-archived) {
  background: var(--badge-archived);
  color: var(--badge-archived-text);
}
:deep(.badge-cancelled) {
  background: var(--badge-cancelled);
  color: var(--badge-cancelled-text);
}
:deep(.badge-partial) {
  background: var(--amber-soft);
  color: var(--amber);
}
:deep(.badge-unfulfilled) {
  background: var(--surface-soft);
  color: var(--text-sub);
}

:deep(table) {
  width: 100%;
  border-collapse: collapse;
}
:deep(thead th) {
  padding: 10px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
:deep(thead th.right) {
  text-align: right;
}
:deep(tbody tr) {
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.12s;
}
:deep(tbody tr:last-child) {
  border-bottom: none;
}
:deep(tbody tr:hover) {
  background: var(--surface-soft);
}
:deep(td) {
  padding: 12px 16px;
  font-size: 13px;
  vertical-align: middle;
  color: var(--text-primary);
}
:deep(td.right) {
  text-align: right;
}
:deep(.td-date) {
  color: var(--text-secondary);
  white-space: nowrap;
}
:deep(.td-order a),
:deep(.link) {
  color: var(--blue);
  font-weight: 500;
  text-decoration: none;
}
:deep(.td-order a:hover),
:deep(.link:hover) {
  text-decoration: underline;
}
:deep(.td-type) {
  color: var(--text-primary);
}
:deep(.payment-method) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
:deep(.card-brand) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--blue);
  color: var(--bg) !important;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: -0.3px;
  padding: 2px 5px;
  border-radius: 3px;
  text-transform: uppercase;
}
:deep(.td-amount) {
  color: var(--text-primary);
  font-weight: 500;
}
:deep(.td-fee) {
  color: var(--red);
  font-weight: 500;
}
:deep(.td-net) {
  color: var(--text-primary);
  font-weight: 600;
}
:deep(.chevron-sm) {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 12px;
  margin-left: 2px;
}

:deep(.orders-table) {
  width: 100%;
  border-collapse: collapse;
}
:deep(.orders-table th) {
  padding: 10px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  background: var(--surface-soft);
}
:deep(.orders-table td) {
  padding: 12px 16px;
  font-size: 13px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
:deep(.order-row) {
  cursor: pointer;
  transition: background 0.12s;
}
:deep(.order-row:hover) {
  background: var(--surface-soft);
}
:deep(.order-link) {
  color: var(--blue);
  font-weight: 600;
  text-decoration: none;
}
:deep(.order-link:hover) {
  text-decoration: underline;
}
:deep(.delivery-cell) {
  display: flex;
  align-items: center;
}
:deep(.delivery-status-trigger) {
  display: flex;
  align-items: center;
  gap: 4px;
}
:deep(.hover-arrow) {
  display: inline-flex;
  align-items: center;
  color: var(--text-muted);
  rotate: 90deg;
}
:deep(.fulfillment-popover) {
  padding: 12px;
  min-width: 220px;
}
:deep(.popover-line) {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 12px;
  padding: 4px 0;
}
:deep(.popover-line.border-top) {
  border-top: 1px solid var(--border);
  margin-top: 6px;
  padding-top: 8px;
}
:deep(.popover-lbl) {
  color: var(--text-secondary);
  font-weight: 500;
}
:deep(.popover-val) {
  color: var(--text-primary);
  font-weight: 600;
  text-align: right;
}
:deep(.btn-add-track) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--green);
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--bg);
  cursor: pointer;
  transition: all 0.2s;
}
:deep(.btn-add-track:hover) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--green) 30%, transparent);
}
:deep(.btn-add-track:disabled) {
  background: var(--surface-soft);
  color: var(--text-muted);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
:deep(.btn-add-track.is-loading) {
  opacity: 0.7;
  cursor: wait;
}

.payment-warning {
  border-color: color-mix(in srgb, var(--amber) 24%, var(--border));
  background: var(--amber-soft);
  color: var(--amber);
}

:deep(.empty) {
  text-align: center;
  padding: 32px;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
