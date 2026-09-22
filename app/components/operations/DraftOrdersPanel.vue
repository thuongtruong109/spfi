<script setup lang="ts">
import { CircleCheck, Mail, Plus, Trash2 } from "@lucide/vue";
import { ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import type { DraftOrderAction, DraftOrderSummary } from "~~/types/shopify-operations";
import { fmtDateTime, fmtMoney } from "~~/utils/order";

const store = useCommerceOpsStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const { requestConfirmation } = useConfirmDialog();
const isCreateOpen = ref(false);

async function runAction(draft: DraftOrderSummary, action: DraftOrderAction) {
  const messages: Record<DraftOrderAction, string> = {
    complete: t("operations.draft.completeConfirm"),
    invoice: t("operations.draft.invoiceConfirm", {
      customer: draft.email || t("operations.draft.customerFallback"),
    }),
    delete: t("operations.draft.deleteConfirm", { name: draft.name }),
  };
  const labels: Record<DraftOrderAction, string> = {
    complete: t("operations.draft.completePaid"),
    invoice: t("operations.draft.invoice"),
    delete: t("common.delete"),
  };
  if (
    !(await requestConfirmation({
      title:
        action === "delete"
          ? t("operations.draft.deleteTitle")
          : t("operations.draft.confirmTitle"),
      message: messages[action],
      confirmLabel: labels[action],
      danger: action === "delete",
    }))
  ) {
    return;
  }
  const result = await store.actOnDraft(storeId.value, token.value, draft.id, action);
  if (result) feedback.success(t("operations.draft.actionSucceeded"));
  else feedback.error(store.mutationError, t("operations.draft.actionFailed"));
}
</script>

<template>
  <div class="ops-panel">
    <div class="ops-panel-toolbar">
      <div>
        <h3>{{ t("operations.draft.title") }}</h3>
        <p>{{ t("operations.draft.description") }}</p>
      </div>
      <BaseButton variant="primary" @click="isCreateOpen = true">
        <template #icon><Plus /></template>
        {{ t("operations.draft.new") }}
      </BaseButton>
    </div>

    <div v-if="store.errors.draftOrders" class="ops-resource-error" role="alert">
      <strong>{{ t("operations.draft.unavailable") }}</strong>
      <span>{{ store.errors.draftOrders }}</span>
    </div>
    <div
      v-else-if="
        store.loadingResources.includes('draftOrders') && !store.draftOrders.length
      "
      class="ops-empty is-loading"
      role="status"
    >
      <ApiLoadingIcon variant="section" aria-hidden="true" />
      <span>{{ t("operations.draft.loading") }}</span>
    </div>
    <div v-else-if="store.draftOrders.length" class="ops-table-scroll">
      <table class="ops-table">
        <thead>
          <tr>
            <th>{{ t("operations.draft.columnDraft") }}</th>
            <th>{{ t("operations.columnCustomer") }}</th>
            <th>{{ t("operations.columnItems") }}</th>
            <th>{{ t("operations.columnTotal") }}</th>
            <th>{{ t("operations.columnUpdated") }}</th>
            <th>{{ t("operations.columnStatus") }}</th>
            <th class="ops-actions-column">{{ t("operations.columnActions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="draft in store.draftOrders" :key="draft.id">
            <td>
              <strong>{{ draft.name }}</strong>
            </td>
            <td>
              <span>{{ draft.customerName || t("operations.guest") }}</span>
              <small>{{ draft.email || t("operations.noEmail") }}</small>
            </td>
            <td>{{ draft.itemCount }}</td>
            <td>
              {{ fmtMoney(draft.totalPrice.amount, draft.totalPrice.currencyCode) }}
            </td>
            <td>{{ fmtDateTime(draft.updatedAt) }}</td>
            <td>
              <span class="ops-status">{{ draft.status }}</span>
            </td>
            <td>
              <div class="ops-row-actions">
                <BaseButton
                  v-if="draft.email"
                  :disabled="store.isMutating"
                  @click="runAction(draft, 'invoice')"
                >
                  <template #icon><Mail /></template>
                  {{ t("operations.draft.invoice") }}
                </BaseButton>
                <BaseButton
                  variant="primary"
                  :disabled="store.isMutating || draft.status === 'COMPLETED'"
                  @click="runAction(draft, 'complete')"
                >
                  <template #icon><CircleCheck /></template>
                  {{ t("operations.draft.complete") }}
                </BaseButton>
                <BaseButton
                  variant="danger-ghost"
                  icon-only
                  :disabled="store.isMutating"
                  :aria-label="t('operations.draft.deleteAria')"
                  @click="runAction(draft, 'delete')"
                >
                  <template #icon><Trash2 /></template>
                </BaseButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="ops-empty">{{ t("operations.draft.empty") }}</div>

    <OperationsCreateDraftModal
      v-if="isCreateOpen"
      @close="isCreateOpen = false"
      @created="isCreateOpen = false"
    />
  </div>
</template>
