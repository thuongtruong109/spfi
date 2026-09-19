import { defineStore } from "pinia";
import { ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import { useLocalizationStore } from "~/stores/localization";
import type {
  DashboardTrafficDetailRangeResponse,
  DashboardTrafficRange,
  DashboardTrafficSummary,
} from "~~/types/dashboard";
import {
  cloneDashboardTraffic,
  emptyDashboardTraffic,
} from "~~/utils/dashboard-traffic";
import { getAppErrorMessage } from "~~/utils/error";

interface TrafficStoreCache {
  traffic: DashboardTrafficSummary;
  hasFetched: boolean;
  loadedInsightRanges: DashboardTrafficRange[];
}

export const useTrafficStore = defineStore("traffic", () => {
  const localizationStore = useLocalizationStore();
  const traffic = ref<DashboardTrafficSummary>(emptyDashboardTraffic());
  const hasFetched = ref(false);
  const isLoading = ref(false);
  const loadingInsightRange = ref<DashboardTrafficRange | null>(null);
  const loadedInsightRanges = ref<DashboardTrafficRange[]>([]);
  const error = ref<string | null>(null);
  const insightError = ref<string | null>(null);
  let scopeVersion = 0;
  let requestSequence = 0;
  let insightRequestSequence = 0;

  const cache = usePerStoreCache<TrafficStoreCache>({
    capture: () => ({
      traffic: cloneDashboardTraffic(traffic.value),
      hasFetched: hasFetched.value,
      loadedInsightRanges: [...loadedInsightRanges.value],
    }),
    restore: (snapshot) => {
      traffic.value = cloneDashboardTraffic(snapshot.traffic);
      hasFetched.value = snapshot.hasFetched;
      loadedInsightRanges.value = [...(snapshot.loadedInsightRanges || [])];
      isLoading.value = false;
      loadingInsightRange.value = null;
      error.value = null;
      insightError.value = null;
    },
    reset: resetState,
    onStoreChange: () => {
      scopeVersion += 1;
      requestSequence += 1;
      insightRequestSequence += 1;
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
      loadedInsightRanges.value = [];
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

  async function fetchTrafficRange(
    storeId: string,
    token: string,
    range: DashboardTrafficRange,
    force = false,
  ) {
    if (!storeId || !token) return false;

    cache.activate(storeId);
    if (loadedInsightRanges.value.includes(range) && !force) return true;

    const requestVersion = scopeVersion;
    const requestId = ++insightRequestSequence;
    loadingInsightRange.value = range;
    insightError.value = null;

    try {
      const response = await $fetch<DashboardTrafficDetailRangeResponse>(
        "/api/traffic/details",
        {
          method: "POST",
          body: { storeId, token, range },
        },
      );
      if (!isInsightActive(storeId, requestVersion, requestId)) return false;

      const rangeData = traffic.value.rangeData[response.range];
      traffic.value = {
        ...traffic.value,
        ...(response.range === "30d"
          ? {
              details: response.details,
              detailLimitReached: response.detailLimitReached,
            }
          : {}),
        rangeData: {
          ...traffic.value.rangeData,
          [response.range]: {
            ...rangeData,
            details: response.details,
            detailLimitReached: response.detailLimitReached,
          },
        },
      };
      loadedInsightRanges.value = Array.from(
        new Set([...loadedInsightRanges.value, response.range]),
      );
      cache.remember(storeId);
      return true;
    } catch (requestError) {
      if (isInsightActive(storeId, requestVersion, requestId)) {
        insightError.value = getAppErrorMessage(
          requestError,
          localizationStore.t("traffic.errorInsights"),
        );
      }
      return false;
    } finally {
      if (isInsightActive(storeId, requestVersion, requestId)) {
        loadingInsightRange.value = null;
      }
    }
  }

  function isActive(storeId: string, requestVersion: number, requestId: number) {
    return (
      scopeVersion === requestVersion &&
      requestSequence === requestId &&
      cache.isActive(storeId)
    );
  }

  function isInsightActive(storeId: string, requestVersion: number, requestId: number) {
    return (
      scopeVersion === requestVersion &&
      insightRequestSequence === requestId &&
      cache.isActive(storeId)
    );
  }

  function resetState() {
    traffic.value = emptyDashboardTraffic();
    hasFetched.value = false;
    isLoading.value = false;
    loadingInsightRange.value = null;
    loadedInsightRanges.value = [];
    error.value = null;
    insightError.value = null;
  }

  function $reset() {
    scopeVersion += 1;
    requestSequence += 1;
    insightRequestSequence += 1;
    resetState();
  }

  return {
    traffic,
    hasFetched,
    isLoading,
    loadingInsightRange,
    loadedInsightRanges,
    error,
    insightError,
    isStoreActive: cache.isActive,
    fetchTraffic,
    fetchTrafficRange,
    hydrate: cache.hydrate,
    evictStore: cache.evict,
    $reset,
  };
});
