import { defineStore } from "pinia";
import { ref } from "vue";
import { useOrderApi } from "~/composables/useOrderApi";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import { usePaymentStore } from "~/stores/payment";
import type { ShopifyOrder } from "~~/types/shopify";
import type {
  OrderCaptureInput,
  OrderCancelInput,
  OrderCountQuery,
  OrderCreateOptions,
  OrderEditCommitInput,
  OrderFulfillmentInput,
  OrderListQuery,
  OrderManualPaymentInput,
  ShopifyPageInfo,
  OrderRefundInput,
  RiskAssessmentLevel,
  ShopifyOrderPayload,
  ShopifyOrderRiskSummary,
  ShopifyRiskFact,
  OrderVoidInput,
} from "~~/types/shopify-order";
import { getAppErrorMessage } from "~~/utils/error";
import {
  forgetStoreResource,
  markStoreResourceLoaded,
} from "~~/utils/store-resource-cache";

interface OrderStoreCache {
  orders: ShopifyOrder[];
  orderCount: number;
  hasFetchedAll: boolean;
  currentPage: number;
  pageSize: number;
  pageInfo: ShopifyPageInfo;
  activeQuery: OrderListQuery;
}

const EMPTY_PAGE_INFO: ShopifyPageInfo = {
  nextCursor: null,
  previousCursor: null,
  hasNextPage: false,
  hasPreviousPage: false,
};

