import { computed } from "vue";
import { defineStore } from "pinia";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { normalizeKnownStores } from "~~/utils/known-stores";

export const useFormStore = defineStore("form", () => {
  const credentialVault = useCredentialVaultStore();

  const storeId = computed({
    get: () => credentialVault.activeStoreId,
    set: (value: string) => {
      credentialVault.activeStoreId = String(value || "").trim();
      void credentialVault.setActiveStore(value).catch(reportPersistenceError);
    },
  });
  const knownStores = computed({
    get: () => credentialVault.knownStoreIds,
    set: (value: string[]) => {
      credentialVault.knownStoreIds = normalizeKnownStores(value);
      void credentialVault.replaceKnownStoreIds(value).catch(reportPersistenceError);
    },
  });

  function loadKnownStores() {
    return credentialVault.initialize();
  }

  function setActiveStore(id: string) {
    const normalized = String(id || "").trim();
    credentialVault.activeStoreId = normalized;
    return credentialVault.setActiveStore(normalized);
  }

  function saveKnownStores() {
    return credentialVault.replaceKnownStoreIds(credentialVault.knownStoreIds);
  }

  function addKnownStore(id: string) {
    const normalized = String(id || "").trim();
    if (!normalized || credentialVault.knownStoreIds.includes(normalized)) {
      return Promise.resolve();
    }

    credentialVault.knownStoreIds = [...credentialVault.knownStoreIds, normalized];
    return credentialVault.addKnownStore(normalized);
  }

  function removeKnownStore(id: string) {
    const normalized = String(id || "").trim();
    if (typeof document !== "undefined") {
      document.cookie = `${normalized}=; Max-Age=0; path=/`;
    }
    return credentialVault.removeStoreData(normalized);
  }

  return {
    storeId,
    knownStores,
    loadKnownStores,
    setActiveStore,
    addKnownStore,
    removeKnownStore,
    saveKnownStores,
  };
});

function reportPersistenceError(error: unknown) {
  console.error(
    error instanceof Error
      ? error.message
      : "The encrypted credential vault could not be updated.",
  );
}
