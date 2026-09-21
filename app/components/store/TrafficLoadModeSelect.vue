<script setup lang="ts">
type TrafficLoadMode = "full" | "lazy";

defineProps<{
  loading?: boolean;
}>();

const mode = defineModel<TrafficLoadMode>({ required: true });
const { t } = useLocalization();
const options = computed(() => [
  { value: "lazy" as const, label: t("dashboard.trafficLoadModeLazy") },
  { value: "full" as const, label: t("dashboard.trafficLoadModeFull") },
]);
</script>

<template>
  <div
    class="traffic-load-mode-select"
    :class="{ 'is-loading': loading }"
    :title="t(loading ? 'dashboard.trafficFullLoading' : 'dashboard.trafficLoadMode')"
  >
    <BaseSelect
      v-model="mode"
      :options="options"
      :aria-label="t('dashboard.trafficLoadMode')"
      size="small"
    />
  </div>
</template>

<style scoped>
.traffic-load-mode-select {
  width: 104px;
  height: var(--control-height-sm);
  flex: 0 0 104px;
}

.traffic-load-mode-select :deep(.select-trigger) {
  height: var(--control-height-sm);
  min-height: var(--control-height-sm);
  background: var(--surface-low);
}

.traffic-load-mode-select.is-loading :deep(.select-trigger) {
  border-color: color-mix(in srgb, var(--green) 34%, var(--border));
}
</style>
