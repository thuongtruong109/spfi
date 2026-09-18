<script setup lang="ts">
import { BadgePercent, FileText, RotateCcw, ShoppingCart } from "@lucide/vue";
import { computed, ref } from "vue";
import { useCommerceOpsStore } from "~/stores/commerceOps";

type View = "drafts" | "discounts" | "checkouts" | "returns";

const store = useCommerceOpsStore();
const { t } = useLocalization();
const { handleTabKeydown } = useTabKeyboardNavigation();
const activeView = ref<View>("drafts");
const views = computed(() => [
  {
    id: "drafts" as const,
    label: t("operations.drafts"),
    count: store.draftOrders.length,
    error: store.errors.draftOrders,
    icon: FileText,
  },
  {
    id: "discounts" as const,
    label: t("operations.discounts"),
    count: store.discounts.length,
    error: store.errors.discounts,
    icon: BadgePercent,
  },
  {
    id: "checkouts" as const,
    label: t("operations.abandoned"),
    count: store.abandonedCheckouts.length,
    error: store.errors.abandonedCheckouts,
    icon: ShoppingCart,
  },
  {
    id: "returns" as const,
    label: t("operations.returns"),
    count: store.returns.length,
    error: store.errors.returns,
    icon: RotateCcw,
  },
]);
</script>

<template>
  <section class="ops-workspace">
    <div
      class="ops-view-tabs"
      role="tablist"
      :aria-label="t('operations.viewsAria')"
      @keydown="handleTabKeydown"
    >
      <button
        v-for="view in views"
        :key="view.id"
        type="button"
        role="tab"
        :aria-selected="activeView === view.id"
        :class="{ active: activeView === view.id, error: view.error }"
        @click="activeView = view.id"
      >
        <component :is="view.icon" :size="15" aria-hidden="true" />
        <span>{{ view.label }}</span>
        <b>{{ view.error ? "!" : view.count }}</b>
      </button>
    </div>

    <OperationsDraftOrdersPanel v-if="activeView === 'drafts'" />
    <OperationsDiscountsPanel v-else-if="activeView === 'discounts'" />
    <OperationsAbandonedCheckoutsPanel v-else-if="activeView === 'checkouts'" />
    <OperationsReturnsPanel v-else />
  </section>
</template>

<style src="../../assets/styles/pages/operations.css"></style>
