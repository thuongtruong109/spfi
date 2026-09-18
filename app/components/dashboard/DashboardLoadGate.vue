<script setup lang="ts">
import { LayoutDashboard } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import {
  DASHBOARD_SERVICES,
  type DashboardLoadOptions,
  type DashboardService,
} from "~~/types/dashboard";

const props = defineProps<{
  stores: Array<{ id: string; label: string }>;
  storeCount: number;
  loading: boolean;
  completedStores: number;
  progress: number;
}>();

const emit = defineEmits<{
  confirm: [options: DashboardLoadOptions];
}>();

const { t } = useLocalization();
const storeMode = ref<"all" | "selected">("all");
const serviceMode = ref<"all" | "selected">("all");
const selectedStoreIds = ref<string[]>(props.stores.map((store) => store.id));
const selectedServices = ref<DashboardService[]>([...DASHBOARD_SERVICES]);
const availableStoreIds = ref(props.stores.map((store) => store.id));

const serviceOptions = computed<Array<{ id: DashboardService; label: string }>>(() =>
  DASHBOARD_SERVICES.map((id) => ({
    id,
    label: t(`dashboard.loadGateService.${id}`),
  })),
);
const targetStoreCount = computed(() =>
  storeMode.value === "all" ? props.stores.length : selectedStoreIds.value.length,
);
const targetServiceCount = computed(() =>
  serviceMode.value === "all"
    ? DASHBOARD_SERVICES.length
    : selectedServices.value.length,
);
const canConfirm = computed(
  () => targetStoreCount.value > 0 && targetServiceCount.value > 0 && !props.loading,
);

watch(
  () => props.stores.map((store) => store.id),
  (storeIds) => {
    const available = new Set(storeIds);
    const previouslyAvailable = new Set(availableStoreIds.value);
    const retained = selectedStoreIds.value.filter((storeId) => available.has(storeId));
    const added = storeIds.filter((storeId) => !previouslyAvailable.has(storeId));
    selectedStoreIds.value = [...retained, ...added];
    availableStoreIds.value = storeIds;
  },
);

function toggleSelection<T extends string>(values: T[], value: T, checked: boolean) {
  return checked
    ? [...new Set([...values, value])]
    : values.filter((item) => item !== value);
}

function toggleStore(storeId: string, event: Event) {
  selectedStoreIds.value = toggleSelection(
    selectedStoreIds.value,
    storeId,
    (event.target as HTMLInputElement).checked,
  );
}

function toggleService(service: DashboardService, event: Event) {
  selectedServices.value = toggleSelection(
    selectedServices.value,
    service,
    (event.target as HTMLInputElement).checked,
  );
}

