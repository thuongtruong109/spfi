<script setup lang="ts">
import { ChartLine, Globe2 } from "@lucide/vue";
import type { StoreTab } from "~~/types/store";

defineProps<{
  activeTab: StoreTab;
  activeLabel: string;
}>();

const emit = defineEmits<{
  select: [tab: StoreTab];
}>();
const { t } = useLocalization();
const { handleTabKeydown } = useTabKeyboardNavigation();

function selectTab(tab: StoreTab) {
  emit("select", tab);
}
</script>

<template>
  <div
    class="table-header store-tabs"
    role="tablist"
    :aria-label="t('store.views')"
    @keydown="handleTabKeydown"
  >
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'profile' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'profile'"
      @click="selectTab('profile')"
    >
      <IconsUser />
      {{ t("store.tabProfile") }}
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'traffic' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'traffic'"
      @click="selectTab('traffic')"
    >
      <ChartLine />
      {{ t("store.tabTraffic") }}
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'transactions' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'transactions'"
      @click="selectTab('transactions')"
    >
      <IconsDate />
      {{ t("store.tabTransactions") }}
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'payouts' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'payouts'"
      @click="selectTab('payouts')"
    >
      <IconsRefresh />
      {{ t("store.tabPayouts") }}
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'disputes' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'disputes'"
      @click="selectTab('disputes')"
    >
      <IconsCheck />
      {{ t("store.tabDisputes") }}
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'orders' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'orders'"
      @click="selectTab('orders')"
    >
      <IconsCopy />
      {{ t("store.tabOrders") }}
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'products' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'products'"
      @click="selectTab('products')"
    >
      <IconsBulking />
      {{ t("store.tabProducts") }}
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'customers' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'customers'"
      @click="selectTab('customers')"
    >
      <IconsUsers />
      {{ t("store.tabCustomers") }}
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'markets' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'markets'"
      @click="selectTab('markets')"
    >
      <Globe2 />
      {{ t("store.tabMarkets") }}
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'operations' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'operations'"
      @click="selectTab('operations')"
    >
      <IconsSync />
      Operations
    </button>
    <!-- <span class="active-view-label">{{ activeLabel }}</span> -->
  </div>
</template>

<style scoped>
.table-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, var(--surface), var(--surface-low));
}

.store-tabs {
  width: 100%;
  padding: 0;
  border-bottom: 0;
  background: transparent;
}

.tab-btn {
  min-height: var(--control-height-sm);
  padding: 0 12px;
  border-radius: var(--control-radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font);
  transition:
    background 0.16s ease,
    box-shadow 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
  line-height: 1.4;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab-btn svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.tab-btn.active {
  background: var(--green-soft);
  color: var(--green);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--green) 20%, transparent);
}

.tab-btn:hover:not(.active) {
  background: var(--surface-soft);
  color: var(--green);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--green) 18%, transparent);
  transform: translateY(-1px);
}

.tab-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.active-view-label {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
}

@media (max-width: 600px) {
  .active-view-label {
    width: 100%;
    margin-left: 0;
  }
}

@media (max-width: 420px) {
  .table-header {
    align-items: stretch;
  }

  .tab-btn {
    justify-content: space-between;
    width: calc(50% - 3px);
  }
}
</style>
