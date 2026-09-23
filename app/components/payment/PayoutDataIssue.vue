<script setup lang="ts">
import { AlertTriangle } from "@lucide/vue";
import { useLocalization } from "~/composables/useLocalization";

withDefaults(
  defineProps<{
    title: string;
    message?: string | null;
    compact?: boolean;
    retryable?: boolean;
    loading?: boolean;
  }>(),
  {
    message: null,
    compact: false,
    retryable: true,
    loading: false,
  },
);

defineEmits<{ retry: [] }>();

const { t } = useLocalization();
</script>

<template>
  <section class="payout-data-issue" :class="{ 'is-compact': compact }" role="alert">
    <AlertTriangle class="issue-icon" aria-hidden="true" />
    <div class="issue-copy">
      <strong>{{ title }}</strong>
      <p v-if="message">{{ message }}</p>
    </div>
    <BaseButton v-if="retryable" :loading="loading" @click="$emit('retry')">
      {{ t("common.retry") }}
    </BaseButton>
  </section>
</template>

<style scoped>
.payout-data-issue {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  width: min(680px, 100%);
  margin: 32px auto;
  padding: 20px;
  border: 1px solid color-mix(in srgb, var(--red) 26%, var(--border));
  border-radius: 10px;
  background: var(--red-soft);
  color: var(--red);
}

.payout-data-issue.is-compact {
  width: auto;
  margin: 12px 16px;
  padding: 12px;
}

.issue-icon {
  width: 18px;
  height: 18px;
  margin-top: 1px;
}

.issue-copy {
  min-width: 0;
}

.issue-copy strong {
  display: block;
  font-size: 13px;
}

.issue-copy p {
  margin: 4px 0 0;
  color: var(--text-sub);
  font-size: 12px;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .payout-data-issue {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .payout-data-issue :deep(.base-button) {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