function confirmLoad() {
  if (!canConfirm.value) return;
  emit("confirm", {
    storeIds:
      storeMode.value === "all"
        ? props.stores.map((store) => store.id)
        : selectedStoreIds.value,
    services:
      serviceMode.value === "all" ? [...DASHBOARD_SERVICES] : selectedServices.value,
  });
}
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

      <div class="dashboard-load-options">
        <fieldset :disabled="loading">
          <legend>{{ t("dashboard.loadGateStores") }}</legend>
          <div class="dashboard-load-segments">
            <button
              type="button"
              :class="{ active: storeMode === 'all' }"
              :aria-pressed="storeMode === 'all'"
              @click="storeMode = 'all'"
            >
              {{ t("dashboard.loadGateAllStores") }}
            </button>
            <button
              type="button"
              :class="{ active: storeMode === 'selected' }"
              :aria-pressed="storeMode === 'selected'"
              @click="storeMode = 'selected'"
            >
              {{ t("dashboard.loadGateSelectedStores") }}
            </button>
          </div>
          <div v-if="storeMode === 'selected'" class="dashboard-load-checklist">
            <div class="dashboard-load-checklist-actions">
              <button
                type="button"
                @click="selectedStoreIds = stores.map((store) => store.id)"
              >
                {{ t("dashboard.loadGateSelectAll") }}
              </button>
              <button type="button" @click="selectedStoreIds = []">
                {{ t("dashboard.loadGateClear") }}
              </button>
            </div>
            <label v-for="store in stores" :key="store.id">
              <input
                type="checkbox"
                :checked="selectedStoreIds.includes(store.id)"
                @change="toggleStore(store.id, $event)"
              />
              <span>{{ store.label }}</span>
            </label>
          </div>
        </fieldset>

        <fieldset :disabled="loading">
          <legend>{{ t("dashboard.loadGateServices") }}</legend>
          <div class="dashboard-load-segments">
            <button
              type="button"
              :class="{ active: serviceMode === 'all' }"
              :aria-pressed="serviceMode === 'all'"
              @click="serviceMode = 'all'"
            >
              {{ t("dashboard.loadGateAllServices") }}
            </button>
            <button
              type="button"
              :class="{ active: serviceMode === 'selected' }"
              :aria-pressed="serviceMode === 'selected'"
              @click="serviceMode = 'selected'"
            >
              {{ t("dashboard.loadGateSelectedServices") }}
            </button>
          </div>
          <div v-if="serviceMode === 'selected'" class="dashboard-load-checklist">
            <div class="dashboard-load-checklist-actions">
              <button type="button" @click="selectedServices = [...DASHBOARD_SERVICES]">
                {{ t("dashboard.loadGateSelectAll") }}
              </button>
              <button type="button" @click="selectedServices = []">
                {{ t("dashboard.loadGateClear") }}
              </button>
            </div>
            <label v-for="service in serviceOptions" :key="service.id">
              <input
                type="checkbox"
                :checked="selectedServices.includes(service.id)"
                @change="toggleService(service.id, $event)"
              />
              <span>{{ service.label }}</span>
            </label>
          </div>
        </fieldset>
      </div>

      <p class="dashboard-load-summary">
        {{
          t("dashboard.loadGateSelectionSummary", {
            stores: targetStoreCount,
            services: targetServiceCount,
          })
        }}
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
              total: targetStoreCount,
            })
          }}
        </small>
      </div>

      <BaseButton
        size="large"
        variant="primary"
        :loading="loading"
        :disabled="!canConfirm"
        @click="confirmLoad"
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
  width: min(100%, 720px);
  flex-direction: column;
  align-items: center;
  padding: clamp(24px, 4vw, 38px);
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
  margin: 11px 0 18px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.dashboard-load-options {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  text-align: left;
}

.dashboard-load-options fieldset {
  min-width: 0;
  margin: 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-raised);
}

.dashboard-load-options legend {
  padding: 0 5px;
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
}

.dashboard-load-segments {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  border-radius: 9px;
  background: var(--surface-soft);
  padding: 3px;
}

.dashboard-load-segments button,
.dashboard-load-checklist-actions button {
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
}

.dashboard-load-segments button {
  min-height: 32px;
  border-radius: 7px;
  padding: 0 8px;
}

.dashboard-load-segments button.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-soft);
}

.dashboard-load-segments button:focus-visible,
.dashboard-load-checklist-actions button:focus-visible,
.dashboard-load-checklist input:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.dashboard-load-checklist {
  display: grid;
  max-height: 190px;
  gap: 3px;
  margin-top: 9px;
  overflow-y: auto;
}

.dashboard-load-checklist-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 1px 4px 4px;
}

.dashboard-load-checklist-actions button {
  color: var(--green);
  padding: 2px;
}

.dashboard-load-checklist label {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 6px 7px;
  border-radius: 7px;
  color: var(--text-sub);
  cursor: pointer;
  font-size: 11px;
}

.dashboard-load-checklist label:hover {
  background: var(--surface-soft);
}

.dashboard-load-checklist input {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  accent-color: var(--green);
}

.dashboard-load-checklist span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-load-summary {
  margin: 12px 0 16px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
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

  .dashboard-load-options {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-load-gate-progress-track span {
    transition: none;
  }
}
</style>
