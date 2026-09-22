<script setup lang="ts">
import { LoaderCircle, RefreshCw } from "@lucide/vue";

withDefaults(
  defineProps<{
    size?: number;
    variant?: "transition" | "section";
  }>(),
  {
    size: 16,
    variant: "transition",
  },
);
</script>

<template>
  <LoaderCircle
    v-if="variant === 'section'"
    class="api-loading-icon is-section"
    data-loading-icon="section"
    :size="size"
  />
  <RefreshCw
    v-else
    class="api-loading-icon is-transition"
    data-loading-icon="transition"
    :size="size"
  />
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
