<script setup lang="ts">
import {
  Database,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  Link2,
  Save,
  Settings2,
  Trash2,
  Truck,
} from "@lucide/vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useDataRetentionStore } from "~/stores/dataRetention";
import { useSheetSettingsStore } from "~/stores/sheetSettings";
import { useToastStore } from "~/stores/toast";
import type { TrackingCarrier } from "~~/types/tracking";
import { PINIA_RETENTION_PRESETS } from "~~/utils/pinia-retention";
import { normalizeSheetSettings } from "~~/utils/sheet-settings";
import {
  TRACKTACO_CARRIERS,
  TRACKTACO_CARRIER_NAMES,
  TRACKTACO_V2_BASE_URL,
} from "~~/utils/tracktaco";

definePageMeta({ layout: false });

const { locale, t } = useLocalization();
const credentialVault = useCredentialVaultStore();
const dataRetention = useDataRetentionStore();
const toast = useToastStore();
const sheetSettings = useSheetSettingsStore();
const { requestConfirmation } = useConfirmDialog();
const runtimeConfig = useRuntimeConfig();

const apiKey = ref("");
const carrier = ref<TrackingCarrier>("fedex");
const showApiKey = ref(false);
const isSaving = ref(false);
const formError = ref("");
const sheetUrlsInput = ref("");
const masterSheetUrlInput = ref("");
const masterSheetTabsInput = ref("");

const sheetDeploymentConfig = {
  sheetUrls: runtimeConfig.public.sheetUrls,
  masterSheetUrl: runtimeConfig.public.masterSheetUrl,
  masterSheetTabs: runtimeConfig.public.masterSheetTabs,
};
sheetSettings.initialize();

function loadSheetSettingsForm() {
  const resolved = sheetSettings.resolve(sheetDeploymentConfig);
  sheetUrlsInput.value = resolved.sheetUrls.join("\n");
  masterSheetUrlInput.value = resolved.masterSheetUrl;
  masterSheetTabsInput.value = resolved.masterSheetTabs.join("\n");
}

loadSheetSettingsForm();

const pendingSheetSettings = computed(() =>
  normalizeSheetSettings({
    sheetUrls: sheetUrlsInput.value,
    masterSheetUrl: masterSheetUrlInput.value,
    masterSheetTabs: masterSheetTabsInput.value,
  }),
);
const hasSheetChanges = computed(
  () =>
    JSON.stringify(pendingSheetSettings.value) !==
    JSON.stringify(sheetSettings.resolve(sheetDeploymentConfig)),
);

const retentionIndex = computed({
  get: () => dataRetention.presetIndex,
  set: (value: number) => dataRetention.setPresetIndex(value),
});
const retentionProgress = computed(() => {
  const max = PINIA_RETENTION_PRESETS.length - 1;
  return `${(retentionIndex.value / max) * 100}%`;
});
const retentionLabel = computed(() => {
  const ttlMs = dataRetention.ttlMs;
  if (ttlMs === 0) return t("settings.retentionNoCache");
  if (ttlMs === null) return t("settings.retentionUntilRefresh");

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const value =
    ttlMs >= day ? ttlMs / day : ttlMs >= hour ? ttlMs / hour : ttlMs / minute;
  const unit = ttlMs >= day ? "day" : ttlMs >= hour ? "hour" : "minute";

  return new Intl.NumberFormat(locale.value, {
    style: "unit",
    unit,
    unitDisplay: "long",
  }).format(value);
});

const isConfigured = computed(() => Boolean(credentialVault.trackingSettings.apiKey));

const hasChanges = computed(
  () =>
    apiKey.value.trim() !== credentialVault.trackingSettings.apiKey ||
    carrier.value !== credentialVault.trackingSettings.carrier,
);
const carrierOptions = TRACKTACO_CARRIERS.map((value) => ({
  value,
  label: TRACKTACO_CARRIER_NAMES[value],
}));

watch(
  () => credentialVault.trackingSettings,
  (settings) => {
    apiKey.value = settings.apiKey;
    carrier.value = settings.carrier;
    formError.value = "";
  },
  { immediate: true, deep: true },
);

