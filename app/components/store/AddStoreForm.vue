<script setup lang="ts">
import { X } from "@lucide/vue";
import {
  useAddStoreConnection,
  type AddStoreMode,
} from "~/composables/useAddStoreConnection";

const props = withDefaults(
  defineProps<{
    showCancel?: boolean;
    bulkRows?: number;
    showModeToggle?: boolean;
    mode?: AddStoreMode;
  }>(),
  {
    showCancel: false,
    bulkRows: 12,
    showModeToggle: true,
    mode: undefined,
  },
);

const emit = defineEmits<{
  cancel: [];
  connected: [count: number];
  "update:mode": [mode: AddStoreMode];
}>();
const { t } = useLocalization();

const form = useAddStoreConnection();

watch(
  () => props.mode,
  (mode) => {
    if (mode && form.mode.value !== mode) {
      form.mode.value = mode;
    }
  },
  { immediate: true },
);

const selectedMode = computed({
  get: () => props.mode ?? form.mode.value,
  set: (mode: AddStoreMode) => {
    form.mode.value = mode;
    emit("update:mode", mode);
  },
});

async function connect() {
  const count = await form.connect();
  if (count) emit("connected", count);
}
</script>

<template>
  <section class="add-store-panel">
    <div v-if="props.showModeToggle" class="add-store-mode">
      <StoreAddModeToggle v-model="selectedMode" />
    </div>

    <div v-if="selectedMode === 'single'" class="add-store-grid">
      <label class="field field-wide">
        <span>{{ t("store.shopDomain") }}</span>
        <input
          v-model="form.domains.value"
          class="inp"
          type="text"
          :placeholder="t('store.domainPlaceholder')"
          @keyup.enter="connect"
        />
      </label>
      <label class="field field-wide">
        <span>{{ t("store.socksProxy") }}</span>
        <input
          v-model="form.proxy.value"
          class="inp"
          type="text"
          :placeholder="t('store.proxyPlaceholder')"
        />
      </label>
      <label class="field">
        <span>{{ t("store.storeId") }}</span>
        <input
          v-model="form.storeId.value"
          class="inp"
          type="text"
          placeholder="e.g. mystore"
          @paste="form.handleCredentialPaste"
        />
      </label>
      <label class="field">
        <span>{{ t("store.clientId") }}</span>
        <input
          v-model="form.clientId.value"
          class="inp"
          type="text"
          :placeholder="t('store.clientId')"
          @paste="form.handleCredentialPaste"
        />
      </label>
      <label class="field">
        <span>{{ t("store.clientSecret") }}</span>
        <BaseSecretInput
          v-model="form.clientSecret.value"
          :placeholder="t('store.clientSecret')"
          @paste="form.handleCredentialPaste"
        />
      </label>
    </div>

    <label v-else class="field bulk-field">
      <span>{{ t("store.shopDomains") }}</span>
      <textarea
        v-model="form.domains.value"
        class="inp"
        :rows="props.bulkRows"
        :placeholder="t('store.oneDomainPerLine')"
      />
    </label>

    <div
      v-if="
        form.isConnecting.value ||
        form.steps.value.some(
          (step) => step.status !== 'pending' && step.status !== 'done',
        )
      "
      class="step-progress"
      aria-live="polite"
    >
      <div
        v-for="step in form.steps.value"
        :key="step.id"
        class="step-item"
        :class="`status-${step.status}`"
      >
        <span class="step-icon" aria-hidden="true">
          <span v-if="step.status === 'active'" class="spinner-sm" />
          <span v-else-if="step.status === 'done'">✓</span>
          <span v-else-if="step.status === 'error'">✕</span>
          <span v-else>○</span>
        </span>
        <span>{{ step.label }}</span>
      </div>
    </div>

    <div v-if="form.error.value" class="alert alert-err" role="alert">
      {{ form.error.value }}
    </div>
    <div v-if="form.success.value" class="alert alert-ok" role="status">
      {{ form.success.value }}
    </div>

    <div class="add-store-actions">
      <BaseButton
        size="medium"
        variant="ghost"
        :disabled="form.isConnecting.value"
        @click="form.clear"
      >
        <template #icon>
          <IconsRefresh />
        </template>
        {{ t("common.clear") }}
      </BaseButton>
      <BaseButton v-if="props.showCancel" size="medium" @click="emit('cancel')">
        <template #icon><X /></template>
        {{ t("common.cancel") }}
      </BaseButton>
      <BaseButton
        size="medium"
        variant="primary"
        :loading="form.isConnecting.value"
        :disabled="form.isConnecting.value"
        @click="connect"
      >
        <template #icon>
          <IconsAdd />
        </template>
        {{ form.isConnecting.value ? t("common.processing") : t("store.connect") }}
      </BaseButton>
    </div>
  </section>
</template>

<style scoped>
.add-store-panel {
  display: grid;
  gap: 16px;
  padding: 16px 18px;
}

.add-store-mode,
.add-store-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-store-mode {
  justify-content: flex-end;
}

.add-store-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px;
}

.field {
  display: grid;
  grid-column: span 2;
  gap: 6px;
  color: var(--text-sub);
  font-size: 12px;
  font-weight: 600;
}

.field-wide {
  grid-column: span 3;
}

.bulk-field {
  grid-column: 1 / -1;
}

.inp {
  width: 100%;
  min-height: var(--control-height-md);
  border: 1px solid var(--border);
  border-radius: var(--control-radius);
  background: var(--surface);
  color: var(--text);
  padding: 9px 11px;
  font: inherit;
  resize: vertical;
}

.inp:focus-visible {
  border-color: var(--green);
  outline: none;
  box-shadow: var(--focus-ring);
}

.step-progress {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.step-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-sub);
  font-size: 12px;
}

.status-done {
  color: var(--green);
}

.status-error {
  color: var(--red);
}

.alert {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  white-space: pre-wrap;
}

.alert-err {
  border-color: color-mix(in srgb, var(--red) 30%, var(--border));
  background: var(--red-soft);
  color: var(--red);
}

.alert-ok {
  border-color: color-mix(in srgb, var(--green) 30%, var(--border));
  background: var(--green-soft);
  color: var(--green);
}

.add-store-actions {
  justify-content: flex-end;
}

@media (max-width: 760px) {
  .add-store-mode {
    justify-content: flex-start;
  }

  .add-store-grid {
    grid-template-columns: 1fr;
  }

  .field,
  .field-wide {
    grid-column: 1;
  }

  .add-store-actions {
    flex-wrap: wrap;
  }
}
</style>
