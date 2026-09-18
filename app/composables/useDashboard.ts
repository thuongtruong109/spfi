import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useDashboardStore } from "~/stores/dashboard";
import { useFormStore } from "~/stores/form";
import type { DashboardLoadOptions } from "~~/types/dashboard";
import { aggregateDashboardSnapshots } from "~~/utils/dashboard-aggregate";

export function useDashboard() {
  const dashboardStore = useDashboardStore();
  const credentialVault = useCredentialVaultStore();
  const formStore = useFormStore();
  const {
    stores,
    failures,
    isLoading,
    completedStores,
    totalStores,
    lastUpdated,
    hasLoaded,
    isPrepared,
    progress,
  } = storeToRefs(dashboardStore);

  const aggregate = computed(() =>
    aggregateDashboardSnapshots(stores.value, failures.value),
  );
  const availableStores = computed(() =>
    formStore.knownStores
      .map((storeId) => ({
        id: storeId,
        label: credentialVault.getStoreData(storeId).domain || storeId,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  return {
    aggregate,
    stores,
    failures,
    isLoading,
    completedStores,
    totalStores,
    progress,
    lastUpdated,
    hasLoaded,
    isPrepared,
    availableStores,
    prepare: dashboardStore.prepare,
    ensureLoaded: (options?: DashboardLoadOptions) =>
      dashboardStore.load(false, options),
    refresh: () => dashboardStore.load(true),
    invalidate: dashboardStore.invalidate,
  };
}
