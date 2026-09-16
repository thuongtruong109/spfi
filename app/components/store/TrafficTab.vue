<script setup lang="ts">
import { useTrafficStore } from "~/stores/traffic";

const trafficStore = useTrafficStore();
</script>

<template>
  <section class="store-traffic-tab">
    <div v-if="trafficStore.error" class="traffic-alert" role="alert">
      {{ trafficStore.error }}
    </div>
    <DashboardTrafficPanel
      :traffic="trafficStore.traffic"
      :loading="trafficStore.isLoading"
      :store-count="1"
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
</style>
