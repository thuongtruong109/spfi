import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import { useLocalizationStore } from "~/stores/localization";
import type {
  DashboardTrafficDimensionKey,
  DashboardTrafficRange,
  TrafficDimensionLoadProgress,
  TrafficDimensionResponse,
  TrafficOverviewResponse,
  TrafficRangeResponse,
} from "~~/types/traffic";
import {
  DASHBOARD_TRAFFIC_DIMENSION_KEYS,
  DASHBOARD_TRAFFIC_OVERVIEW_RANGES,
  DASHBOARD_TRAFFIC_RANGES,
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
  loadedRanges: DashboardTrafficRange[];
}

const INSIGHT_DIMENSION_COUNT = DASHBOARD_TRAFFIC_DIMENSION_KEYS.length;
const FULL_INSIGHT_CONCURRENCY = 2;
const FULL_INSIGHT_PRIORITY: readonly DashboardTrafficDimensionKey[] = [
  "source",
  "country",
  "deviceType",
  "landingPagePath",
];

export const useTrafficStore = defineStore("traffic", () => {
  const localizationStore = useLocalizationStore();
  const traffic = ref<TrafficOverviewResponse>(emptyDashboardTraffic());
  const hasFetched = ref(false);
  const isLoading = ref(false);
  const loadingInsightDimensions = ref<string[]>([]);
  const loadedInsightDimensions = ref<string[]>([]);
  const loadedRanges = ref<DashboardTrafficRange[]>([
    ...DASHBOARD_TRAFFIC_OVERVIEW_RANGES,
  ]);
  const isLoadingRange = ref(false);
  const activeRangeSummary = ref<DashboardTrafficRange | null>(null);
  const isLoadingAllInsights = ref(false);
  const activeFullInsightRange = ref<DashboardTrafficRange | null>(null);
  const trafficInsightProgress = computed<
    Record<DashboardTrafficRange, TrafficDimensionLoadProgress>
  >(
    () =>
      Object.fromEntries(
        DASHBOARD_TRAFFIC_RANGES.map((range) => {
          const loaded = DASHBOARD_TRAFFIC_DIMENSION_KEYS.filter((dimension) =>
            loadedInsightDimensions.value.includes(
              trafficDimensionRequestKey(range, dimension),
            ),
          ).length;
          return [
            range,
            {
              loaded,
              total: INSIGHT_DIMENSION_COUNT,
              percent: Math.round((loaded / INSIGHT_DIMENSION_COUNT) * 100),
              complete: loaded === INSIGHT_DIMENSION_COUNT,
            },
          ];
        }),
      ) as Record<DashboardTrafficRange, TrafficDimensionLoadProgress>,
  );
  const error = ref<string | null>(null);
  const insightError = ref<string | null>(null);
  let scopeVersion = 0;
  let requestSequence = 0;
  let insightRequestSequence = 0;
  let fullInsightBatchSequence = 0;
  let activeOverviewRequest: {
    storeId: string;
    controller: AbortController;
    promise: Promise<boolean>;
  } | null = null;
  let activeRangeRequest: {
    storeId: string;
    range: DashboardTrafficRange;
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
  let activeFullInsightRequest: {
    storeId: string;
    range: DashboardTrafficRange;
    batchId: number;
    promise: Promise<boolean>;
  } | null = null;

  const cache = usePerStoreCache<TrafficStoreCache>({
    capture: () => ({
      traffic: cloneDashboardTraffic(traffic.value),
      hasFetched: hasFetched.value,
      loadedInsightDimensions: [...loadedInsightDimensions.value],
      loadedRanges: [...loadedRanges.value],
    }),
    restore: (snapshot) => {
      traffic.value = cloneDashboardTraffic(snapshot.traffic);
      hasFetched.value = snapshot.hasFetched;
      loadedInsightDimensions.value = [...(snapshot.loadedInsightDimensions || [])];
      loadedRanges.value = [
        ...new Set([
          ...DASHBOARD_TRAFFIC_OVERVIEW_RANGES,
          ...(snapshot.loadedRanges || []),
        ]),
      ];
      isLoading.value = false;
      isLoadingRange.value = false;
      activeRangeSummary.value = null;
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

    abortRangeRequest();
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
        loadedRanges.value = [...DASHBOARD_TRAFFIC_OVERVIEW_RANGES];
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

  async function fetchTrafficRange(
    storeId: string,
    token: string,
    range: DashboardTrafficRange,
    force = false,
  ) {
    if (!storeId || !token) return false;

    cache.activate(storeId);
    if (!hasFetched.value) return false;
    if (loadedRanges.value.includes(range) && !force) return true;
    if (activeRangeRequest) {
      if (
        activeRangeRequest.storeId === storeId &&
        activeRangeRequest.range === range &&
        !force
      ) {
        return activeRangeRequest.promise;
      }
      activeRangeRequest.controller.abort();
    }

    const requestVersion = scopeVersion;
    const controller = new AbortController();
    isLoadingRange.value = true;
    activeRangeSummary.value = range;
    insightError.value = null;

    const promise = (async () => {
      try {
        const response = await $fetch<TrafficRangeResponse>("/api/traffic/range", {
          method: "POST",
          body: {
            storeId,
            token,
            range,
            timeZone: traffic.value.timeZone || undefined,
            refresh: force,
          },
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          scopeVersion !== requestVersion ||
          !cache.isActive(storeId)
        ) {
          return false;
        }

        const current = traffic.value.rangeData[response.range];
        traffic.value = {
          ...traffic.value,
          timeZone: response.timeZone || traffic.value.timeZone,
          rangeData: {
            ...traffic.value.rangeData,
            [response.range]: {
              ...response.data,
              dimensions: current?.dimensions || {},
            },
          },
        };
        loadedRanges.value = Array.from(
          new Set([...loadedRanges.value, response.range]),
        );
        cache.remember(storeId);
        return true;
      } catch (requestError) {
        if (
          !controller.signal.aborted &&
          scopeVersion === requestVersion &&
          cache.isActive(storeId)
        ) {
          insightError.value = getAppErrorMessage(
            requestError,
            localizationStore.t("traffic.errorInsights"),
          );
        }
        return false;
      } finally {
        if (activeRangeRequest?.controller === controller) {
          activeRangeRequest = null;
          isLoadingRange.value = false;
          activeRangeSummary.value = null;
        }
      }
    })();

    activeRangeRequest = { storeId, range, controller, promise };
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
            body: {
              storeId,
              token,
              range,
              dimension,
              timeZone: traffic.value.timeZone || undefined,
              refresh: force,
            },
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

  async function fetchTrafficRangeDimensions(
    storeId: string,
    token: string,
    range: DashboardTrafficRange,
    force = false,
  ) {
    if (!storeId || !token) return false;

    cache.activate(storeId);
    if (!hasFetched.value || !traffic.value.available) return false;
    if (trafficInsightProgress.value[range].complete && !force) return true;
    if (activeFullInsightRequest) {
      if (
        activeFullInsightRequest.storeId === storeId &&
        activeFullInsightRequest.range === range &&
        !force
      ) {
        return activeFullInsightRequest.promise;
      }
      abortInsightRequests();
    }

    const requestVersion = scopeVersion;
    const batchId = ++fullInsightBatchSequence;
    const dimensions = prioritizeInsightDimensions(
      DASHBOARD_TRAFFIC_DIMENSION_KEYS.filter(
        (dimension) =>
          force ||
          !loadedInsightDimensions.value.includes(
            trafficDimensionRequestKey(range, dimension),
          ),
      ),
    );
    let allSucceeded = true;
    isLoadingAllInsights.value = dimensions.length > 0;
    activeFullInsightRange.value = range;

    const promise = (async () => {
      let nextDimensionIndex = 0;
      const loadNextDimension = async () => {
        while (
          allSucceeded &&
          isFullInsightBatchActive(storeId, requestVersion, batchId)
        ) {
          const dimension = dimensions[nextDimensionIndex];
          nextDimensionIndex += 1;
          if (!dimension) return;

          const succeeded = await fetchTrafficDimension(
            storeId,
            token,
            range,
            dimension,
            force,
          );
          if (!succeeded) allSucceeded = false;
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(FULL_INSIGHT_CONCURRENCY, dimensions.length) },
          () => loadNextDimension(),
        ),
      );

      const isActive = isFullInsightBatchActive(storeId, requestVersion, batchId);
      if (!allSucceeded && isActive && !insightError.value) {
        insightError.value = localizationStore.t("traffic.errorInsights");
      }

      return allSucceeded && isActive && trafficInsightProgress.value[range].complete;
    })().finally(() => {
      if (activeFullInsightRequest?.batchId === batchId) {
        activeFullInsightRequest = null;
        isLoadingAllInsights.value = false;
        activeFullInsightRange.value = null;
      }
    });

    activeFullInsightRequest = { storeId, range, batchId, promise };
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

  function isFullInsightBatchActive(
    storeId: string,
    requestVersion: number,
    batchId: number,
  ) {
    return (
      scopeVersion === requestVersion &&
      fullInsightBatchSequence === batchId &&
      cache.isActive(storeId)
    );
  }

  function resetState() {
    traffic.value = emptyDashboardTraffic();
    hasFetched.value = false;
    isLoading.value = false;
    loadingInsightDimensions.value = [];
    loadedInsightDimensions.value = [];
    loadedRanges.value = [...DASHBOARD_TRAFFIC_OVERVIEW_RANGES];
    isLoadingRange.value = false;
    activeRangeSummary.value = null;
    isLoadingAllInsights.value = false;
    activeFullInsightRange.value = null;
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
    fullInsightBatchSequence += 1;
    activeFullInsightRequest = null;
    isLoadingAllInsights.value = false;
    activeFullInsightRange.value = null;
    for (const request of activeInsightRequests.values()) {
      request.controller.abort();
    }
    activeInsightRequests.clear();
    loadingInsightDimensions.value = [];
  }

  function abortAllRequests() {
    activeOverviewRequest?.controller.abort();
    activeOverviewRequest = null;
    abortRangeRequest();
    abortInsightRequests();
  }

  function abortRangeRequest() {
    activeRangeRequest?.controller.abort();
    activeRangeRequest = null;
    isLoadingRange.value = false;
    activeRangeSummary.value = null;
  }

  return {
    traffic,
    hasFetched,
    isLoading,
    loadingInsightDimensions,
    loadedInsightDimensions,
    loadedRanges,
    isLoadingRange,
    activeRangeSummary,
    isLoadingAllInsights,
    activeFullInsightRange,
    trafficInsightProgress,
    error,
    insightError,
    isStoreActive: cache.isActive,
    fetchTraffic,
    fetchTrafficRange,
    fetchTrafficDimension,
    fetchTrafficRangeDimensions,
    cancelTrafficDimensionRequests: abortInsightRequests,
    hydrate: cache.hydrate,
    evictStore: cache.evict,
    $reset,
  };
});

function prioritizeInsightDimensions(
  dimensions: readonly DashboardTrafficDimensionKey[],
) {
  const priority = new Map(
    FULL_INSIGHT_PRIORITY.map((dimension, index) => [dimension, index]),
  );
  return [...dimensions].sort(
    (left, right) =>
      (priority.get(left) ?? FULL_INSIGHT_PRIORITY.length) -
      (priority.get(right) ?? FULL_INSIGHT_PRIORITY.length),
  );
}
