<script setup lang="ts">
import { PackageCheck, X } from "@lucide/vue";
import { computed, ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderApi } from "~/composables/useOrderApi";
import { useOrderStore } from "~/stores/order";
import { useToastStore } from "~/stores/toast";
import type {
  ShopifyFulfillmentOrder,
  ShopifyFulfillmentOrderLineItem,
  ShopifyOrder,
} from "~~/types/shopify";
import { getAppErrorMessage } from "~~/utils/error";

const props = defineProps<{ order: ShopifyOrder }>();
const orderApi = useOrderApi();
const orderStore = useOrderStore();
const toast = useToastStore();
const { storeId, token, isReady } = useActiveShopAuth();
const { t } = useLocalization();
const { requestConfirmation } = useConfirmDialog();

const isOpen = ref(false);
const isLoading = ref(false);
const localError = ref("");
const fulfillmentOrders = ref<ShopifyFulfillmentOrder[]>([]);
const quantities = ref<Record<string, number>>({});
const trackingNumber = ref("");
const trackingCompany = ref("");
const trackingUrl = ref("");
const notifyCustomer = ref(true);

const canFulfill = computed(
  () => !props.order.cancelled_at && props.order.fulfillment_status !== "fulfilled",
);
const selectedGroups = computed(() =>
  fulfillmentOrders.value
    .map((fulfillmentOrder) => ({
      fulfillment_order_id: fulfillmentOrder.id,
      fulfillment_order_line_items: (fulfillmentOrder.line_items || [])
        .map((lineItem) => ({
          id: lineItem.id,
          quantity: Number(quantities.value[itemKey(fulfillmentOrder, lineItem)] || 0),
        }))
        .filter((lineItem) => lineItem.quantity > 0),
    }))
    .filter((group) => group.fulfillment_order_line_items.length > 0),
);
const selectedItemCount = computed(() =>
  selectedGroups.value.reduce(
    (sum, group) =>
      sum +
      group.fulfillment_order_line_items.reduce(
        (groupSum, lineItem) => groupSum + lineItem.quantity,
        0,
      ),
    0,
  ),
);

async function togglePanel() {
  if (isOpen.value) {
    isOpen.value = false;
    return;
  }
  isOpen.value = true;
  await loadFulfillmentOrders();
}

async function loadFulfillmentOrders() {
  if (!isReady.value || isLoading.value) return;
  isLoading.value = true;
  localError.value = "";
  try {
    const response = await orderApi.getFulfillmentOrders(
      { storeId: storeId.value, token: token.value },
      props.order.id,
    );
    fulfillmentOrders.value = (response.fulfillment_orders || []).filter(
      (order) => order.status === "open" || order.status === "in_progress",
    );
    quantities.value = Object.fromEntries(
      fulfillmentOrders.value.flatMap((order) =>
        (order.line_items || []).map((lineItem) => [itemKey(order, lineItem), 0]),
      ),
    );
  } catch (error) {
    localError.value = getAppErrorMessage(error, "Failed to load fulfillable items.");
  } finally {
    isLoading.value = false;
  }
}

function itemKey(
  fulfillmentOrder: ShopifyFulfillmentOrder,
  lineItem: ShopifyFulfillmentOrderLineItem,
) {
  return `${fulfillmentOrder.id}:${lineItem.id}`;
}

function maximumQuantity(lineItem: ShopifyFulfillmentOrderLineItem) {
  return lineItem.fulfillable_quantity ?? lineItem.quantity;
}

function lineItemName(lineItem: ShopifyFulfillmentOrderLineItem) {
  const orderLine = (props.order.line_items || []).find(
    (candidate) => String(candidate.id) === String(lineItem.line_item_id),
  );
  return (
    orderLine?.name ||
    orderLine?.title ||
    `Item ${lineItem.line_item_id || lineItem.id}`
  );
}

function normalizeQuantity(
  fulfillmentOrder: ShopifyFulfillmentOrder,
  lineItem: ShopifyFulfillmentOrderLineItem,
) {
  const key = itemKey(fulfillmentOrder, lineItem);
  quantities.value[key] = Math.min(
    maximumQuantity(lineItem),
    Math.max(0, Math.floor(Number(quantities.value[key]) || 0)),
  );
}

async function createFulfillment() {
  if (!isReady.value || !selectedGroups.value.length) return;
  if (
    !(await requestConfirmation({
      title: t("confirm.actionTitle"),
      message: t("order.fulfillItemsConfirm", {
        count: selectedItemCount.value,
      }),
      confirmLabel: t("order.fulfillItems"),
      danger: false,
    }))
  ) {
    return;
  }

  const updated = await orderStore.fulfillOrder(
    storeId.value,
    token.value,
    props.order.id,
    {
      notify_customer: notifyCustomer.value,
      tracking_info: {
        number: trackingNumber.value.trim() || undefined,
        company: trackingCompany.value.trim() || undefined,
        url: trackingUrl.value.trim() || undefined,
      },
      line_items_by_fulfillment_order: selectedGroups.value,
    },
  );

  if (updated) {
    toast.success("Selected items fulfilled.");
    await loadFulfillmentOrders();
    if (!fulfillmentOrders.value.length) isOpen.value = false;
  }
}
</script>

