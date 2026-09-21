<script lang="ts" setup>
import ApiLoadingIcon from "~/components/ApiLoadingIcon.vue";

defineProps<{ visible: boolean }>();
const { t } = useLocalization();
</script>

<template>
  <Transition name="fade">
    <div
      v-if="visible"
      class="loading-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="loading-spinner">
        <ApiLoadingIcon class="spin-icon" :size="28" aria-hidden="true" />
        <span class="loading-text">{{ t("common.loading") }}</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 12px;
  padding: 24px 32px;
  box-shadow: var(--shadow-soft, 0 8px 32px rgba(0, 0, 0, 0.12));
}

.spin-icon {
  color: var(--text-secondary, #666);
}

.loading-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #666);
  font-family: inherit;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
