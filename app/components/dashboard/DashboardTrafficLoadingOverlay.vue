<script setup lang="ts">
import { LoaderCircle } from "@lucide/vue";
import type { TrafficDimensionLoadProgress } from "~~/types/dashboard";

const props = defineProps<{
  rangeLabel: string;
  progress: TrafficDimensionLoadProgress;
}>();

const { t } = useLocalization();
const progressWidth = computed(
  () => `${Math.max(0, Math.min(100, props.progress.percent))}%`,
);
</script>

<template>
  <div class="traffic-loading-overlay" role="status" aria-live="polite">
    <div class="traffic-loading-card">
      <div class="traffic-loading-heading">
        <LoaderCircle aria-hidden="true" />
        <div>
          <strong>{{
            t("dashboard.trafficFullLoadingRange", { range: rangeLabel })
          }}</strong>
          <span>
            {{
              t("dashboard.trafficLoadProgress", {
                loaded: progress.loaded,
                total: progress.total,
                percent: progress.percent,
              })
            }}
          </span>
        </div>
      </div>
      <div
        class="traffic-loading-track"
        role="progressbar"
        :aria-label="t('dashboard.trafficFullLoadingRange', { range: rangeLabel })"
        :aria-valuenow="progress.percent"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <i :style="{ width: progressWidth }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.traffic-loading-overlay {
  position: absolute;
  z-index: 4;
  inset: 0;
  padding: 48px 14px 14px;
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  backdrop-filter: blur(2px);
}

.traffic-loading-card {
  position: sticky;
  top: 24px;
  width: min(420px, 100%);
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--green) 30%, var(--border));
  border-radius: 14px;
  margin: 0 auto;
  background: var(--surface-raised);
  box-shadow: var(--shadow-soft);
}

.traffic-loading-heading {
  display: flex;
  align-items: center;
  gap: 11px;
}

.traffic-loading-heading > svg {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  color: var(--green);
  animation: traffic-loading-spin 0.8s linear infinite;
}

.traffic-loading-heading > div {
  display: grid;
  gap: 3px;
}

.traffic-loading-heading strong {
  color: var(--text);
  font-size: 12px;
}

.traffic-loading-heading span {
  color: var(--muted);
  font-size: 10px;
}

.traffic-loading-track {
  height: 8px;
  margin-top: 13px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-low);
}

.traffic-loading-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--green), var(--blue));
  transition: width 0.2s ease;
}

@keyframes traffic-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .traffic-loading-heading > svg {
    animation: none;
  }

  .traffic-loading-track i {
    transition: none;
  }
}
</style>
