import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useDataRetentionStore } from "~/stores/dataRetention";
import { useFormStore } from "~/stores/form";
import type {
  DashboardLoadOptions,
  DashboardService,
  DashboardStoreFailure,
  StoreDashboardSnapshot,
} from "~~/types/dashboard";
import {
  normalizeDashboardServices,
  normalizeDashboardStoreIds,
} from "~~/utils/dashboard-load";
import { getAppErrorMessage } from "~~/utils/error";
import { getStoreTokenState, resolveStoreAccessToken } from "~~/utils/shop-auth";

const DASHBOARD_REQUEST_CONCURRENCY = 2;

export const useDashboardStore = defineStore("dashboard", () => {
  const formStore = useFormStore();
  const credentialVault = useCredentialVaultStore();
  const dataRetention = useDataRetentionStore();
  const stores = ref<StoreDashboardSnapshot[]>([]);
  const failures = ref<DashboardStoreFailure[]>([]);
  const isLoading = ref(false);
  const completedStores = ref(0);
  const totalStores = ref(0);
  const lastUpdated = ref<number | null>(null);
  const loadedFingerprint = ref("");
  const hasLoaded = ref(false);
  let refreshSequence = 0;
  let activeRequest: Promise<void> | null = null;
  let webhookRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  let lastLoadOptions: Required<DashboardLoadOptions> | null = null;

  const progress = computed(() =>
    totalStores.value
      ? Math.round((completedStores.value / totalStores.value) * 100)
      : 0,
  );

  const isPrepared = ref(false);

  function prepare() {
    formStore.loadKnownStores();
    credentialVault.initialize();
    dataRetention.initialize();
    totalStores.value = formStore.knownStores.length;
    isPrepared.value = true;
  }

  async function load(force = false, options?: DashboardLoadOptions) {
    prepare();

    const resolvedOptions = resolveLoadOptions(options);
    const fingerprint = buildStoreFingerprint(resolvedOptions);
    const cacheIsAlive =
      hasLoaded.value &&
      loadedFingerprint.value === fingerprint &&
      dataRetention.isAlive(lastUpdated.value || undefined);

    if (!force && cacheIsAlive) return;
    if (activeRequest) return activeRequest;

    activeRequest = fetchDashboard(fingerprint, resolvedOptions).finally(() => {
      activeRequest = null;
    });
    return activeRequest;
  }

  async function fetchDashboard(
    fingerprint: string,
    options: Required<DashboardLoadOptions>,
  ) {
    const sequence = ++refreshSequence;
    isLoading.value = true;
    completedStores.value = 0;
    totalStores.value = options.storeIds.length;

    const nextFailures: DashboardStoreFailure[] = [];
    const requests: Array<{ storeId: string; token: string }> = [];

    for (const storeId of options.storeIds) {
      const storeData = credentialVault.getStoreData(storeId);
      const tokenState = getStoreTokenState(storeData);
      const label = storeData.domain || storeId;

      if (tokenState !== "valid") {
        nextFailures.push({
          storeId,
          label,
          reason: tokenState === "expired" ? "expired-token" : "missing-token",
          message:
            tokenState === "expired"
              ? "Access token expired. Rotate it in Manager."
              : "No active access token is saved for this store.",
        });
        completedStores.value += 1;
        continue;
      }

      requests.push({ storeId, token: resolveStoreAccessToken(storeData) });
    }

    const nextStores = await mapWithConcurrency(
      requests,
      DASHBOARD_REQUEST_CONCURRENCY,
      async ({ storeId, token }) => {
        try {
          return await $fetch<StoreDashboardSnapshot>("/api/dashboard", {
            method: "POST",
            body: {
              storeId,
              token,
              timezoneOffsetMinutes: new Date().getTimezoneOffset(),
              services: options.services,
            },
          });
        } catch (error) {
          const storeData = credentialVault.getStoreData(storeId);
          nextFailures.push({
            storeId,
            label: storeData.domain || storeId,
            reason: "request-failed",
            message: getAppErrorMessage(
              error,
              "Dashboard data could not be loaded for this store.",
            ),
          });
          return null;
        } finally {
          if (sequence === refreshSequence) completedStores.value += 1;
        }
      },
    );

    if (sequence !== refreshSequence) return;
    stores.value = nextStores.filter((snapshot): snapshot is StoreDashboardSnapshot =>
      Boolean(snapshot),
    );
    failures.value = nextFailures;
    lastUpdated.value = Date.now();
    loadedFingerprint.value = fingerprint;
    lastLoadOptions = options;
    hasLoaded.value = true;
    isLoading.value = false;
  }

  function invalidate() {
    loadedFingerprint.value = "";
  }

  function refreshFromWebhook() {
    invalidate();
    if (!hasLoaded.value) return;

    if (webhookRefreshTimer) clearTimeout(webhookRefreshTimer);
    webhookRefreshTimer = setTimeout(async () => {
      webhookRefreshTimer = null;
      if (activeRequest) await activeRequest;
      await load(true);
    }, 500);
  }

  function $reset() {
    refreshSequence += 1;
    stores.value = [];
    failures.value = [];
    isLoading.value = false;
    completedStores.value = 0;
    totalStores.value = 0;
    lastUpdated.value = null;
    loadedFingerprint.value = "";
    hasLoaded.value = false;
    isPrepared.value = false;
    activeRequest = null;
    lastLoadOptions = null;
    if (webhookRefreshTimer) clearTimeout(webhookRefreshTimer);
    webhookRefreshTimer = null;
  }

  function resolveLoadOptions(
    options?: DashboardLoadOptions,
  ): Required<DashboardLoadOptions> {
    const source = options || lastLoadOptions || {};
    return {
      storeIds: normalizeDashboardStoreIds(source.storeIds, formStore.knownStores),
      services: normalizeDashboardServices(
        source.services as DashboardService[] | undefined,
      ),
    };
  }

  function buildStoreFingerprint(options: Required<DashboardLoadOptions>) {
    const storeFingerprint = [...options.storeIds]
      .sort()
      .map((storeId) => {
        const data = credentialVault.getStoreData(storeId);
        return [
          storeId,
          data.domain || "",
          data.expiresTime || 0,
          getStoreTokenState(data),
        ].join(":");
      })
      .join("|");
    return `${storeFingerprint}::${[...options.services].sort().join(",")}`;
  }

  return {
    stores,
    failures,
    isLoading,
    completedStores,
    totalStores,
    lastUpdated,
    hasLoaded,
    isPrepared,
    progress,
    prepare,
    load,
    invalidate,
    refreshFromWebhook,
    $reset,
  };
});

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput) => Promise<TOutput>,
) {
  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex] as TInput);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, runWorker),
  );
  return results;
}
