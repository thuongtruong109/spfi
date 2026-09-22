<script setup lang="ts">
import { Check, CircleX, PackageCheck, X } from "@lucide/vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import type { ReturnAction, ReturnSummary } from "~~/types/shopify-operations";
import { fmtDateTime } from "~~/utils/order";

const store = useCommerceOpsStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const { requestConfirmation } = useConfirmDialog();

async function runAction(item: ReturnSummary, action: ReturnAction) {
  const copy: Record<ReturnAction, { title: string; message: string; label: string }> =
    {
      approve: {
        title: t("operations.return.approveTitle"),
        message: t("operations.return.approveConfirm", { name: item.name }),
        label: t("operations.return.approve"),
      },
      decline: {
        title: t("operations.return.declineTitle"),
        message: t("operations.return.declineConfirm", { name: item.name }),
        label: t("operations.return.decline"),
      },
      close: {
        title: t("operations.return.closeTitle"),
        message: t("operations.return.closeConfirm", { name: item.name }),
        label: t("operations.return.close"),
      },
      cancel: {
        title: t("operations.return.cancelTitle"),
        message: t("operations.return.cancelConfirm", { name: item.name }),
        label: t("operations.return.cancel"),
      },
    };
  if (
    !(await requestConfirmation({
      title: copy[action].title,
      message: copy[action].message,
      confirmLabel: copy[action].label,
      danger: action === "decline" || action === "cancel",
    }))
  ) {
    return;
  }
  const result = await store.actOnReturn(
    storeId.value,
    token.value,
    item.id,
    action,
    action === "decline" ? { declineReason: "OTHER", notifyCustomer: false } : {},
  );
  if (result) feedback.success(t("operations.return.actionSucceeded"));
  else feedback.error(store.mutationError, t("operations.return.actionFailed"));
}
</script>

<template>
  <div class="ops-panel">
    <div class="ops-panel-toolbar">
      <div>
        <h3>{{ t("operations.return.title") }}</h3>
        <p>{{ t("operations.return.description") }}</p>
      </div>
    </div>
    <div v-if="store.errors.returns" class="ops-resource-error" role="alert">
      <strong>{{ t("operations.return.unavailable") }}</strong>
      <span>{{ store.errors.returns }}</span>
      <small>{{ t("operations.return.scopeRequired") }}</small>
    </div>
    <div
      v-else-if="store.loadingResources.includes('returns') && !store.returns.length"
      class="ops-empty is-loading"
      role="status"
    >
      <ApiLoadingIcon variant="section" aria-hidden="true" />
      <span>{{ t("operations.return.loading") }}</span>
    </div>
    <div v-else-if="store.returns.length" class="ops-table-scroll">
      <table class="ops-table">
        <thead>
          <tr>
            <th>{{ t("operations.return.columnReturn") }}</th>
            <th>{{ t("operations.return.columnOrder") }}</th>
            <th>{{ t("operations.columnItems") }}</th>
            <th>{{ t("operations.return.columnReason") }}</th>
            <th>{{ t("operations.return.columnCreated") }}</th>
            <th>{{ t("operations.columnStatus") }}</th>
            <th class="ops-actions-column">{{ t("operations.columnActions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in store.returns" :key="item.id">
            <td>
              <strong>{{ item.name }}</strong>
            </td>
            <td>
              <NuxtLink
                :to="{
                  path: `/order/${item.orderId.split('/').at(-1)}`,
                  query: { shop: storeId },
                }"
                class="ops-text-link"
              >
                {{ item.orderName }}
              </NuxtLink>
            </td>
            <td>
              <span>{{
                t("operations.unitCount", { count: item.totalQuantity })
              }}</span>
              <small>{{
                item.items
                  .slice(0, 2)
                  .map((line) => line.title)
                  .join(", ")
              }}</small>
            </td>
            <td>
              <span>{{
                item.items[0]?.reason || t("operations.return.unspecified")
              }}</span>
              <small v-if="item.items[0]?.customerNote">{{
                item.items[0].customerNote
              }}</small>
            </td>
            <td>{{ fmtDateTime(item.createdAt) }}</td>
            <td>
              <span class="ops-status">{{ item.status }}</span>
            </td>
            <td>
              <div class="ops-row-actions">
                <template v-if="item.status === 'REQUESTED'">
                  <BaseButton
                    variant="primary"
                    :disabled="store.isMutating"
                    @click="runAction(item, 'approve')"
                  >
                    <template #icon><Check /></template>
                    {{ t("operations.return.approve") }}
                  </BaseButton>
                  <BaseButton
                    variant="danger-ghost"
                    :disabled="store.isMutating"
                    @click="runAction(item, 'decline')"
                  >
                    <template #icon><CircleX /></template>
                    {{ t("operations.return.decline") }}
                  </BaseButton>
                </template>
                <template v-else-if="item.status === 'OPEN'">
                  <BaseButton
                    :disabled="store.isMutating"
                    @click="runAction(item, 'close')"
                  >
                    <template #icon><PackageCheck /></template>
                    {{ t("operations.return.closeShort") }}
                  </BaseButton>
                  <BaseButton
                    variant="danger-ghost"
                    icon-only
                    :disabled="store.isMutating"
                    :aria-label="t('operations.return.cancel')"
                    @click="runAction(item, 'cancel')"
                  >
                    <template #icon><X /></template>
                  </BaseButton>
                </template>
                <small v-else>{{ t("operations.return.noAction") }}</small>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="ops-empty">
      {{ t("operations.return.empty") }}
    </div>
  </div>
</template>
