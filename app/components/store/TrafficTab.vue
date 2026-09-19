<script setup lang="ts">
import type {
  DashboardTrafficDimensionKey,
  DashboardTrafficRange,
} from "~~/types/dashboard";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useTrafficStore } from "~/stores/traffic";

const trafficStore = useTrafficStore();
const { storeId, token } = useActiveShopAuth();

function loadInsightDimension(request: {
  range: DashboardTrafficRange;
  dimension: DashboardTrafficDimensionKey;
}) {
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
      show-insights
      @dimension-change="loadInsightDimension"
    />
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
