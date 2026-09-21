<script setup lang="ts">
import type {
  DashboardTrafficDimensionKey,
  DashboardTrafficRange,
} from "~~/types/dashboard";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useTrafficStore } from "~/stores/traffic";

const trafficStore = useTrafficStore();
const { storeId, token } = useActiveShopAuth();
const loadMode = ref<"full" | "lazy">("full");
const selectedRange = ref<DashboardTrafficRange>("24h");
const selectedRangeProgress = computed(
  () => trafficStore.trafficInsightProgress[selectedRange.value],
);
const isSelectedRangeLoading = computed(
  () =>
    loadMode.value === "full" &&
    trafficStore.isLoadingAllInsights &&
    trafficStore.activeFullInsightRange === selectedRange.value,
);

watch(
  () =>
    [
      storeId.value,
      token.value,
      trafficStore.hasFetched,
      trafficStore.isLoading,
      trafficStore.traffic.available,
      loadMode.value,
      selectedRange.value,
    ] as const,
  ([
    activeStoreId,
    activeToken,
    hasFetched,
    isLoading,
    trafficAvailable,
    mode,
    range,
  ]) => {
    if (mode === "lazy") {
      trafficStore.cancelTrafficDimensionRequests();
      return;
    }
    if (
      !activeStoreId ||
      !activeToken ||
      !hasFetched ||
      isLoading ||
      !trafficAvailable ||
      !trafficStore.isStoreActive(activeStoreId)
    ) {
      return;
    }
    void trafficStore.fetchTrafficRangeDimensions(activeStoreId, activeToken, range);
  },
  { immediate: true },
);

onBeforeUnmount(() => trafficStore.cancelTrafficDimensionRequests());

function loadInsightDimension(request: {
  range: DashboardTrafficRange;
  dimension: DashboardTrafficDimensionKey;
}) {
  if (loadMode.value === "full") return;
  if (!storeId.value || !token.value) return;
  void trafficStore.fetchTrafficDimension(
    storeId.value,
    token.value,
    request.range,
    request.dimension,
  );
}
</script>

<template>
  <section class="store-traffic-tab">
    <div v-if="trafficStore.error" class="traffic-alert" role="alert">
      {{ trafficStore.error }}
    </div>
    <div
      v-else-if="trafficStore.insightError"
      class="traffic-alert traffic-alert-warning"
      role="status"
    >
      {{ trafficStore.insightError }}
    </div>
    <DashboardTrafficPanel
      :traffic="trafficStore.traffic"
      :loading="trafficStore.isLoading"
      :loading-insight-dimensions="trafficStore.loadingInsightDimensions"
      :store-count="1"
      :export-pending="
        loadMode === 'full' &&
        trafficStore.hasFetched &&
        !selectedRangeProgress.complete
      "
      :full-loading="isSelectedRangeLoading"
      :full-load-progress="selectedRangeProgress"
      :lazy-insight-loading="loadMode === 'lazy'"
      show-insights
      @dimension-change="loadInsightDimension"
      @range-change="selectedRange = $event"
    >
      <template #controls-prefix>
        <StoreTrafficLoadModeSelect
          v-model="loadMode"
          :loading="trafficStore.isLoadingAllInsights"
        />
      </template>
    </DashboardTrafficPanel>
  </section>
</template>

<style scoped>
.store-traffic-tab :deep(.traffic-panel) {
  margin-top: 0;
}

.traffic-alert {
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--red) 18%, transparent);
  border-radius: 10px;
  background: var(--red-soft);
  color: var(--red);
  font-size: 12px;
  font-weight: 600;
}

.traffic-alert-warning {
  border-color: color-mix(in srgb, var(--amber) 22%, transparent);
  background: var(--amber-soft);
  color: var(--amber);
}
</style>