<template>
  <section
    v-if="canFulfill"
    class="fulfillment-panel"
    aria-labelledby="fulfillment-title"
  >
    <header>
      <div>
        <div class="panel-title">
          <PackageCheck aria-hidden="true" />
          <h2 id="fulfillment-title">Fulfillment</h2>
        </div>
        <p>Select exact quantities to prevent accidental full fulfillment.</p>
      </div>
      <BaseButton :disabled="orderStore.isMutating" @click="togglePanel">
        <template #icon><X v-if="isOpen" /><PackageCheck v-else /></template>
        {{ isOpen ? "Close" : "Create fulfillment" }}
      </BaseButton>
    </header>

    <div v-if="isOpen" class="fulfillment-body">
      <div v-if="isLoading" class="panel-note">Loading fulfillment orders…</div>
      <div v-else-if="!fulfillmentOrders.length && !localError" class="panel-note">
        No open fulfillment items are available.
      </div>
      <template v-else>
        <div
          v-for="fulfillmentOrder in fulfillmentOrders"
          :key="fulfillmentOrder.id"
          class="group"
        >
          <div class="group-title">Fulfillment order {{ fulfillmentOrder.id }}</div>
          <div
            v-for="lineItem in fulfillmentOrder.line_items || []"
            :key="lineItem.id"
            class="item-row"
          >
            <div>
              <strong>{{ lineItemName(lineItem) }}</strong>
              <small>{{ maximumQuantity(lineItem) }} available</small>
            </div>
            <label>
              <span>Quantity</span>
              <input
                v-model.number="quantities[itemKey(fulfillmentOrder, lineItem)]"
                type="number"
                min="0"
                :max="maximumQuantity(lineItem)"
                step="1"
                @change="normalizeQuantity(fulfillmentOrder, lineItem)"
              />
            </label>
          </div>
        </div>

        <div class="tracking-grid">
          <label><span>Tracking number</span><input v-model="trackingNumber" /></label>
          <label><span>Carrier</span><input v-model="trackingCompany" /></label>
          <label class="full"
            ><span>Tracking URL (optional)</span
            ><input v-model="trackingUrl" type="url"
          /></label>
          <label class="check-row">
            <input v-model="notifyCustomer" type="checkbox" />
            <span>Notify customer</span>
          </label>
        </div>
        <div class="actions">
          <BaseButton
            variant="primary"
            :loading="orderStore.isMutating"
            :disabled="!selectedGroups.length"
            @click="createFulfillment"
          >
            <template #icon><PackageCheck /></template>
            Fulfill {{ selectedItemCount || "selected" }} item{{
              selectedItemCount === 1 ? "" : "s"
            }}
          </BaseButton>
        </div>
      </template>
    </div>

    <div v-if="localError || orderStore.mutationError" class="panel-error" role="alert">
      {{ localError || orderStore.mutationError }}
    </div>
  </section>
</template>

<style scoped>
.fulfillment-panel {
  margin-bottom: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
}
.panel-title {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.panel-title :deep(svg) {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: var(--green);
}
h2 {
  color: var(--text);
  font-size: 15px;
}
header p {
  margin: 3px 0 0;
  color: var(--text-sub);
  font-size: 12px;
}
.fulfillment-body {
  border-top: 1px solid var(--border);
  background: var(--surface-soft);
}
.group + .group {
  border-top: 1px solid var(--border);
}
.group-title {
  padding: 10px 16px 4px;
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
}
.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
}
.item-row > div {
  display: grid;
  min-width: 0;
}
.item-row strong {
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-row small {
  color: var(--text-sub);
  font-size: 11px;
}
.item-row label {
  display: grid;
  flex: 0 0 90px;
  gap: 4px;
}
.tracking-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
  padding: 14px 16px;
  border-top: 1px solid var(--border);
}
label {
  display: grid;
  gap: 5px;
}
label > span {
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
}
input {
  width: 100%;
  min-height: var(--control-height-sm);
  border: 1px solid var(--border);
  border-radius: var(--control-radius-sm);
  padding: 7px 9px;
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
}
input:focus {
  outline: none;
  border-color: var(--green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 20%, transparent);
}
.full {
  grid-column: 1 / -1;
}
.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.check-row input {
  width: 16px;
  min-height: 16px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 16px 16px;
}
.panel-note,
.panel-error {
  padding: 10px 16px;
  font-size: 12px;
}
.panel-note {
  color: var(--text-sub);
}
.panel-error {
  border-top: 1px solid rgba(180, 49, 43, 0.2);
  background: var(--red-soft);
  color: var(--red);
}

@media (max-width: 760px) {
  header {
    align-items: flex-start;
    flex-direction: column;
  }
  .tracking-grid {
    grid-template-columns: 1fr;
  }
  .full {
    grid-column: auto;
  }
}
</style>
