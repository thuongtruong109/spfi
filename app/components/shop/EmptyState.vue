<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description: string;
    loading?: boolean;
  }>(),
  {
    loading: false,
  },
);
</script>

<template>
  <section class="shop-empty-state" :class="{ 'is-loading': loading }">
    <div v-if="loading || $slots.icon" class="shop-empty-icon">
      <ApiLoadingIcon v-if="loading" variant="section" :size="24" />
      <slot v-else name="icon" />
    </div>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <div v-if="$slots.actions" class="shop-empty-actions">
      <slot name="actions" />
    </div>
  </section>
</template>

<style scoped>
.shop-empty-state {
  min-height: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 48px 28px;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface-raised) 96%, transparent),
      color-mix(in srgb, var(--surface-soft) 74%, var(--surface))
    ),
    var(--surface);
  text-align: center;
}

.shop-empty-icon {
  width: 52px;
  height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(31, 122, 77, 0.16);
  border-radius: 12px;
  background: var(--green-soft);
  color: var(--green);
  box-shadow: 0 10px 24px rgba(31, 122, 77, 0.1);
}

.shop-empty-icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.shop-empty-state h2 {
  margin: 4px 0 0;
  color: var(--text-primary);
  font-size: 1.3rem;
  font-weight: 600;
}

.shop-empty-state p {
  max-width: 460px;
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.94rem;
  line-height: 1.55;
}

.shop-empty-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 6px;
}

:deep(.shop-empty-action) {
  display: inline-flex;
  min-height: var(--control-height-md);
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 0;
  border-radius: var(--control-radius);
  padding: 0 14px;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition:
    filter 0.16s ease,
    transform 0.16s ease;
}

:deep(.shop-empty-action.primary) {
  background: var(--text-primary);
  color: var(--bg);
}

:deep(.shop-empty-action.primary:hover) {
  filter: brightness(1.12);
  transform: translateY(-1px);
}

:deep(.shop-empty-action:focus-visible) {
  outline: 2px solid rgba(31, 122, 77, 0.45);
  outline-offset: 2px;
}

:deep(.shop-empty-action svg) {
  width: 15px;
  height: 15px;
}

:deep(.shop-empty-hint) {
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 600;
}
</style>