export const useOrderStore = defineStore("order", () => {
  const orderApi = useOrderApi();
  const orders = ref<ShopifyOrder[]>([]);
  const orderCount = ref(0);
  const riskByOrder = ref<Record<string, ShopifyOrderRiskSummary>>({});
  const hasFetchedAll = ref(false);
  const isLoading = ref(false);
  const isMutating = ref(false);
  const isRiskLoading = ref(false);
  const error = ref<string | null>(null);
  const mutationError = ref<string | null>(null);
  const riskError = ref<string | null>(null);
  let storeScopeVersion = 0;
  const currentPage = ref(1);
  const pageSize = ref(20);
  const pageInfo = ref<ShopifyPageInfo>({ ...EMPTY_PAGE_INFO });
  const activeQuery = ref<OrderListQuery>({ status: "any" });
  const storeCache = usePerStoreCache<OrderStoreCache>({
    capture: () => ({
      orders: [...orders.value],
      orderCount: orderCount.value,
      hasFetchedAll: hasFetchedAll.value,
      currentPage: currentPage.value,
      pageSize: pageSize.value,
      pageInfo: { ...pageInfo.value },
      activeQuery: { ...activeQuery.value },
    }),
    restore: (cached) => {
      orders.value = [...cached.orders];
      orderCount.value = cached.orderCount;
      hasFetchedAll.value = cached.hasFetchedAll;
      currentPage.value = cached.currentPage;
      pageSize.value = cached.pageSize;
      pageInfo.value = { ...cached.pageInfo };
      activeQuery.value = { ...cached.activeQuery };
      riskByOrder.value = {};
      error.value = null;
      mutationError.value = null;
      riskError.value = null;
      isLoading.value = false;
      isMutating.value = false;
      isRiskLoading.value = false;
    },
    reset: resetState,
    onStoreChange: () => {
      storeScopeVersion += 1;
    },
  });
  const activateStore = storeCache.activate;
  const hydrate = storeCache.hydrate;
  const evictStore = storeCache.evict;
  const rememberStore = storeCache.remember;

  async function fetchAll(
    storeId: string,
    token: string,
    force = false,
    query: OrderListQuery = {},
  ) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    activateStore(storeId);
    const requestScope = storeScopeVersion;
    if (!force && hasFetchedAll.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const normalizedQuery = withoutCursor(query);
      const [response, countResponse] = await Promise.all([
        orderApi.list(
          { storeId, token },
          { ...normalizedQuery, limit: pageSize.value },
        ),
        orderApi.count({ storeId, token }, normalizedQuery),
      ]);
      if (!isActiveRequest(storeId, requestScope)) return;

      const snapshot: OrderStoreCache = {
        orders: response.data.orders,
        orderCount: countResponse.count,
        hasFetchedAll: true,
        currentPage: force ? 1 : currentPage.value,
        pageSize: pageSize.value,
        pageInfo: { ...response.meta.pagination },
        activeQuery: { ...normalizedQuery },
      };
      storeCache.set(storeId, snapshot);
      orders.value = [...snapshot.orders];
      orderCount.value = snapshot.orderCount;
      pageInfo.value = { ...snapshot.pageInfo };
      activeQuery.value = { ...snapshot.activeQuery };
      hasFetchedAll.value = true;
      if (force) currentPage.value = 1;
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(err, "Failed to fetch order data.");
      }
    } finally {
      if (isActiveRequest(storeId, requestScope)) {
        isLoading.value = false;
      }
    }
  }

  async function fetchById(storeId: string, token: string, id: string, force = false) {
    void force;
    if (!storeId || !token || !id) return;

    activateStore(storeId);
    const requestScope = storeScopeVersion;
    isLoading.value = true;
    error.value = null;

    try {
      const response = await orderApi.get({ storeId, token }, id);

      if (response.order && isActiveRequest(storeId, requestScope)) {
        const index = orders.value.findIndex((order) => order.id?.toString() === id);
        if (index > -1) {
          orders.value[index] = response.order;
        } else {
          orders.value.push(response.order);
        }
        rememberStore(storeId);
      }
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(err, "Failed to fetch order detail.");
      }
    } finally {
      if (isActiveRequest(storeId, requestScope)) {
        isLoading.value = false;
      }
    }
  }

  function isActiveRequest(storeId: string, requestScope: number) {
    return storeCache.isActive(storeId) && storeScopeVersion === requestScope;
  }

  function setPage(page: number) {
    currentPage.value = Math.max(1, Math.floor(page));
    rememberStore();
  }

  function setPageSize(size: number) {
    pageSize.value = Math.max(1, Math.floor(size));
    currentPage.value = 1;
    rememberStore();
  }

  async function fetchCount(
    storeId: string,
    token: string,
    query: OrderCountQuery = { status: "any" },
  ) {
    if (!storeId || !token) return null;

    activateStore(storeId);
    const requestScope = storeScopeVersion;
    try {
      const response = await orderApi.count({ storeId, token }, query);
      if (isActiveRequest(storeId, requestScope)) {
        orderCount.value = response.count;
        rememberStore(storeId);
      }
      return response.count;
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        mutationError.value = getAppErrorMessage(
          err,
          "Failed to fetch the order count.",
        );
      }
      return null;
    }
  }

  async function createOrder(
    storeId: string,
    token: string,
    order: ShopifyOrderPayload,
    options: OrderCreateOptions = {},
  ) {
    return runMutation(
      storeId,
      async () => {
        const response = await orderApi.create({ storeId, token }, order, options);
        if (response.order) upsertOrder(response.order);
        orderCount.value += response.order ? 1 : 0;
        return response.order || null;
      },
      "Failed to create the order.",
    );
  }

  async function updateOrder(
    storeId: string,
    token: string,
    id: string | number,
    order: ShopifyOrderPayload,
  ) {
    return runMutation(
      storeId,
      async () => {
        const response = await orderApi.update({ storeId, token }, id, order);
        if (response.order) upsertOrder(response.order);
        return response.order || null;
      },
      "Failed to update the order.",
    );
  }

  async function cancelOrder(
    storeId: string,
    token: string,
    id: string | number,
    input: OrderCancelInput = {},
  ) {
    return runOrderAction(storeId, token, id, "cancel", input);
  }

  async function closeOrder(storeId: string, token: string, id: string | number) {
    return runOrderAction(storeId, token, id, "close");
  }

  async function openOrder(storeId: string, token: string, id: string | number) {
    return runOrderAction(storeId, token, id, "open");
  }

  async function deleteOrder(storeId: string, token: string, id: string | number) {
    return runMutation(
      storeId,
      async () => {
        await orderApi.remove({ storeId, token }, id);
        orders.value = orders.value.filter((order) => String(order.id) !== String(id));
        orderCount.value = Math.max(0, orderCount.value - 1);
        rememberStore(storeId);
        return true;
      },
      "Failed to delete the order.",
    );
  }

  async function capturePayment(
    storeId: string,
    token: string,
    id: string | number,
    input: OrderCaptureInput,
  ) {
    return runOrderMutationAndRefresh(
      storeId,
      token,
      id,
      () => orderApi.capture({ storeId, token }, id, input),
      "Failed to capture the order payment.",
      true,
    );
  }

  async function markOrderAsPaid(storeId: string, token: string, id: string | number) {
    return runOrderMutationAndRefresh(
      storeId,
      token,
      id,
      () => orderApi.markAsPaid({ storeId, token }, id),
      "Failed to mark the order as paid.",
      true,
    );
  }

  async function voidOrderTransaction(
    storeId: string,
    token: string,
    id: string | number,
    input: OrderVoidInput,
  ) {
    return runOrderMutationAndRefresh(
      storeId,
      token,
      id,
      () => orderApi.voidTransaction({ storeId, token }, id, input),
      "Failed to void the authorization.",
      true,
    );
  }

  async function createManualPayment(
    storeId: string,
    token: string,
    id: string | number,
    input: OrderManualPaymentInput,
  ) {
    return runOrderMutationAndRefresh(
      storeId,
      token,
      id,
      () => orderApi.createManualPayment({ storeId, token }, id, input),
      "Failed to record the manual payment.",
      true,
    );
  }

  async function refundOrder(
    storeId: string,
    token: string,
    id: string | number,
    input: OrderRefundInput,
  ) {
    return runOrderMutationAndRefresh(
      storeId,
      token,
      id,
      () => orderApi.refund({ storeId, token }, id, input),
      "Failed to refund the order.",
      true,
    );
  }

  async function commitOrderEdit(
    storeId: string,
    token: string,
    id: string | number,
    input: OrderEditCommitInput,
  ) {
    return runOrderMutationAndRefresh(
      storeId,
      token,
      id,
      () => orderApi.commitEdit({ storeId, token }, id, input),
      "Failed to edit the order items.",
    );
  }

  async function fulfillOrder(
    storeId: string,
    token: string,
    id: string | number,
    input: OrderFulfillmentInput,
  ) {
    return runOrderMutationAndRefresh(
      storeId,
      token,
      id,
      () => orderApi.fulfill({ storeId, token }, id, input),
      "Failed to fulfill the selected items.",
      true,
    );
  }

  async function cancelFulfillment(
    storeId: string,
    token: string,
    orderId: string | number,
    fulfillmentId: string | number,
  ) {
    return runOrderMutationAndRefresh(
      storeId,
      token,
      orderId,
      () => orderApi.cancelFulfillment({ storeId, token }, fulfillmentId),
      "Failed to cancel the fulfillment.",
    );
  }

  async function fetchRiskAssessments(
    storeId: string,
    token: string,
    id: string | number,
  ) {
    return runRiskOperation(async () => {
      const response = await orderApi.getRiskAssessments({ storeId, token }, id);
      riskByOrder.value[String(id)] = response.risk;
      return response.risk;
    }, "Failed to fetch order risk assessments.");
  }

  async function createRiskAssessment(
    storeId: string,
    token: string,
    id: string | number,
    riskLevel: RiskAssessmentLevel,
    facts: ShopifyRiskFact[],
  ) {
    return runRiskOperation(async () => {
      const response = await orderApi.createRiskAssessment(
        { storeId, token },
        id,
        riskLevel,
        facts,
      );
      const refreshed = await orderApi.getRiskAssessments({ storeId, token }, id);
      riskByOrder.value[String(id)] = refreshed.risk;
      return response.orderRiskAssessment;
    }, "Failed to create the order risk assessment.");
  }

  async function runOrderAction(
    storeId: string,
    token: string,
    id: string | number,
    action: "cancel" | "close" | "open",
    input: OrderCancelInput = {},
  ) {
    return runMutation(
      storeId,
      async () => {
        const auth = { storeId, token };
        const response =
          action === "cancel"
            ? await orderApi.cancel(auth, id, input)
            : action === "close"
              ? await orderApi.close(auth, id)
              : await orderApi.open(auth, id);
        if (response.order) upsertOrder(response.order);
        if (action === "cancel") await refreshPaymentCache(storeId, token);
        return response.order || null;
      },
      `Failed to ${action} the order.`,
    );
  }

  async function runMutation<T>(
    storeId: string,
    operation: () => Promise<T>,
    fallback: string,
  ): Promise<T | null> {
    if (isMutating.value) return null;
    isMutating.value = true;
    mutationError.value = null;
    try {
      const result = await operation();
      if (storeCache.isActive(storeId)) rememberStore(storeId);
      return result;
    } catch (err) {
      mutationError.value = getAppErrorMessage(err, fallback);
      return null;
    } finally {
      isMutating.value = false;
    }
  }

  async function runOrderMutationAndRefresh(
    storeId: string,
    token: string,
    id: string | number,
    operation: () => Promise<unknown>,
    fallback: string,
    invalidatePayments = false,
  ) {
    return runMutation(
      storeId,
      async () => {
        await operation();
        const paymentRefresh = invalidatePayments
          ? refreshPaymentCache(storeId, token)
          : Promise.resolve();
        try {
          const response = await orderApi.get({ storeId, token }, id);
          if (response.order) upsertOrder(response.order);
          return response.order || null;
        } catch (refreshError) {
          const refreshMessage = getAppErrorMessage(
            refreshError,
            "The refreshed order could not be loaded.",
          );
          mutationError.value = `The action succeeded, but refresh failed: ${refreshMessage}`;
          return orders.value.find((order) => String(order.id) === String(id)) || null;
        } finally {
          await paymentRefresh;
        }
      },
      fallback,
    );
  }

  async function fetchPage(storeId: string, token: string, targetPage: number) {
    const nextPage = Math.max(1, Math.floor(targetPage));
    if (nextPage === currentPage.value) return;

    const isNext = nextPage === currentPage.value + 1;
    const isPrevious = nextPage === currentPage.value - 1;
    const cursor = isNext
      ? pageInfo.value.nextCursor
      : isPrevious
        ? pageInfo.value.previousCursor
        : null;
    if (!cursor) return;

    activateStore(storeId);
    const requestScope = storeScopeVersion;
    isLoading.value = true;
    error.value = null;

    try {
      const response = await orderApi.list(
        { storeId, token },
        { page_info: cursor, limit: pageSize.value },
      );
      if (!isActiveRequest(storeId, requestScope)) return;

      orders.value = [...response.data.orders];
      pageInfo.value = { ...response.meta.pagination };
      currentPage.value = nextPage;
      rememberStore(storeId);
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(err, "Failed to fetch the order page.");
      }
    } finally {
      if (isActiveRequest(storeId, requestScope)) isLoading.value = false;
    }
  }

  async function changePageSize(storeId: string, token: string, size: number) {
    setPageSize(size);
    await fetchAll(storeId, token, true, activeQuery.value);
  }

  async function refreshPaymentCache(storeId: string, token: string) {
    const paymentStore = usePaymentStore();
    paymentStore.evictStore(storeId);
    forgetStoreResource(storeId, "paymentTransactions");
    await paymentStore.fetchBalanceTransactions(storeId, token, true);
    if (
      paymentStore.isStoreActive(storeId) &&
      paymentStore.hasFetchedBalanceTransactions &&
      !paymentStore.error
    ) {
      markStoreResourceLoaded(storeId, "paymentTransactions");
    }
  }

  async function runRiskOperation<T>(
    operation: () => Promise<T>,
    fallback: string,
  ): Promise<T | null> {
    isRiskLoading.value = true;
    riskError.value = null;
    try {
      return await operation();
    } catch (err) {
      riskError.value = getAppErrorMessage(err, fallback);
      return null;
    } finally {
      isRiskLoading.value = false;
    }
  }

  function upsertOrder(order: ShopifyOrder) {
    const index = orders.value.findIndex((item) => item.id === order.id);
    if (index >= 0) orders.value[index] = order;
    else orders.value.unshift(order);
  }

  function $reset() {
    storeScopeVersion += 1;
    resetState();
  }

  function resetState() {
    orders.value = [];
    orderCount.value = 0;
    riskByOrder.value = {};
    hasFetchedAll.value = false;
    currentPage.value = 1;
    pageSize.value = 20;
    pageInfo.value = { ...EMPTY_PAGE_INFO };
    activeQuery.value = { status: "any" };
    error.value = null;
    isLoading.value = false;
    isMutating.value = false;
    isRiskLoading.value = false;
    mutationError.value = null;
    riskError.value = null;
  }

  return {
    orders,
    orderCount,
    riskByOrder,
    hasFetchedAll,
    isLoading,
    isMutating,
    isRiskLoading,
    error,
    mutationError,
    riskError,
    isStoreActive: storeCache.isActive,
    currentPage,
    pageSize,
    pageInfo,
    activeQuery,
    fetchAll,
    fetchById,
    fetchCount,
    createOrder,
    updateOrder,
    cancelOrder,
    closeOrder,
    openOrder,
    deleteOrder,
    capturePayment,
    markOrderAsPaid,
    voidOrderTransaction,
    createManualPayment,
    refundOrder,
    commitOrderEdit,
    fulfillOrder,
    cancelFulfillment,
    fetchRiskAssessments,
    createRiskAssessment,
    hydrate,
    evictStore,
    setPage,
    setPageSize,
    fetchPage,
    changePageSize,
    $reset,
  };
});

function withoutCursor(query: OrderListQuery): OrderListQuery {
  const { page_info: _cursor, limit: _limit, ...filters } = query;
  return filters;
}
