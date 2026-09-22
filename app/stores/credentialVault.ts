import { defineStore } from "pinia";
import { ref } from "vue";
import type { StoreLocalData } from "~~/types/shopify";
import type { TrackingProviderSettings } from "~~/types/tracking";
import { isRecord, readStorageValue } from "~~/utils/browser-storage";
import {
  CREDENTIAL_VAULT_STORAGE_KEY,
  readEncryptedCredentialVault,
  writeEncryptedCredentialVault,
} from "~~/utils/credential-vault-storage";
import {
  KNOWN_STORES_STORAGE_KEY,
  normalizeKnownStores,
  readKnownStores,
} from "~~/utils/known-stores";
import { normalizeTrackingCarrier } from "~~/utils/tracktaco";

const ACTIVE_STORE_STORAGE_KEY = "active_store_id";
const TRACKING_SETTINGS_STORAGE_KEY = "spf_tracking_provider_settings";
const LEGACY_TOKEN_ROTATION_LEASE_PREFIX = "spf_token_rotation_lease:";
const CREDENTIAL_VAULT_VERSION = 1;

interface CredentialVaultSnapshot {
  version: typeof CREDENTIAL_VAULT_VERSION;
  stores: Record<string, StoreLocalData>;
  knownStoreIds: string[];
  activeStoreId: string;
  trackingSettings: TrackingProviderSettings;
}

interface LegacySnapshotResult {
  snapshot: CredentialVaultSnapshot;
  keysToRemove: string[];
  hasData: boolean;
}

function normalizeStoreData(value: Partial<StoreLocalData> | null | undefined) {
  return {
    domain: String(value?.domain || "").trim() || undefined,
    sock: String(value?.sock || "").trim() || undefined,
    clientId: String(value?.clientId || "").trim() || undefined,
    clientSecret: String(value?.clientSecret || "").trim() || undefined,
    accessToken: String(value?.accessToken || "").trim() || undefined,
    expiresTime:
      typeof value?.expiresTime === "number" && Number.isFinite(value.expiresTime)
        ? value.expiresTime
        : undefined,
  } satisfies StoreLocalData;
}

function emptyTrackingSettings(): TrackingProviderSettings {
  return { apiKey: "", carrier: "fedex" };
}

function normalizeTrackingSettings(
  value: Partial<TrackingProviderSettings> | null | undefined,
): TrackingProviderSettings {
  return {
    apiKey: String(value?.apiKey || "").trim(),
    carrier: normalizeTrackingCarrier(value?.carrier),
  };
}

function emptySnapshot(): CredentialVaultSnapshot {
  return {
    version: CREDENTIAL_VAULT_VERSION,
    stores: {},
    knownStoreIds: [],
    activeStoreId: "",
    trackingSettings: emptyTrackingSettings(),
  };
}

function normalizeSnapshot(value: unknown): CredentialVaultSnapshot {
  if (!isRecord(value)) return emptySnapshot();

  const rawStores = isRecord(value.stores) ? value.stores : {};
  const stores: Record<string, StoreLocalData> = {};
  for (const [rawStoreId, rawStoreData] of Object.entries(rawStores)) {
    const storeId = rawStoreId.trim();
    if (!storeId || !isRecord(rawStoreData)) continue;
    stores[storeId] = normalizeStoreData(rawStoreData);
  }

  const knownStoreIds = normalizeKnownStores([
    ...(Array.isArray(value.knownStoreIds) ? value.knownStoreIds : []),
    ...Object.keys(stores),
  ]);
  const requestedActiveStoreId = String(value.activeStoreId || "").trim();

  return {
    version: CREDENTIAL_VAULT_VERSION,
    stores,
    knownStoreIds,
    activeStoreId: knownStoreIds.includes(requestedActiveStoreId)
      ? requestedActiveStoreId
      : "",
    trackingSettings: normalizeTrackingSettings(
      isRecord(value.trackingSettings) ? value.trackingSettings : null,
    ),
  };
}

