<script setup lang="ts">
import { LayoutDashboard } from "@lucide/vue";

defineProps<{
  storeCount: number;
  loading: boolean;
  completedStores: number;
  progress: number;
}>();

defineEmits<{
  confirm: [];
}>();

const { t } = useLocalization();
</script>

<template>
  <section
    class="dashboard-load-gate"
    role="dialog"
    aria-modal="true"
    aria-labelledby="dashboard-load-gate-title"
    aria-describedby="dashboard-load-gate-description"
  >
    <div class="dashboard-load-gate-card">
      <span class="dashboard-load-gate-icon" aria-hidden="true">
        <LayoutDashboard />
      </span>
      <p class="dashboard-load-gate-eyebrow">
        {{ t("dashboard.loadGateEyebrow") }}
      </p>
      <h1 id="dashboard-load-gate-title">
        {{ t("dashboard.loadGateTitle") }}
      </h1>
      <p id="dashboard-load-gate-description" class="dashboard-load-gate-description">
        {{ t("dashboard.loadGateDescription", { count: storeCount }) }}
      </p>

      <div v-if="loading" class="dashboard-load-gate-progress">
        <div
          class="dashboard-load-gate-progress-track"
          role="progressbar"
          :aria-label="t('dashboard.loadGateLoading')"
          :aria-valuenow="progress"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span :style="{ width: `${progress}%` }" />
        </div>
        <small>
          {{
            t("dashboard.loadGateProgress", {
              completed: completedStores,
              total: storeCount,
            })
          }}
        </small>
      </div>

      <BaseButton
        size="large"
        variant="primary"
        :loading="loading"
        @click="$emit('confirm')"
      >
        {{ loading ? t("dashboard.loadGateLoading") : t("dashboard.loadGateAction") }}
      </BaseButton>
    </div>
  </section>
</template>

<style scoped>
.dashboard-load-gate {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  align-items: start;
  justify-items: center;
  padding: clamp(72px, 15vh, 150px) 16px 32px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--bg) 48%, transparent);
  backdrop-filter: blur(8px);
}

.dashboard-load-gate-card {
  position: sticky;
  top: clamp(24px, 15vh, 150px);
  display: flex;
  width: min(100%, 480px);
  flex-direction: column;
  align-items: center;
  padding: clamp(24px, 4vw, 38px);
  border: 1px solid color-mix(in srgb, var(--green) 24%, var(--border));
  border-radius: 20px;
  background: color-mix(in srgb, var(--surface) 96%, transparent);
  box-shadow: var(--shadow);
  text-align: center;
}

.dashboard-load-gate-icon {
  display: grid;
  width: 54px;
  height: 54px;
  margin-bottom: 15px;
  place-items: center;
  border-radius: 17px;
  background: var(--green-soft);
  color: var(--green);
}

.dashboard-load-gate-icon svg {
  width: 25px;
  height: 25px;
}

.dashboard-load-gate-eyebrow {
  margin: 0 0 7px;
  color: var(--green);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dashboard-load-gate-card h1 {
  margin: 0;
  color: var(--text);
  font-size: clamp(21px, 3vw, 28px);
  line-height: 1.2;
}

.dashboard-load-gate-description {
  max-width: 390px;
  margin: 11px 0 22px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.dashboard-load-gate-card :deep(.base-button) {
  min-width: 190px;
}

.dashboard-load-gate-progress {
  display: grid;
  width: min(100%, 320px);
  gap: 7px;
  margin: -2px 0 18px;
  color: var(--muted);
}

.dashboard-load-gate-progress-track {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-soft);
}

.dashboard-load-gate-progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--green);
  transition: width 0.2s ease;
}

@media (max-width: 500px) {
  .dashboard-load-gate {
    padding-top: 42px;
  }

  .dashboard-load-gate-card {
    top: 42px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-load-gate-progress-track span {
    transition: none;
  }
}
</style>
