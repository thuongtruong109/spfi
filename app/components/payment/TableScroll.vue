<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<template>
  <div class="payment-table-scroll" role="region" :aria-label="label" tabindex="0">
    <slot />
  </div>
</template>

<style scoped>
.payment-table-scroll {
  width: 100%;
  min-width: 0;
  overflow-x: auto;
}

.payment-table-scroll:focus-visible {
  outline: 2px solid var(--text-link);
  outline-offset: -2px;
}

.payment-table-scroll :deep(table) {
  width: 100%;
  min-width: 720px;
}
</style>
