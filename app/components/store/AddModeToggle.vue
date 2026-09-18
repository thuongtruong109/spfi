<script setup lang="ts">
import type { AddStoreMode } from "~/composables/useAddStoreConnection";

defineProps<{ modelValue: AddStoreMode }>();

const emit = defineEmits<{
  "update:modelValue": [mode: AddStoreMode];
}>();
const { t } = useLocalization();
</script>

<template>
  <div class="store-mode-toggle" role="group" :aria-label="t('store.addMode')">
    <BaseButton
      class="store-mode-tab"
      :class="{ active: modelValue === 'single' }"
      :variant="modelValue === 'single' ? 'secondary' : 'ghost'"
      :aria-pressed="modelValue === 'single'"
      @click="emit('update:modelValue', 'single')"
    >
      <template #icon><IconsCheck /></template>
      {{ t("store.single") }}
    </BaseButton>
    <BaseButton
      class="store-mode-tab"
      :class="{ active: modelValue === 'bulking' }"
      :variant="modelValue === 'bulking' ? 'secondary' : 'ghost'"
      :aria-pressed="modelValue === 'bulking'"
      @click="emit('update:modelValue', 'bulking')"
    >
      <template #icon><IconsBulking /></template>
      {{ t("store.bulk") }}
    </BaseButton>
  </div>
</template>

<style scoped>
.store-mode-toggle {
  display: inline-flex;
  gap: 3px;
  width: fit-content;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  padding: 4px;
}

.store-mode-tab {
  min-height: var(--control-height-sm);
  border: 0;
  border-radius: 6px;
  color: var(--text-sub);
  font-size: 13px;
  font-weight: 600;
}

.store-mode-tab:hover,
.store-mode-tab:focus-visible {
  color: var(--text-primary);
}

.store-mode-tab.active {
  background: var(--surface);
  color: var(--text-primary);
  box-shadow: var(--shadow-soft);
}
</style>
