import { defineStore } from "pinia";
import { ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import { useLocalizationStore } from "~/stores/localization";
import type {
  ShopifyNumericId,
  ShopifyProduct,
  ShopifyProductInput,
} from "~~/types/shopify";
import type {
  ProductListQuery,
  ProductAdvancedDetails,
  ProductDuplicateResult,
  ProductManagementContext,
  ProductPageResponse,
  BulkProductActionResult,
  ShopifyProductUpdateInput,
} from "~~/types/shopify-product";
import { getAppErrorMessage } from "~~/utils/error";

interface ProductStoreCache {
  products: ShopifyProduct[];
  hasFetchedAll: boolean;
  totalCount: number;
  nextCursor: string | null;
  filters: ProductListQuery;
  pageSize: number;
  loadedPageCount: number;
  managementContext: ProductManagementContext | null;
}

export interface BulkProductPublicationResult {
  total: number;
  succeeded: number;
  failedIds: ShopifyNumericId[];
}

export const useProductStore = defineStore("product", () => {
  const localization = useLocalizationStore();
  const products = ref<ShopifyProduct[]>([]);
  const hasFetchedAll = ref(false);
  const totalCount = ref(0);
  const nextCursor = ref<string | null>(null);
  const filters = ref<ProductListQuery>({});
  const pageSize = ref(50);
  const loadedPageCount = ref(0);
  const isLoading = ref(false);
  const isLoadingMore = ref(false);
  const error = ref<string | null>(null);
  const managementContext = ref<ProductManagementContext | null>(null);
  let storeScopeVersion = 0;
  let fetchSequence = 0;
  const storeCache = usePerStoreCache<ProductStoreCache>({
    capture: () => ({
      products: [...products.value],
      hasFetchedAll: hasFetchedAll.value,
      totalCount: totalCount.value,
      nextCursor: nextCursor.value,
      filters: { ...filters.value },
      pageSize: pageSize.value,
      loadedPageCount: loadedPageCount.value,
      managementContext: managementContext.value,
    }),
    restore: (cached) => {
      products.value = [...cached.products];
      hasFetchedAll.value = cached.hasFetchedAll;
      totalCount.value = cached.totalCount;
      nextCursor.value = cached.nextCursor;
      filters.value = { ...cached.filters };
      pageSize.value = cached.pageSize;
      loadedPageCount.value = cached.loadedPageCount;
      managementContext.value = cached.managementContext;
      error.value = null;
    },
    reset: resetState,
    onStoreChange: () => {
      storeScopeVersion += 1;
    },
  });
  const activateStore = storeCache.activate;
  const hydrate = storeCache.hydrate;
  const evictStore = storeCache.evict;

  async function fetchAll(
    storeId: string,
    token: string,
    limit = 50,
    query: ProductListQuery = {},
  ) {
    if (!storeId || !token) {
      error.value = localization.t("product.credentialsMissing");
      return;
    }

    activateStore(storeId);
    const requestScope = storeScopeVersion;
    const requestId = ++fetchSequence;
    isLoading.value = true;
    error.value = null;

    try {
      const nextPageSize = normalizePageSize(limit);
      const nextFilters = sanitizeFilters(query);
      const response = await $fetch<ProductPageResponse>("/api/product/page", {
        method: "POST",
        body: {
          storeId,
          token,
          query: { ...nextFilters, limit: nextPageSize },
        },
      });

      const nextProducts = response.products;
      if (!isActiveRequest(storeId, requestScope) || requestId !== fetchSequence) {
        return;
      }
      storeCache.set(storeId, {
        products: [...nextProducts],
        hasFetchedAll: true,
        totalCount: response.count,
        nextCursor: response.pageInfo.nextCursor,
        filters: nextFilters,
        pageSize: nextPageSize,
        loadedPageCount: 1,
        managementContext: managementContext.value,
      });
      if (isActiveRequest(storeId, requestScope) && requestId === fetchSequence) {
        products.value = nextProducts;
        hasFetchedAll.value = true;
        totalCount.value = response.count;
        nextCursor.value = response.pageInfo.nextCursor;
        filters.value = nextFilters;
        pageSize.value = nextPageSize;
        loadedPageCount.value = 1;
      }
    } catch (err) {
      if (isActiveRequest(storeId, requestScope) && requestId === fetchSequence) {
        error.value = getAppErrorMessage(err, localization.t("product.fetchFailed"));
      }
    } finally {
      if (isActiveRequest(storeId, requestScope) && requestId === fetchSequence) {
        isLoading.value = false;
      }
    }
  }

  async function fetchNext(storeId: string, token: string) {
    if (!storeId || !token || !nextCursor.value || isLoadingMore.value) return false;

    activateStore(storeId);
    const requestScope = storeScopeVersion;
    const cursor = nextCursor.value;
    isLoadingMore.value = true;
    error.value = null;
    try {
      const response = await $fetch<ProductPageResponse>("/api/product/page", {
        method: "POST",
        body: {
          storeId,
          token,
          query: {
            ...filters.value,
            limit: pageSize.value,
            page_info: cursor,
          },
        },
      });
      if (!isActiveRequest(storeId, requestScope) || cursor !== nextCursor.value) {
        return false;
      }

      const knownIds = new Set(products.value.map((product) => String(product.id)));
      products.value = [
        ...products.value,
        ...response.products.filter((product) => !knownIds.has(String(product.id))),
      ];
      totalCount.value = response.count;
      nextCursor.value = response.pageInfo.nextCursor;
      loadedPageCount.value += 1;
      storeCache.remember(storeId);
      return true;
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(err, localization.t("product.nextPageFailed"));
      }
      return false;
    } finally {
      if (isActiveRequest(storeId, requestScope)) isLoadingMore.value = false;
    }
  }

  function isActiveRequest(storeId: string, requestScope: number) {
    return storeCache.isActive(storeId) && storeScopeVersion === requestScope;
  }

  async function createProduct(
    storeId: string,
    token: string,
    product: ShopifyProductInput,
  ) {
    if (!storeId || !token) return;
    isLoading.value = true;
    error.value = null;
    try {
      await $fetch("/api/product/create", {
        method: "POST",
        body: { storeId, token, product },
      });
      await refreshCurrent(storeId, token);
      return true;
    } catch (err) {
      error.value = getAppErrorMessage(err, localization.t("product.createFailed"));
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateProduct(
    storeId: string,
    token: string,
    id: ShopifyNumericId,
    product: ShopifyProductUpdateInput,
  ) {
    if (!storeId || !token || !id) return;
    isLoading.value = true;
    error.value = null;
    try {
      await updateProductRequest(storeId, token, id, product);
      await refreshCurrent(storeId, token);
      return true;
    } catch (err) {
      error.value = getAppErrorMessage(err, localization.t("product.updateFailed"));
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function setProductsPublished(
    storeId: string,
    token: string,
    productIds: ShopifyNumericId[],
    publish: boolean,
    publicationIds: string[] = [],
  ): Promise<BulkProductPublicationResult> {
    const uniqueIds = Array.from(
      new Map(
        productIds
          .map((id) => [String(id), id] as const)
          .filter(([id]) => /^\d+$/.test(id)),
      ).values(),
    );
    const result: BulkProductPublicationResult = {
      total: uniqueIds.length,
      succeeded: 0,
      failedIds: [],
    };

    if (!storeId || !token || !uniqueIds.length) return result;

    activateStore(storeId);
    const requestScope = storeScopeVersion;
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<BulkProductPublicationResult>(
        "/api/product/bulk-publication",
        {
          method: "POST",
          body: {
            storeId,
            token,
            productIds: uniqueIds,
            publish,
            ...(publicationIds.length ? { publicationIds } : {}),
          },
        },
      );
      Object.assign(result, response);
    } catch (err) {
      result.failedIds = uniqueIds;
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(
          err,
          localization.t(
            publish ? "product.bulkPublishFailed" : "product.bulkUnpublishFailed",
          ),
        );
      }
    }

    if (isActiveRequest(storeId, requestScope)) {
      await refreshCurrent(storeId, token);
      isLoading.value = false;
    }

    return result;
  }

  async function deleteProduct(storeId: string, token: string, id: ShopifyNumericId) {
    if (!storeId || !token || !id) return;
    isLoading.value = true;
    error.value = null;
    try {
      await $fetch(`/api/product/${id}`, {
        method: "DELETE",
        body: { storeId, token },
      });
      await refreshCurrent(storeId, token);
      return true;
    } catch (err) {
      error.value = getAppErrorMessage(err, localization.t("product.deleteFailed"));
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchManagementContext(storeId: string, token: string, force = false) {
    if (!storeId || !token) return null;
    activateStore(storeId);
    if (managementContext.value && !force) return managementContext.value;
    const requestScope = storeScopeVersion;
    try {
      const response = await $fetch<ProductManagementContext>("/api/product/context", {
        method: "POST",
        body: { storeId, token },
      });
      if (!isActiveRequest(storeId, requestScope)) return null;
      managementContext.value = response;
      storeCache.remember(storeId);
      return response;
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(
          err,
          localization.t("product.managementContextFailed"),
        );
      }
      return null;
    }
  }

  async function fetchAdvancedDetails(
    storeId: string,
    token: string,
    productId: ShopifyNumericId,
  ) {
    if (!storeId || !token || !productId) return null;
    try {
      return await $fetch<ProductAdvancedDetails>("/api/product/advanced/read", {
        method: "POST",
        body: { storeId, token, productId },
      });
    } catch (err) {
      error.value = getAppErrorMessage(
        err,
        localization.t("product.advancedFieldsLoadFailed"),
      );
      return null;
    }
  }

  async function updateAdvancedDetails(
    storeId: string,
    token: string,
    productId: ShopifyNumericId,
    input: Record<string, unknown>,
  ) {
    if (!storeId || !token || !productId) return null;
    try {
      return await $fetch<ProductAdvancedDetails>("/api/product/advanced/update", {
        method: "POST",
        body: { storeId, token, productId, input },
      });
    } catch (err) {
      error.value = getAppErrorMessage(
        err,
        localization.t("product.advancedFieldsUpdateFailed"),
      );
      return null;
    }
  }

  async function runBulkAction(
    storeId: string,
    token: string,
    productIds: ShopifyNumericId[],
    action: "ARCHIVE" | "DELETE",
  ): Promise<BulkProductActionResult> {
    const fallback: BulkProductActionResult = {
      total: productIds.length,
      succeeded: 0,
      failedIds: [...productIds],
    };
    if (!storeId || !token || !productIds.length) return fallback;
    isLoading.value = true;
    error.value = null;
    try {
      const result = await $fetch<BulkProductActionResult>("/api/product/bulk-action", {
        method: "POST",
        body: { storeId, token, productIds, action },
      });
      await refreshCurrent(storeId, token);
      return result;
    } catch (err) {
      error.value = getAppErrorMessage(
        err,
        localization.t(
          action === "DELETE"
            ? "product.bulkDeleteFailed"
            : "product.bulkArchiveFailed",
        ),
      );
      return fallback;
    } finally {
      isLoading.value = false;
    }
  }

  async function duplicateProduct(
    storeId: string,
    token: string,
    productId: ShopifyNumericId,
    input: { newTitle: string; newStatus?: string },
  ) {
    if (!storeId || !token || !productId) return null;
    isLoading.value = true;
    error.value = null;
    try {
      const result = await $fetch<ProductDuplicateResult>("/api/product/duplicate", {
        method: "POST",
        body: { storeId, token, productId, input },
      });
      if (result.product) await refreshCurrent(storeId, token);
      return result;
    } catch (err) {
      error.value = getAppErrorMessage(err, localization.t("product.duplicateFailed"));
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  function $reset() {
    storeScopeVersion += 1;
    resetState();
  }

  function resetState() {
    fetchSequence += 1;
    products.value = [];
    hasFetchedAll.value = false;
    totalCount.value = 0;
    nextCursor.value = null;
    filters.value = {};
    pageSize.value = 50;
    loadedPageCount.value = 0;
    managementContext.value = null;
    error.value = null;
    isLoading.value = false;
    isLoadingMore.value = false;
  }

  function refreshCurrent(storeId: string, token: string) {
    return fetchAll(storeId, token, pageSize.value, filters.value);
  }

  return {
    products,
    hasFetchedAll,
    totalCount,
    nextCursor,
    filters,
    pageSize,
    loadedPageCount,
    isLoading,
    isLoadingMore,
    error,
    managementContext,
    isStoreActive: storeCache.isActive,
    fetchAll,
    fetchNext,
    createProduct,
    updateProduct,
    setProductsPublished,
    fetchManagementContext,
    fetchAdvancedDetails,
    updateAdvancedDetails,
    runBulkAction,
    duplicateProduct,
    deleteProduct,
    hydrate,
    evictStore,
    $reset,
  };
});

function normalizePageSize(value: number) {
  return Math.min(100, Math.max(1, Math.trunc(Number(value) || 50)));
}

function sanitizeFilters(query: ProductListQuery): ProductListQuery {
  return Object.fromEntries(
    Object.entries(query).filter(
      ([key, value]) =>
        key !== "page_info" &&
        key !== "limit" &&
        value !== undefined &&
        value !== null &&
        String(value).trim() !== "",
    ),
  );
}

function updateProductRequest(
  storeId: string,
  token: string,
  id: ShopifyNumericId,
  product: ShopifyProductUpdateInput,
) {
  return $fetch(`/api/product/${encodeURIComponent(String(id))}`, {
    method: "PUT",
    body: { storeId, token, product },
  });
}