function readLegacySnapshot(): LegacySnapshotResult {
  if (typeof window === "undefined") {
    return { snapshot: emptySnapshot(), keysToRemove: [], hasData: false };
  }

  const knownStoreIds = readKnownStores();
  const stores: Record<string, StoreLocalData> = {};
  const keysToRemove = [
    KNOWN_STORES_STORAGE_KEY,
    ACTIVE_STORE_STORAGE_KEY,
    TRACKING_SETTINGS_STORAGE_KEY,
    ...knownStoreIds,
    ...knownStoreIds.map(
      (storeId) => `${LEGACY_TOKEN_ROTATION_LEASE_PREFIX}${storeId}`,
    ),
    `${LEGACY_TOKEN_ROTATION_LEASE_PREFIX}$auto-sweep`,
  ];

  for (const storeId of knownStoreIds) {
    const value = readStorageValue<unknown>(storeId, null, {
      allowLegacyValue: true,
    });
    if (isRecord(value)) stores[storeId] = normalizeStoreData(value);
  }

  const trackingValue = readStorageValue<unknown>(TRACKING_SETTINGS_STORAGE_KEY, null, {
    allowLegacyValue: true,
  });
  const activeStoreId = String(
    readStorageValue<unknown>(ACTIVE_STORE_STORAGE_KEY, "", {
      allowLegacyValue: true,
    }) || "",
  ).trim();
  const hasData = keysToRemove.some((key) => localStorage.getItem(key) !== null);

  return {
    snapshot: normalizeSnapshot({
      stores,
      knownStoreIds,
      activeStoreId,
      trackingSettings: isRecord(trackingValue) ? trackingValue : null,
    }),
    keysToRemove,
    hasData,
  };
}

