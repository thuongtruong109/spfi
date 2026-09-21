<script setup lang="ts">
import { Pause, Play, Plus } from "@lucide/vue";
import { ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import type { DiscountAction, DiscountSummary } from "~~/types/shopify-operations";
import { fmtDateTime } from "~~/utils/order";

const store = useCommerceOpsStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const { requestConfirmation } = useConfirmDialog();
const isCreateOpen = ref(false);

async function runAction(discount: DiscountSummary, action: DiscountAction) {
  if (
    !(await requestConfirmation({
      title: t(
        action === "activate"
          ? "operations.discount.activateTitle"
          : "operations.discount.pauseTitle",
      ),
      message: t(
        action === "activate"
          ? "operations.discount.activateConfirm"
          : "operations.discount.pauseConfirm",
        { name: discount.code || discount.title },
      ),
      confirmLabel: t(
        action === "activate"
          ? "operations.discount.activate"
          : "operations.discount.pause",
      ),
      danger: false,
    }))
  ) {
    return;
  }
  const result = await store.actOnDiscount(
    storeId.value,
    token.value,
    discount.id,
    action,
  );
  if (result) {
    feedback.success(
      t(
        action === "activate"
          ? "operations.discount.activated"
          : "operations.discount.paused",
      ),
    );
  } else {
    feedback.error(store.mutationError, t("operations.discount.actionFailed"));
  }
}
</script>

<template>
  <div class="ops-panel">
    <div class="ops-panel-toolbar">
      <div>
        <h3>{{ t("operations.discount.title") }}</h3>
        <p>{{ t("operations.discount.description") }}</p>
      </div>
      <BaseButton variant="primary" @click="isCreateOpen = true">
        <template #icon><Plus /></template>
        {{ t("operations.discount.newCode") }}
      </BaseButton>
    </div>
    <div v-if="store.errors.discounts" class="ops-resource-error" role="alert">
      <strong>{{ t("operations.discount.unavailable") }}</strong>
      <span>{{ store.errors.discounts }}</span>
      <small>{{ t("operations.discount.scopeRequired") }}</small>
    </div>
    <div
      v-else-if="
        store.loadingResources.includes('discounts') && !store.discounts.length
      "
      class="ops-empty is-loading"
      role="status"
    >
      <ApiLoadingIcon variant="section" aria-hidden="true" />
      <span>{{ t("operations.discount.loading") }}</span>
    </div>
    <div v-else-if="store.discounts.length" class="ops-table-scroll">
      <table class="ops-table">
        <thead>
          <tr>
            <th>{{ t("operations.discount.columnPromotion") }}</th>
            <th>{{ t("operations.discount.columnCode") }}</th>
            <th>{{ t("operations.discount.columnRule") }}</th>
            <th>{{ t("operations.discount.columnUsage") }}</th>
            <th>{{ t("operations.discount.columnSchedule") }}</th>
            <th>{{ t("operations.columnStatus") }}</th>
            <th class="ops-actions-column">{{ t("operations.columnActions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="discount in store.discounts" :key="discount.id">
            <td>
              <strong>{{ discount.title }}</strong>
              <small>{{ discount.type.replace(/^Discount/, "") }}</small>
            </td>
            <td>
              <code>{{ discount.code || t("operations.discount.automatic") }}</code>
            </td>
            <td class="ops-rule-cell">
              {{ discount.summary || t("operations.discount.configuredInShopify") }}
            </td>
            <td>{{ discount.usageCount }}</td>
            <td>
              <span>{{
                discount.startsAt
                  ? fmtDateTime(discount.startsAt)
                  : t("operations.discount.immediate")
              }}</span>
              <small v-if="discount.endsAt">
                {{
                  t("operations.discount.ends", {
                    date: fmtDateTime(discount.endsAt) || "",
                  })
                }}
              </small>
            </td>
            <td>
              <span class="ops-status">{{ discount.status }}</span>
            </td>
            <td>
              <div v-if="discount.code" class="ops-row-actions">
                <BaseButton
                  v-if="discount.status !== 'ACTIVE'"
                  :disabled="store.isMutating"
                  @click="runAction(discount, 'activate')"
                >
                  <template #icon><Play /></template>
                  {{ t("operations.discount.activate") }}
                </BaseButton>
                <BaseButton
                  v-else
                  :disabled="store.isMutating"
                  @click="runAction(discount, 'deactivate')"
                >
                  <template #icon><Pause /></template>
                  {{ t("operations.discount.pause") }}
                </BaseButton>
              </div>
              <small v-else>{{ t("operations.discount.manageAutomatic") }}</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="ops-empty">{{ t("operations.discount.empty") }}</div>

    <OperationsCreateDiscountModal
      v-if="isCreateOpen"
      @close="isCreateOpen = false"
      @created="isCreateOpen = false"
    />
  </div>
</template>
