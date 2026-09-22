<script setup lang="ts">
import { AlertTriangle, Home, RotateCcw } from "@lucide/vue";
import type { Pinia } from "pinia";
import { computed, getCurrentInstance } from "vue";
import { defaultMessages, type MessageKey } from "~/locales/messages";
import { useLocalizationStore } from "~/stores/localization";

const props = defineProps<{
  error?: {
    statusCode?: number;
    statusMessage?: string;
    message?: string;
  } | null;
}>();

defineEmits<{
  retry: [];
  home: [];
}>();

// This component must also render when app initialization fails before Pinia exists.
const pinia = getCurrentInstance()?.appContext.config.globalProperties.$pinia as
  Pinia | undefined;
const localization = pinia ? useLocalizationStore(pinia) : null;
const t = (key: MessageKey) => localization?.t(key) || defaultMessages[key] || key;
const statusCode = computed(() => Number(props.error?.statusCode) || 500);
const message = computed(() => {
  const publicMessage = String(props.error?.statusMessage || "").trim();
  const clientMessage =
    statusCode.value < 500 ? String(props.error?.message || "").trim() : "";
  return publicMessage || clientMessage || t("errorPage.fallbackMessage");
});
</script>

<template>
  <section class="app-error-state" role="alert">
    <span class="error-icon"><AlertTriangle /></span>
    <p class="error-code">{{ statusCode }}</p>
    <h1>{{ t("errorPage.title") }}</h1>
    <p class="error-message">{{ message }}</p>
    <div class="error-actions">
      <BaseButton @click="$emit('retry')">
        <template #icon><RotateCcw /></template>
        {{ t("errorPage.retry") }}
      </BaseButton>
      <BaseButton variant="primary" @click="$emit('home')">
        <template #icon><Home /></template>
        {{ t("errorPage.home") }}
      </BaseButton>
    </div>
  </section>
</template>

<style scoped>
.app-error-state {
  display: grid;
  width: min(560px, calc(100% - 32px));
  min-height: 320px;
  margin: 48px auto;
  padding: 40px;
  place-items: center;
  align-content: center;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
  color: var(--text);
  text-align: center;
}

.error-icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 12px;
  background: var(--red-soft);
  color: var(--red);
}

.error-icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.error-code {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
}

h1 {
  margin: 0;
  font-size: 24px;
}

.error-message {
  max-width: 440px;
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.error-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

@media (max-width: 520px) {
  .app-error-state {
    padding: 28px 20px;
  }

  .error-actions {
    width: 100%;
    flex-direction: column;
  }
}
</style>
