<script setup lang="ts">
import { Braces, CodeXml, Download, Image } from "@lucide/vue";
import {
  useTrafficExport,
  type TrafficExportFormat,
} from "~/composables/useTrafficExport";
import type {
  DashboardTrafficPoint,
  DashboardTrafficRange,
  DashboardTrafficRangeData,
} from "~~/types/dashboard";

const props = defineProps<{
  data: DashboardTrafficRangeData;
  points: DashboardTrafficPoint[];
  rangeLabel: string;
}>();

const range = defineModel<DashboardTrafficRange>({ required: true });
const { t } = useLocalization();
const { exportTraffic } = useTrafficExport();
const isExporting = ref(false);
const rangeOptions = [
  { value: "24h" as const, label: "24H" },
  { value: "7d" as const, label: "7D" },
  { value: "30d" as const, label: "30D" },
];
const exportOptions = computed<
  Array<{
    format: TrafficExportFormat;
    label: string;
    detail: string;
    icon: typeof Image;
  }>
>(() => [
  {
    format: "png",
    label: t("dashboard.trafficExportPng"),
    detail: t("dashboard.trafficExportPngDetail"),
    icon: Image,
  },
  {
    format: "html",
    label: t("dashboard.trafficExportHtml"),
    detail: t("dashboard.trafficExportHtmlDetail"),
    icon: CodeXml,
  },
  {
    format: "json",
    label: t("dashboard.trafficExportJson"),
    detail: t("dashboard.trafficExportJsonDetail"),
    icon: Braces,
  },
]);

async function handleExport(format: TrafficExportFormat, close: () => void) {
  if (isExporting.value) return;
  isExporting.value = true;
  try {
    await exportTraffic(format, props.data, props.points, props.rangeLabel);
    close();
  } finally {
    isExporting.value = false;
  }
}
</script>

<template>
  <aside class="traffic-controls">
    <div
      class="traffic-range-tabs"
      role="group"
      :aria-label="t('dashboard.trafficRange')"
    >
      <button
        v-for="option in rangeOptions"
        :key="option.value"
        type="button"
        :class="{ active: range === option.value }"
        :aria-pressed="range === option.value"
        @click="range = option.value"
      >
        {{ option.label }}
      </button>
    </div>

    <BasePopover class="traffic-export-popover" align="right">
      <template #trigger="{ triggerProps }">
        <BaseButton
          v-bind="triggerProps"
          class="traffic-export-trigger"
          size="medium"
          icon-only
          :loading="isExporting"
          :aria-label="t('dashboard.trafficExport')"
          :title="t('dashboard.trafficExport')"
        >
          <template #icon><Download /></template>
        </BaseButton>
      </template>
      <template #default="{ close }">
        <div class="traffic-export-menu">
          <button
            v-for="option in exportOptions"
            :key="option.format"
            type="button"
            role="menuitem"
            :disabled="isExporting"
            @click="handleExport(option.format, close)"
          >
            <span><component :is="option.icon" /></span>
            <span>
              <strong>{{ option.label }}</strong>
              <small>{{ option.detail }}</small>
            </span>
          </button>
        </div>
      </template>
    </BasePopover>
  </aside>
</template>

<style scoped>
.traffic-controls {
  display: grid;
  width: 38px;
  min-width: 0;
  align-content: center;
  justify-self: end;
  gap: 6px;
}

.traffic-range-tabs {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-low);
}

.traffic-range-tabs button {
  min-height: 32px;
  padding: 0 2px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 9px;
  font-weight: 700;
}

.traffic-range-tabs button:hover {
  color: var(--text);
}

.traffic-range-tabs button.active {
  background: var(--surface);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--text) 10%, transparent);
  color: var(--green);
}

.traffic-range-tabs button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.traffic-export-trigger {
  width: 100% !important;
  border-radius: 9px;
}

.traffic-export-popover {
  width: 100%;
}

.traffic-export-popover :deep(.popover-trigger) {
  display: flex;
  width: 100%;
}

.traffic-export-menu {
  display: grid;
  width: 220px;
  padding: 6px;
}

.traffic-export-menu button {
  display: grid;
  grid-template-columns: 34px 1fr;
  align-items: center;
  gap: 9px;
  padding: 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.traffic-export-menu button:hover,
.traffic-export-menu button:focus-visible {
  background: var(--surface-soft);
  outline: none;
}

.traffic-export-menu button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.traffic-export-menu button > span:first-child {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 8px;
  background: var(--green-soft);
  color: var(--green);
}

.traffic-export-menu svg {
  width: 15px;
  height: 15px;
}

.traffic-export-menu button > span:last-child {
  display: grid;
}

.traffic-export-menu strong {
  font-size: 11px;
}

.traffic-export-menu small {
  color: var(--muted);
  font-size: 9px;
}
</style>
