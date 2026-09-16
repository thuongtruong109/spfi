import { defineStore } from "pinia";
import { ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import { useLocalizationStore } from "~/stores/localization";
import type { DashboardTrafficSummary } from "~~/types/dashboard";
import {
  cloneDashboardTraffic,
  emptyDashboardTraffic,
} from "~~/utils/dashboard-traffic";
import { getAppErrorMessage } from "~~/utils/error";

interface TrafficStoreCache {
  traffic: DashboardTrafficSummary;
  hasFetched: boolean;
}

export const useTrafficStore = defineStore("traffic", () => {
  const localizationStore = useLocalizationStore();
  const traffic = ref<DashboardTrafficSummary>(emptyDashboardTraffic());
  const hasFetched = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  let scopeVersion = 0;
  let requestSequence = 0;

  const cache = usePerStoreCache<TrafficStoreCache>({
    capture: () => ({
      traffic: cloneDashboardTraffic(traffic.value),
      hasFetched: hasFetched.value,
    }),
    restore: (snapshot) => {
      traffic.value = cloneDashboardTraffic(snapshot.traffic);
      hasFetched.value = snapshot.hasFetched;
      isLoading.value = false;
      error.value = null;
    },
    reset: resetState,
    onStoreChange: () => {
      scopeVersion += 1;
      requestSequence += 1;
    },
  });

  async function fetchTraffic(storeId: string, token: string, force = false) {
    if (!storeId || !token) {
      error.value = localizationStore.t("traffic.errorCredentialsRequired");
      return false;
    }

    cache.activate(storeId);
    if (hasFetched.value && !force) return true;

    const requestVersion = scopeVersion;
    const requestId = ++requestSequence;
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<DashboardTrafficSummary>("/api/traffic", {
        method: "POST",
        body: { storeId, token },
      });
      if (!isActive(storeId, requestVersion, requestId)) return false;

      traffic.value = cloneDashboardTraffic(response);
      hasFetched.value = true;
      cache.remember(storeId);
      return true;
    } catch (requestError) {
      if (isActive(storeId, requestVersion, requestId)) {
        error.value = getAppErrorMessage(
          requestError,
          localizationStore.t("traffic.errorFetch"),
        );
      }
      return false;
    } finally {
      if (isActive(storeId, requestVersion, requestId)) isLoading.value = false;
    }
  }

  function isActive(storeId: string, requestVersion: number, requestId: number) {
    return (
      scopeVersion === requestVersion &&
      requestSequence === requestId &&
      cache.isActive(storeId)
    );
  }

  function resetState() {
    traffic.value = emptyDashboardTraffic();
    hasFetched.value = false;
    isLoading.value = false;
    error.value = null;
  }

  function $reset() {
    scopeVersion += 1;
    requestSequence += 1;
    resetState();
  }

  return {
    traffic,
    hasFetched,
    isLoading,
    error,
    isStoreActive: cache.isActive,
    fetchTraffic,
    hydrate: cache.hydrate,
    evictStore: cache.evict,
    $reset,
  };
});
