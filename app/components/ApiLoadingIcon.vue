<script setup lang="ts">
import { RefreshCw } from "@lucide/vue";

withDefaults(
  defineProps<{
    size?: number;
  }>(),
  {
    size: 16,
  },
);
</script>

<template>
  <RefreshCw class="api-loading-icon" :size="size" />
</template>

<style scoped>
.api-loading-icon {
  animation: api-loading-spin 0.9s cubic-bezier(0.5, 0.15, 0.5, 0.85) infinite;
}

@keyframes api-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .api-loading-icon {
    animation: api-loading-pulse 1.2s ease-in-out infinite alternate;
  }

  @keyframes api-loading-pulse {
    to {
      opacity: 0.45;
    }
  }
}
</style>
