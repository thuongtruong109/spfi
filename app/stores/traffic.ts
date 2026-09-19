import { defineStore } from "pinia";
import { ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import { useLocalizationStore } from "~/stores/localization";
import type {
  DashboardTrafficDimensionKey,
  DashboardTrafficDimensionResponse,
  DashboardTrafficRange,
  DashboardTrafficSummary,
} from "~~/types/dashboard";
import {
  cloneDashboardTraffic,
  emptyDashboardTraffic,
} from "~~/utils/dashboard-traffic";
import { trafficDimensionRequestKey } from "~~/utils/dashboard-traffic-dimensions";
import { getAppErrorMessage } from "~~/utils/error";

interface TrafficStoreCache {
  traffic: DashboardTrafficSummary;
  hasFetched: boolean;
  loadedInsightDimensions: string[];
}

export const useTrafficStore = defineStore("traffic", () => {
  const localizationStore = useLocalizationStore();
  const traffic = ref<DashboardTrafficSummary>(emptyDashboardTraffic());
  const hasFetched = ref(false);
  const isLoading = ref(false);
  const loadingInsightDimensions = ref<string[]>([]);
  const loadedInsightDimensions = ref<string[]>([]);
  const error = ref<string | null>(null);
  const insightError = ref<string | null>(null);
  let scopeVersion = 0;
  let requestSequence = 0;
  let insightRequestSequence = 0;
  const activeInsightRequests = new Map<string, number>();

  const cache = usePerStoreCache<TrafficStoreCache>({
    capture: () => ({
      traffic: cloneDashboardTraffic(traffic.value),
      hasFetched: hasFetched.value,
      loadedInsightDimensions: [...loadedInsightDimensions.value],
    }),
    restore: (snapshot) => {
      traffic.value = cloneDashboardTraffic(snapshot.traffic);
      hasFetched.value = snapshot.hasFetched;
      loadedInsightDimensions.value = [...(snapshot.loadedInsightDimensions || [])];
      isLoading.value = false;
      loadingInsightDimensions.value = [];
      activeInsightRequests.clear();
      error.value = null;
      insightError.value = null;
    },
    reset: resetState,
    onStoreChange: () => {
      scopeVersion += 1;
      requestSequence += 1;
      insightRequestSequence += 1;
      activeInsightRequests.clear();
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
      loadedInsightDimensions.value = [];
      loadingInsightDimensions.value = [];
      activeInsightRequests.clear();
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

  async function fetchTrafficDimension(
    storeId: string,
    token: string,
    range: DashboardTrafficRange,
    dimension: DashboardTrafficDimensionKey,
    force = false,
  ) {
    if (!storeId || !token) return false;

    cache.activate(storeId);
    const requestKey = trafficDimensionRequestKey(range, dimension);
    if (loadedInsightDimensions.value.includes(requestKey) && !force) return true;
    if (loadingInsightDimensions.value.includes(requestKey) && !force) return true;

    const requestVersion = scopeVersion;
    const requestId = ++insightRequestSequence;
    activeInsightRequests.set(requestKey, requestId);
    loadingInsightDimensions.value = Array.from(
      new Set([...loadingInsightDimensions.value, requestKey]),
    );
    insightError.value = null;

    try {
      const response = await $fetch<DashboardTrafficDimensionResponse>(
        "/api/traffic/details",
        {
          method: "POST",
          body: { storeId, token, range, dimension },
        },
      );
      if (!isInsightActive(storeId, requestVersion, requestKey, requestId)) {
        return false;
      }

      const rangeData = traffic.value.rangeData[response.range];
      traffic.value = {
        ...traffic.value,
        rangeData: {
          ...traffic.value.rangeData,
          [response.range]: {
            ...rangeData,
            dimensions: {
              ...rangeData.dimensions,
              [response.dimension]: {
                rows: response.rows,
                totalSessions: response.totalSessions,
                hasMore: response.hasMore,
              },
            },
          },
        },
      };
      loadedInsightDimensions.value = Array.from(
        new Set([...loadedInsightDimensions.value, requestKey]),
      );
      cache.remember(storeId);
      return true;
    } catch (requestError) {
      if (isInsightActive(storeId, requestVersion, requestKey, requestId)) {
        insightError.value = getAppErrorMessage(
          requestError,
          localizationStore.t("traffic.errorInsights"),
        );
      }
      return false;
    } finally {
      if (isInsightActive(storeId, requestVersion, requestKey, requestId)) {
        activeInsightRequests.delete(requestKey);
        loadingInsightDimensions.value = loadingInsightDimensions.value.filter(
          (key) => key !== requestKey,
        );
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

  function isInsightActive(
    storeId: string,
    requestVersion: number,
    requestKey: string,
    requestId: number,
  ) {
    return (
      scopeVersion === requestVersion &&
      activeInsightRequests.get(requestKey) === requestId &&
      cache.isActive(storeId)
    );
  }

  function resetState() {
    traffic.value = emptyDashboardTraffic();
    hasFetched.value = false;
    isLoading.value = false;
    loadingInsightDimensions.value = [];
    loadedInsightDimensions.value = [];
    activeInsightRequests.clear();
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
    loadingInsightDimensions,
    loadedInsightDimensions,
    error,
    insightError,
    isStoreActive: cache.isActive,
    fetchTraffic,
    fetchTrafficDimension,
    hydrate: cache.hydrate,
    evictStore: cache.evict,
    $reset,
  };
});
