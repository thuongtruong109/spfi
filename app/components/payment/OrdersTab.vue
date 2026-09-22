<script setup lang="ts">
import { ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";

const orderStore = useOrderStore();
const { storeId, token, isReady } = useActiveShopAuth();
const { t } = useLocalization();
const isCreateOpen = ref(false);
const selectedOrderIds = ref<string[]>([]);

watch(storeId, () => {
  selectedOrderIds.value = [];
});
async function refreshCount() {
  if (!isReady.value) return;
  await orderStore.fetchCount(storeId.value, token.value, { status: "any" });
}

function changePage(page: number) {
  selectedOrderIds.value = [];
  return orderStore.fetchPage(storeId.value, token.value, page);
}

function changePageSize(pageSize: number) {
  selectedOrderIds.value = [];
  return orderStore.changePageSize(storeId.value, token.value, pageSize);
}
</script>

<template>
  <div class="orders-tab">
    <div class="orders-toolbar">
      <div>
        <strong>{{ orderStore.orderCount || orderStore.orders.length }}</strong>
        <span>{{ t("order.totalOrders") }}</span>
      </div>
      <div class="orders-toolbar-actions">
        <CsvExportButton resource="orders" />
        <button type="button" @click="isCreateOpen = true">
          <IconsAdd aria-hidden="true" />
          {{ t("order.createOrder") }}
        </button>
      </div>
    </div>

    <div
      v-if="orderStore.isLoading && !orderStore.orders.length"
      class="empty is-loading"
      role="status"
    >
      <ApiLoadingIcon variant="section" aria-hidden="true" />
      <span>{{ t("order.loadingOrders") }}</span>
    </div>
    <div v-else-if="orderStore.error" class="empty error-state" role="alert">
      {{ orderStore.error }}
    </div>
    <template v-else>
      <OrderBulkActions
        v-if="orderStore.orders.length"
        :orders="orderStore.orders"
        :selected-order-ids="selectedOrderIds"
        @update:selected-order-ids="selectedOrderIds = $event"
      />
      <OrderOrdersTable
        v-if="orderStore.orders.length"
        :orders="orderStore.orders"
        tracking-actions
        selectable
        :selected-order-ids="selectedOrderIds"
        @update:selected-order-ids="selectedOrderIds = $event"
      />
      <PaginationControls
        v-if="orderStore.orders.length"
        :page="orderStore.currentPage"
        :page-size="orderStore.pageSize"
        :total-items="orderStore.orderCount || orderStore.orders.length"
        :has-next-page="orderStore.pageInfo.hasNextPage"
        :has-previous-page="orderStore.pageInfo.hasPreviousPage"
        :loading="orderStore.isLoading"
        :item-label="t('order.items')"
        @update:page="changePage"
        @update:page-size="changePageSize"
      />
      <div v-else class="empty">{{ t("order.empty") }}</div>
    </template>
    <OrderCreateModal
      v-if="isCreateOpen"
      @close="isCreateOpen = false"
      @created="refreshCount"
    />
  </div>
</template>

<style scoped>
.orders-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 52px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.orders-toolbar > div {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.orders-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.orders-toolbar strong {
  color: var(--text);
  font-size: 15px;
}

.orders-toolbar span {
  color: var(--text-sub);
  font-size: 12px;
}

.orders-toolbar button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: var(--control-height-sm);
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: var(--green);
  color: var(--on-accent);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.error-state {
  color: var(--red);
}

.empty.is-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
