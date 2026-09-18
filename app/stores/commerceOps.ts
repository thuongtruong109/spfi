import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useCommerceOpsApi } from "~/composables/useCommerceOpsApi";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import type {
  AbandonedCheckoutSummary,
  DiscountAction,
  DiscountCreateInput,
  DiscountSummary,
  DraftOrderAction,
  DraftOrderCreateInput,
  DraftOrderSummary,
  ReturnAction,
  ReturnActionInput,
  ReturnSummary,
} from "~~/types/shopify-operations";
import { getAppErrorMessage } from "~~/utils/error";

export type CommerceOpsResource =
  "draftOrders" | "discounts" | "abandonedCheckouts" | "returns";

type ResourceErrors = Record<CommerceOpsResource, string | null>;

interface CommerceOpsCache {
  draftOrders: DraftOrderSummary[];
  discounts: DiscountSummary[];
  abandonedCheckouts: AbandonedCheckoutSummary[];
  returns: ReturnSummary[];
  errors: ResourceErrors;
  hasLoaded: boolean;
}

const EMPTY_ERRORS = (): ResourceErrors => ({
  draftOrders: null,
  discounts: null,
  abandonedCheckouts: null,
  returns: null,
});

export const useCommerceOpsStore = defineStore("commerceOps", () => {
  const api = useCommerceOpsApi();
  const draftOrders = ref<DraftOrderSummary[]>([]);
  const discounts = ref<DiscountSummary[]>([]);
  const abandonedCheckouts = ref<AbandonedCheckoutSummary[]>([]);
  const returns = ref<ReturnSummary[]>([]);
  const errors = ref<ResourceErrors>(EMPTY_ERRORS());
  const loadingResources = ref<CommerceOpsResource[]>([]);
  const hasLoaded = ref(false);
  const isMutating = ref(false);
  const mutationError = ref<string | null>(null);
  let scopeVersion = 0;

  const cache = usePerStoreCache<CommerceOpsCache>({
    capture: captureState,
    restore: restoreState,
    reset: resetState,
    onStoreChange: () => {
      scopeVersion += 1;
    },
  });

  const isLoading = computed(() => loadingResources.value.length > 0);
  const availableResourceCount = computed(
    () => Object.values(errors.value).filter((message) => !message).length,
  );

  async function loadAll(storeId: string, token: string, force = false) {
    if (!storeId || !token) return false;
    cache.activate(storeId);
    if (hasLoaded.value && !force) return true;

    const requestVersion = scopeVersion;
    await Promise.allSettled([
      loadResource(storeId, token, "draftOrders", requestVersion),
      loadResource(storeId, token, "discounts", requestVersion),
      loadResource(storeId, token, "abandonedCheckouts", requestVersion),
      loadResource(storeId, token, "returns", requestVersion),
    ]);
    if (!isActive(storeId, requestVersion)) return false;
    hasLoaded.value = true;
    cache.remember(storeId);
    return availableResourceCount.value > 0;
  }

  async function refreshResource(
    storeId: string,
    token: string,
    resource: CommerceOpsResource,
  ) {
    if (!cache.isActive(storeId)) return false;
    const requestVersion = scopeVersion;
    await loadResource(storeId, token, resource, requestVersion);
    if (isActive(storeId, requestVersion)) {
      hasLoaded.value = true;
      cache.remember(storeId);
      return true;
    }
    return false;
  }

  async function loadResource(
    storeId: string,
    token: string,
    resource: CommerceOpsResource,
    requestVersion: number,
  ) {
    addLoading(resource);
    errors.value[resource] = null;
    const auth = { storeId, token };
    try {
      if (resource === "draftOrders") {
        const response = await api.listDraftOrders(auth);
        if (isActive(storeId, requestVersion)) draftOrders.value = response.items;
      } else if (resource === "discounts") {
        const response = await api.listDiscounts(auth);
        if (isActive(storeId, requestVersion)) discounts.value = response.items;
      } else if (resource === "abandonedCheckouts") {
        const response = await api.listAbandonedCheckouts(auth);
        if (isActive(storeId, requestVersion))
          abandonedCheckouts.value = response.items;
      } else {
        const response = await api.listReturns(auth);
        if (isActive(storeId, requestVersion)) returns.value = response.items;
      }
    } catch (error) {
      if (isActive(storeId, requestVersion)) {
        errors.value[resource] = getAppErrorMessage(
          error,
          `Failed to load ${resource}.`,
        );
      }
    } finally {
      if (isActive(storeId, requestVersion)) removeLoading(resource);
    }
  }

  async function createDraft(
    storeId: string,
    token: string,
    input: DraftOrderCreateInput,
  ) {
    return mutate(
      storeId,
      async (requestVersion) => {
        const response = await api.createDraftOrder({ storeId, token }, input);
        if (isActive(storeId, requestVersion)) {
          draftOrders.value.unshift(response.draftOrder);
          errors.value.draftOrders = null;
        }
        return response.draftOrder;
      },
      "Failed to create the draft order.",
    );
  }

  async function actOnDraft(
    storeId: string,
    token: string,
    id: string,
    action: DraftOrderAction,
  ) {
    return mutate(
      storeId,
      async () => {
        const result = await api.runDraftOrderAction({ storeId, token }, id, action);
        await refreshResource(storeId, token, "draftOrders");
        return result;
      },
      `Failed to ${action} the draft order.`,
    );
  }

  async function createCodeDiscount(
    storeId: string,
    token: string,
    input: DiscountCreateInput,
  ) {
    return mutate(
      storeId,
      async () => {
        const result = await api.createDiscount({ storeId, token }, input);
        await refreshResource(storeId, token, "discounts");
        return result;
      },
      "Failed to create the discount.",
    );
  }

  async function actOnDiscount(
    storeId: string,
    token: string,
    id: string,
    action: DiscountAction,
  ) {
    return mutate(
      storeId,
      async () => {
        const result = await api.runDiscountAction({ storeId, token }, id, action);
        await refreshResource(storeId, token, "discounts");
        return result;
      },
      `Failed to ${action} the discount.`,
    );
  }

  async function actOnReturn(
    storeId: string,
    token: string,
    id: string,
    action: ReturnAction,
    input: ReturnActionInput = {},
  ) {
    return mutate(
      storeId,
      async () => {
        const result = await api.runReturnAction({ storeId, token }, id, action, input);
        await refreshResource(storeId, token, "returns");
        return result;
      },
      `Failed to ${action} the return.`,
    );
  }

  async function mutate<T>(
    storeId: string,
    operation: (requestVersion: number) => Promise<T>,
    fallback: string,
  ): Promise<T | null> {
    if (isMutating.value) return null;
    cache.activate(storeId);
    const requestVersion = scopeVersion;
    isMutating.value = true;
    mutationError.value = null;
    try {
      const result = await operation(requestVersion);
      if (!isActive(storeId, requestVersion)) return null;
      cache.remember(storeId);
      return result;
    } catch (error) {
      if (isActive(storeId, requestVersion)) {
        mutationError.value = getAppErrorMessage(error, fallback);
      }
      return null;
    } finally {
      if (isActive(storeId, requestVersion)) isMutating.value = false;
    }
  }

  function addLoading(resource: CommerceOpsResource) {
    if (!loadingResources.value.includes(resource)) {
      loadingResources.value = [...loadingResources.value, resource];
    }
  }

  function removeLoading(resource: CommerceOpsResource) {
    loadingResources.value = loadingResources.value.filter((item) => item !== resource);
  }

  function isActive(storeId: string, requestVersion: number) {
    return cache.isActive(storeId) && scopeVersion === requestVersion;
  }

  function captureState(): CommerceOpsCache {
    return {
      draftOrders: [...draftOrders.value],
      discounts: [...discounts.value],
      abandonedCheckouts: [...abandonedCheckouts.value],
      returns: [...returns.value],
      errors: { ...errors.value },
      hasLoaded: hasLoaded.value,
    };
  }

  function restoreState(snapshot: CommerceOpsCache) {
    draftOrders.value = [...snapshot.draftOrders];
    discounts.value = [...snapshot.discounts];
    abandonedCheckouts.value = [...snapshot.abandonedCheckouts];
    returns.value = [...snapshot.returns];
    errors.value = { ...snapshot.errors };
    hasLoaded.value = snapshot.hasLoaded;
    loadingResources.value = [];
    isMutating.value = false;
    mutationError.value = null;
  }

  function resetState() {
    draftOrders.value = [];
    discounts.value = [];
    abandonedCheckouts.value = [];
    returns.value = [];
    errors.value = EMPTY_ERRORS();
    loadingResources.value = [];
    hasLoaded.value = false;
    isMutating.value = false;
    mutationError.value = null;
  }

  return {
    draftOrders,
    discounts,
    abandonedCheckouts,
    returns,
    errors,
    hasLoaded,
    isLoading,
    isMutating,
    mutationError,
    availableResourceCount,
    loadingResources,
    isStoreActive: cache.isActive,
    hydrate: cache.hydrate,
    evictStore: cache.evict,
    loadAll,
    refreshResource,
    createDraft,
    actOnDraft,
    createCodeDiscount,
    actOnDiscount,
    actOnReturn,
  };
});