async function saveSettings() {
  const normalizedApiKey = apiKey.value.trim();
  formError.value = "";

  if (!normalizedApiKey) {
    formError.value = t("settings.required");
    return;
  }

  isSaving.value = true;
  try {
    await credentialVault.saveTrackingSettings({
      apiKey: normalizedApiKey,
      carrier: carrier.value,
    });
    toast.success(t("settings.saved"));
  } catch (error) {
    formError.value = error instanceof Error ? error.message : t("settings.required");
  } finally {
    isSaving.value = false;
  }
}

async function clearSettings() {
  if (
    !(await requestConfirmation({
      title: t("confirm.deleteTitle"),
      message: t("settings.clearConfirm"),
      confirmLabel: t("common.clear"),
    }))
  ) {
    return;
  }

  try {
    await credentialVault.removeTrackingSettings();
    apiKey.value = "";
    carrier.value = "fedex";
    showApiKey.value = false;
    formError.value = "";
    toast.success(t("settings.cleared"));
  } catch (error) {
    formError.value = error instanceof Error ? error.message : t("settings.required");
  }
}

function saveSheetSettings() {
  sheetSettings.save(pendingSheetSettings.value);
  loadSheetSettingsForm();
  toast.success(t("settings.sheetSaved"));
}

function restoreDeploymentSheetSettings() {
  sheetSettings.clearOverride();
  loadSheetSettingsForm();
  toast.success(t("settings.sheetRestored"));
}
</script>

