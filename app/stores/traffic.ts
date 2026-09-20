import { defineStore } from "pinia";
import { ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import { useLocalizationStore } from "~/stores/localization";
import type {
  DashboardTrafficDimensionKey,
  DashboardTrafficRange,
  TrafficDimensionResponse,
  TrafficOverviewResponse,
} from "~~/types/traffic";
import {
  cloneDashboardTraffic,
  emptyDashboardTraffic,
} from "~~/utils/dashboard-traffic";
import { trafficDimensionRequestKey } from "~~/utils/dashboard-traffic-dimensions";
import { getAppErrorMessage } from "~~/utils/error";

interface TrafficStoreCache {
  traffic: TrafficOverviewResponse;
  hasFetched: boolean;
  loadedInsightDimensions: string[];
}

export const useTrafficStore = defineStore("traffic", () => {
  const localizationStore = useLocalizationStore();
  const traffic = ref<TrafficOverviewResponse>(emptyDashboardTraffic());
  const hasFetched = ref(false);
  const isLoading = ref(false);
  const loadingInsightDimensions = ref<string[]>([]);
  const loadedInsightDimensions = ref<string[]>([]);
  const error = ref<string | null>(null);
  const insightError = ref<string | null>(null);
  let scopeVersion = 0;
  let requestSequence = 0;
  let insightRequestSequence = 0;
  let activeOverviewRequest: {
    storeId: string;
    controller: AbortController;
    promise: Promise<boolean>;
  } | null = null;
  const activeInsightRequests = new Map<
    string,
    {
      id: number;
      controller: AbortController;
      promise: Promise<boolean>;
    }
  >();

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
      abortInsightRequests();
      error.value = null;
      insightError.value = null;
    },
    reset: resetState,
    onStoreChange: () => {
      scopeVersion += 1;
      requestSequence += 1;
      insightRequestSequence += 1;
      abortAllRequests();
    },
  });

  async function fetchTraffic(storeId: string, token: string, force = false) {
    if (!storeId || !token) {
      error.value = localizationStore.t("traffic.errorCredentialsRequired");
      return false;
    }

    cache.activate(storeId);
    if (hasFetched.value && !force) return true;

    if (activeOverviewRequest?.storeId === storeId) {
      if (!force) return activeOverviewRequest.promise;
      activeOverviewRequest.controller.abort();
    }

    abortInsightRequests();

    const requestVersion = scopeVersion;
    const requestId = ++requestSequence;
    const controller = new AbortController();
    isLoading.value = true;
    error.value = null;

    const promise = (async () => {
      try {
        const response = await $fetch<TrafficOverviewResponse>("/api/traffic", {
          method: "POST",
          body: { storeId, token, refresh: force },
          signal: controller.signal,
        });
        if (!isActive(storeId, requestVersion, requestId)) return false;

        traffic.value = cloneDashboardTraffic(response);
        hasFetched.value = true;
        loadedInsightDimensions.value = [];
        loadingInsightDimensions.value = [];
        cache.remember(storeId);
        return true;
      } catch (requestError) {
        if (
          !controller.signal.aborted &&
          isActive(storeId, requestVersion, requestId)
        ) {
          error.value = getAppErrorMessage(
            requestError,
            localizationStore.t("traffic.errorFetch"),
          );
        }
        return false;
      } finally {
        if (isActive(storeId, requestVersion, requestId)) isLoading.value = false;
        if (activeOverviewRequest?.controller === controller) {
          activeOverviewRequest = null;
        }
      }
    })();
    activeOverviewRequest = { storeId, controller, promise };
    return promise;
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
    const activeRequest = activeInsightRequests.get(requestKey);
    if (activeRequest) {
      if (!force) return activeRequest.promise;
      activeRequest.controller.abort();
    }

    const requestVersion = scopeVersion;
    const requestId = ++insightRequestSequence;
    const controller = new AbortController();
    loadingInsightDimensions.value = Array.from(
      new Set([...loadingInsightDimensions.value, requestKey]),
    );
    insightError.value = null;

    const promise = (async () => {
      try {
        const response = await $fetch<TrafficDimensionResponse>(
          "/api/traffic/details",
          {
            method: "POST",
            body: { storeId, token, range, dimension, refresh: force },
            signal: controller.signal,
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
        if (
          !controller.signal.aborted &&
          isInsightActive(storeId, requestVersion, requestKey, requestId)
        ) {
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
    })();
    activeInsightRequests.set(requestKey, { id: requestId, controller, promise });
    return promise;
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
      activeInsightRequests.get(requestKey)?.id === requestId &&
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
    abortAllRequests();
    resetState();
  }

  function abortInsightRequests() {
    for (const request of activeInsightRequests.values()) {
      request.controller.abort();
    }
    activeInsightRequests.clear();
    loadingInsightDimensions.value = [];
  }

  function abortAllRequests() {
    activeOverviewRequest?.controller.abort();
    activeOverviewRequest = null;
    abortInsightRequests();
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