export const useCredentialVaultStore = defineStore("credentialVault", () => {
  const isInitialized = ref(false);
  const initializationError = ref("");
  const storeDataRevision = ref(0);
  const stores = ref<Record<string, StoreLocalData>>({});
  const knownStoreIds = ref<string[]>([]);
  const activeStoreId = ref("");
  const trackingSettings = ref<TrackingProviderSettings>(emptyTrackingSettings());

  let initializationPromise: Promise<void> | null = null;
  let persistenceQueue = Promise.resolve();
  let isListeningForStorageChanges = false;

  function applySnapshot(snapshot: CredentialVaultSnapshot) {
    stores.value = snapshot.stores;
    knownStoreIds.value = snapshot.knownStoreIds;
    activeStoreId.value = snapshot.activeStoreId;
    trackingSettings.value = snapshot.trackingSettings;
    storeDataRevision.value += 1;
  }

  function createSnapshot(): CredentialVaultSnapshot {
    return normalizeSnapshot({
      stores: stores.value,
      knownStoreIds: knownStoreIds.value,
      activeStoreId: activeStoreId.value,
      trackingSettings: trackingSettings.value,
    });
  }

  function initialize(): Promise<void> {
    if (typeof window === "undefined" || isInitialized.value) {
      return Promise.resolve();
    }
    if (initializationPromise) return initializationPromise;

    const hasEncryptedVault =
      localStorage.getItem(CREDENTIAL_VAULT_STORAGE_KEY) !== null;
    const legacy = readLegacySnapshot();
    if (!hasEncryptedVault && legacy.hasData) applySnapshot(legacy.snapshot);

    initializationPromise = (async () => {
      try {
        const encryptedSnapshot = await readEncryptedCredentialVault();
        if (encryptedSnapshot !== null) {
          const normalizedSnapshot = normalizeSnapshot(encryptedSnapshot);
          applySnapshot(normalizedSnapshot);
          removeLegacyStorageKeys([
            ...legacy.keysToRemove,
            ...normalizedSnapshot.knownStoreIds,
            ...normalizedSnapshot.knownStoreIds.map(
              (storeId) => `${LEGACY_TOKEN_ROTATION_LEASE_PREFIX}${storeId}`,
            ),
          ]);
        } else if (legacy.hasData) {
          await writeEncryptedCredentialVault(legacy.snapshot);
          removeLegacyStorageKeys(legacy.keysToRemove);
        }
        listenForStorageChanges();
      } catch (error) {
        initializationError.value =
          error instanceof Error
            ? error.message
            : "The local credential vault could not be initialized.";
        console.error(initializationError.value);
      } finally {
        isInitialized.value = true;
      }
    })();

    return initializationPromise;
  }

  async function ensureInitialized() {
    await initialize();
    if (initializationError.value) throw new Error(initializationError.value);
  }

  function prepareMutation(): Promise<void> | null {
    if (!isInitialized.value) return ensureInitialized();
    if (initializationError.value) throw new Error(initializationError.value);
    return null;
  }

  function getPublicStoreData(storeId: string): StoreLocalData {
    void storeDataRevision.value;
    const data = stores.value[String(storeId || "").trim()];
    return data ? { domain: data.domain, expiresTime: data.expiresTime } : {};
  }

  function getStoreData(storeId: string): StoreLocalData {
    void storeDataRevision.value;
    const data = stores.value[String(storeId || "").trim()];
    return data ? { ...data } : {};
  }

  async function saveStoreData(storeId: string, data: StoreLocalData) {
    const initialization = prepareMutation();
    if (initialization) await initialization;
    const normalizedStoreId = String(storeId || "").trim();
    if (!normalizedStoreId) throw new Error("Store ID is required.");

    stores.value = {
      ...stores.value,
      [normalizedStoreId]: normalizeStoreData(data),
    };
    if (!knownStoreIds.value.includes(normalizedStoreId)) {
      knownStoreIds.value = [...knownStoreIds.value, normalizedStoreId];
    }
    storeDataRevision.value += 1;
    await persistSnapshot();
  }

  async function patchStoreData(storeId: string, patch: Partial<StoreLocalData>) {
    const initialization = prepareMutation();
    if (initialization) await initialization;
    const normalizedStoreId = String(storeId || "").trim();
    if (!normalizedStoreId) throw new Error("Store ID is required.");

    stores.value = {
      ...stores.value,
      [normalizedStoreId]: normalizeStoreData({
        ...stores.value[normalizedStoreId],
        ...patch,
      }),
    };
    if (!knownStoreIds.value.includes(normalizedStoreId)) {
      knownStoreIds.value = [...knownStoreIds.value, normalizedStoreId];
    }
    storeDataRevision.value += 1;
    await persistSnapshot();
  }

  async function removeStoreData(storeId: string) {
    const initialization = prepareMutation();
    if (initialization) await initialization;
    const normalizedStoreId = String(storeId || "").trim();
    if (!normalizedStoreId) return;

    const nextStores = { ...stores.value };
    delete nextStores[normalizedStoreId];
    stores.value = nextStores;
    knownStoreIds.value = knownStoreIds.value.filter((id) => id !== normalizedStoreId);
    if (activeStoreId.value === normalizedStoreId) activeStoreId.value = "";
    storeDataRevision.value += 1;
    await persistSnapshot();
  }

  async function replaceKnownStoreIds(storeIds: Iterable<string>) {
    const initialization = prepareMutation();
    if (initialization) await initialization;
    knownStoreIds.value = normalizeKnownStores(Array.from(storeIds));
    if (!knownStoreIds.value.includes(activeStoreId.value)) activeStoreId.value = "";
    await persistSnapshot();
  }

  async function addKnownStore(storeId: string) {
    const initialization = prepareMutation();
    if (initialization) await initialization;
    const normalizedStoreId = String(storeId || "").trim();
    if (!normalizedStoreId || knownStoreIds.value.includes(normalizedStoreId)) return;
    knownStoreIds.value = [...knownStoreIds.value, normalizedStoreId];
    await persistSnapshot();
  }

  async function setActiveStore(storeId: string) {
    const initialization = prepareMutation();
    if (initialization) await initialization;
    activeStoreId.value = String(storeId || "").trim();
    await persistSnapshot();
  }

  async function saveTrackingSettings(settings: TrackingProviderSettings) {
    const initialization = prepareMutation();
    if (initialization) await initialization;
    trackingSettings.value = normalizeTrackingSettings(settings);
    await persistSnapshot();
  }

  async function removeTrackingSettings() {
    const initialization = prepareMutation();
    if (initialization) await initialization;
    trackingSettings.value = emptyTrackingSettings();
    await persistSnapshot();
  }

  function persistSnapshot() {
    const snapshot = createSnapshot();
    const operation = persistenceQueue
      .catch(() => undefined)
      .then(() => writeEncryptedCredentialVault(snapshot));
    persistenceQueue = operation;
    return operation;
  }

  function listenForStorageChanges() {
    if (isListeningForStorageChanges || typeof window === "undefined") return;
    isListeningForStorageChanges = true;
    window.addEventListener("storage", (event) => {
      if (event.key !== CREDENTIAL_VAULT_STORAGE_KEY || !event.newValue) return;
      void reloadFromEncryptedStorage();
    });
  }

  function removeLegacyStorageKeys(keys: Iterable<string>) {
    for (const key of keys) localStorage.removeItem(key);
  }

  async function reloadFromEncryptedStorage() {
    try {
      const snapshot = await readEncryptedCredentialVault();
      if (snapshot !== null) applySnapshot(normalizeSnapshot(snapshot));
    } catch (error) {
      console.error(
        error instanceof Error
          ? error.message
          : "The updated credential vault could not be read.",
      );
    }
  }

  return {
    isInitialized,
    initializationError,
    storeDataRevision,
    knownStoreIds,
    activeStoreId,
    trackingSettings,
    initialize,
    getPublicStoreData,
    getStoreData,
    saveStoreData,
    patchStoreData,
    removeStoreData,
    replaceKnownStoreIds,
    addKnownStore,
    setActiveStore,
    saveTrackingSettings,
    removeTrackingSettings,
  };
});