<template>
  <AdminPageShell
    :title="t('settings.title')"
    :sub="t('settings.subtitle')"
    size="wide"
  >
    <template #icon>
      <Settings2 />
    </template>
    <template #actions>
      <span class="configuration-status" :class="{ 'is-configured': isConfigured }">
        <span class="status-dot" aria-hidden="true"></span>
        {{ isConfigured ? t("settings.configured") : t("settings.notConfigured") }}
      </span>
    </template>

    <div class="settings-page">
      <div class="settings-grid">
        <section class="settings-card provider-card">
          <div class="card-heading">
            <div class="card-icon"><KeyRound /></div>
            <div>
              <h2>{{ t("settings.providerTitle") }}</h2>
              <p>{{ t("settings.providerDescription") }}</p>
            </div>
          </div>

          <div class="settings-form">
            <div class="provider-fields">
              <div class="field fixed-endpoint">
                <span class="field-label">
                  <Link2 />
                  {{ t("settings.endpointLabel") }}
                </span>
                <code>{{ TRACKTACO_V2_BASE_URL }}/v2</code>
              </div>

              <label class="field">
                <span class="field-label">
                  <KeyRound />
                  {{ t("settings.apiKeyLabel") }}
                </span>
                <span class="secret-input">
                  <input
                    v-model="apiKey"
                    :type="showApiKey ? 'text' : 'password'"
                    autocomplete="new-password"
                    spellcheck="false"
                    maxlength="4096"
                    :placeholder="t('settings.apiKeyPlaceholder')"
                  />
                  <button
                    type="button"
                    class="secret-toggle"
                    :aria-label="
                      showApiKey ? t('settings.hideApiKey') : t('settings.showApiKey')
                    "
                    :title="
                      showApiKey ? t('settings.hideApiKey') : t('settings.showApiKey')
                    "
                    @click="showApiKey = !showApiKey"
                  >
                    <EyeOff v-if="showApiKey" />
                    <Eye v-else />
                  </button>
                </span>
              </label>

              <label class="field carrier-field">
                <span class="field-label">
                  <Truck />
                  {{ t("settings.carrierLabel") }}
                </span>
                <BaseSelect
                  v-model="carrier"
                  :options="carrierOptions"
                  :aria-label="t('settings.carrierLabel')"
                />
              </label>
            </div>

            <p v-if="formError" class="form-error" role="alert">
              {{ formError }}
            </p>

            <div class="form-actions">
              <BaseButton
                variant="danger-ghost"
                size="medium"
                :disabled="!isConfigured || isSaving"
                @click="clearSettings"
              >
                <template #icon><Trash2 /></template>
                {{ t("settings.clear") }}
              </BaseButton>
              <BaseButton
                variant="primary"
                size="medium"
                :loading="isSaving"
                :disabled="!hasChanges"
                @click="saveSettings"
              >
                <template #icon><Save /></template>
                {{ t("settings.save") }}
              </BaseButton>
            </div>
          </div>
        </section>

        <section class="settings-card sheet-settings-card">
          <div class="card-heading">
            <div class="card-icon"><FileSpreadsheet /></div>
            <div>
              <h2>{{ t("settings.sheetTitle") }}</h2>
              <p>{{ t("settings.sheetDescription") }}</p>
            </div>
          </div>

          <div class="settings-form">
            <label class="field">
              <span class="field-label">
                <FileSpreadsheet />
                {{ t("settings.sheetViewerUrls") }}
              </span>
              <textarea
                v-model="sheetUrlsInput"
                rows="3"
                :placeholder="t('settings.sheetViewerPlaceholder')"
              />
              <span class="field-hint">{{ t("settings.sheetViewerHint") }}</span>
            </label>

            <label class="field">
              <span class="field-label">
                <Link2 />
                {{ t("settings.masterSheetUrl") }}
              </span>
              <input
                v-model="masterSheetUrlInput"
                :placeholder="t('settings.masterSheetPlaceholder')"
              />
              <span class="field-hint">{{ t("settings.masterSheetHint") }}</span>
            </label>

            <label class="field">
              <span class="field-label">
                <Database />
                {{ t("settings.masterSheetTabs") }}
              </span>
              <textarea
                v-model="masterSheetTabsInput"
                rows="3"
                :placeholder="t('settings.masterTabsPlaceholder')"
              />
              <span class="field-hint">{{ t("settings.masterTabsHint") }}</span>
            </label>

            <div class="form-actions">
              <BaseButton
                size="medium"
                :disabled="!sheetSettings.hasLocalOverride"
                @click="restoreDeploymentSheetSettings"
              >
                {{ t("settings.restoreSheetDefaults") }}
              </BaseButton>
              <BaseButton
                variant="primary"
                size="medium"
                :disabled="!hasSheetChanges"
                @click="saveSheetSettings"
              >
                <template #icon><Save /></template>
                {{ t("settings.saveSheetSettings") }}
              </BaseButton>
            </div>
          </div>
        </section>

        <SettingsWebhookSettingsPanel />

        <section class="settings-card retention-card">
          <div class="card-heading retention-heading">
            <div class="card-icon"><Database /></div>
            <div>
              <h2>{{ t("settings.retentionTitle") }}</h2>
              <p>{{ t("settings.retentionDescription") }}</p>
            </div>
            <output class="retention-value" for="pinia-retention">
              {{ retentionLabel }}
            </output>
          </div>

          <div class="retention-control">
            <label class="retention-label" for="pinia-retention">
              {{ t("settings.retentionCurrent") }}
            </label>
            <input
              id="pinia-retention"
              v-model.number="retentionIndex"
              class="retention-slider"
              type="range"
              min="0"
              :max="PINIA_RETENTION_PRESETS.length - 1"
              step="1"
              :style="{ '--retention-progress': retentionProgress }"
              :aria-valuetext="retentionLabel"
            />
            <div class="retention-endpoints" aria-hidden="true">
              <span>{{ t("settings.retentionNoCache") }}</span>
              <span>{{ t("settings.retentionUntilRefresh") }}</span>
            </div>
            <p class="retention-hint">{{ t("settings.retentionHint") }}</p>
          </div>
        </section>
      </div>
    </div>
  </AdminPageShell>
</template>

<style scoped>
.settings-page {
  display: grid;
  gap: 18px;
}

.configuration-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: var(--control-height-sm);
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--muted);
}

.configuration-status.is-configured {
  border-color: color-mix(in srgb, var(--green) 30%, var(--border));
  background: var(--green-soft);
  color: var(--green);
}

.configuration-status.is-configured .status-dot {
  background: var(--green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 14%, transparent);
}

.settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 18px;
  align-items: start;
}

.settings-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.settings-card,
.retention-card {
  grid-column: 1 / -1;
  overflow: hidden;
}

.provider-card {
  overflow: visible;
}

.retention-heading {
  align-items: center;
}

.retention-heading > div:nth-child(2) {
  min-width: 0;
  flex: 1;
}

.retention-value {
  flex: 0 0 auto;
  padding: 7px 11px;
  border-radius: 999px;
  background: var(--green-soft);
  color: var(--green);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.retention-control {
  display: grid;
  padding: 22px 24px 20px;
}

.retention-label {
  margin-bottom: 16px;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
}

.retention-slider {
  width: 100%;
  height: 22px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

.retention-slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--green) 0 var(--retention-progress),
    var(--line) var(--retention-progress) 100%
  );
}

.retention-slider::-moz-range-track {
  height: 6px;
  border-radius: 999px;
  background: var(--line);
}

.retention-slider::-moz-range-progress {
  height: 6px;
  border-radius: 999px;
  background: var(--green);
}

.retention-slider::-webkit-slider-thumb {
  width: 22px;
  height: 22px;
  margin-top: -8px;
  appearance: none;
  border: 3px solid var(--green);
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--green) 28%, transparent);
}

.retention-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: 3px solid var(--green);
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--green) 28%, transparent);
}

.retention-slider:focus-visible {
  outline: none;
}

.retention-slider:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--green) 18%, transparent);
}

.retention-slider:focus-visible::-moz-range-thumb {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--green) 18%, transparent);
}

.retention-endpoints {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 6px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}

.retention-endpoints span:last-child {
  text-align: right;
}

.retention-hint {
  margin: 16px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}

.card-heading {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}

.card-icon {
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 9px;
  background: var(--green-soft);
  color: var(--green);
}

.card-icon {
  width: 36px;
  height: 36px;
}

.card-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.card-heading h2 {
  margin: 0;
  color: var(--text);
  font-size: 16px;
  line-height: 1.35;
}

.card-heading p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.settings-form {
  display: grid;
  gap: 18px;
  padding: 20px;
}

.provider-fields {
  display: grid;
  grid-template-columns: minmax(210px, 0.9fr) minmax(260px, 1.35fr) fit-content(220px);
  align-items: start;
  gap: 18px;
}

.carrier-field {
  width: min(220px, 100%);
}

.carrier-field :deep(.custom-select) {
  width: fit-content;
  min-width: 170px;
  max-width: 100%;
}

.field {
  display: grid;
  gap: 7px;
}

.field-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
}

.field-label :deep(svg) {
  width: 14px;
  height: 14px;
  color: var(--green);
}

.field input,
.field textarea {
  width: 100%;
  min-height: var(--control-height-md);
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--control-radius);
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.field textarea {
  min-height: 76px;
  padding: 10px 12px;
  resize: vertical;
}

.fixed-endpoint code {
  min-height: var(--control-height-md);
  display: flex;
  align-items: center;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--control-radius);
  background: var(--surface-soft);
  color: var(--text-link);
  font-family: var(--font-mono);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.field input:focus,
.field textarea:focus {
  border-color: var(--green);
  box-shadow: var(--focus-ring);
  outline: none;
}

.field-hint {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.45;
}

.secret-input {
  position: relative;
  display: block;
}

.secret-input input {
  padding-right: 44px;
}

.secret-toggle {
  position: absolute;
  top: 50%;
  right: 6px;
  display: inline-grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: var(--control-radius-sm);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transform: translateY(-50%);
}

.secret-toggle:hover {
  background: var(--surface-soft);
  color: var(--text);
}

.secret-toggle :deep(svg) {
  width: 16px;
  height: 16px;
}

.form-error {
  margin: 0;
  padding: 9px 11px;
  border: 1px solid color-mix(in srgb, var(--red) 24%, transparent);
  border-radius: 7px;
  background: var(--red-soft);
  color: var(--red);
  font-size: 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 2px;
}

@media (max-width: 760px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .provider-fields {
    grid-template-columns: 1fr;
  }

  .carrier-field {
    width: 100%;
  }
}

@media (max-width: 520px) {
  .form-actions {
    align-items: stretch;
    flex-direction: column-reverse;
  }

  .form-actions :deep(.base-button) {
    width: 100%;
  }

  .retention-heading {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .retention-value {
    margin-left: 48px;
  }

  .retention-control {
    padding-inline: 20px;
  }
}
</style>
