import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import type {
  PayoutDetailResponse,
  PayoutsResponse,
  PayoutTransactionsPageResponse,
  ShopifyBalance,
  ShopifyBalanceTransaction,
  ShopifyPayout,
  ShopifyRestPageInfo,
} from "~~/types/shopify";
import type {
  ShopifyBalanceTransactionFilters,
  ShopifyPayoutFilters,
} from "~~/types/shopify-payment";
import type {
  ShopifyConnectionPageInfo,
  ShopifyPaymentsAccount,
  ShopifyPaymentsAccountResponse,
  ShopifyPaymentsBalanceTransactionSearchFilters,
  ShopifyPaymentsDispute,
  ShopifyPaymentsDisputeFilters,
  ShopifyPaymentsDisputesResponse,
  ShopifyPaymentsGraphqlTransactionsResponse,
  ShopifyPaymentsPayoutMetadata,
} from "~~/types/shopify-payments-graphql";
import { getAppErrorMessage } from "~~/utils/error";

export type Payout = ShopifyPayout;
export type Transaction = ShopifyBalanceTransaction;
export type Balance = ShopifyBalance;

interface PageRequestOptions {
  append?: boolean;
  cursor?: string | null;
  force?: boolean;
}

interface PaymentStoreCache {
  balance: Balance | Balance[] | null;
  payouts: Payout[];
  visiblePayouts: Payout[];
  payoutDetails: Record<string, Payout>;
  paymentsAccount: ShopifyPaymentsAccount | null;
  payoutMetadata: Record<string, ShopifyPaymentsPayoutMetadata>;
  transactionsByPayout: Record<string, Transaction[]>;
  loadedPayoutDetails: Record<string, boolean>;
  payoutDetailPageInfo: Record<string, ShopifyRestPageInfo>;
  balanceTransactions: Transaction[];
  visibleBalanceTransactions: Transaction[];
  disputes: ShopifyPaymentsDispute[];
  visibleDisputes: ShopifyPaymentsDispute[];
  transactionPageInfo: ShopifyConnectionPageInfo;
  payoutPageInfo: ShopifyConnectionPageInfo;
  disputePageInfo: ShopifyConnectionPageInfo;
  defaultTransactionPageInfo: ShopifyConnectionPageInfo;
  defaultPayoutPageInfo: ShopifyConnectionPageInfo;
  defaultDisputePageInfo: ShopifyConnectionPageInfo;
  hasFetchedAccount: boolean;
  hasFetchedPayouts: boolean;
  hasFetchedBalanceTransactions: boolean;
  hasFetchedDisputes: boolean;
  isShowingDefaultTransactions: boolean;
  isShowingDefaultPayouts: boolean;
  isShowingDefaultDisputes: boolean;
  graphqlWarning: string | null;
}

const emptyConnectionPage = (): ShopifyConnectionPageInfo => ({
  hasNextPage: false,
  endCursor: null,
});

export const usePaymentStore = defineStore("payment", () => {
  const balance = ref<Balance | Balance[] | null>(null);
  const payouts = ref<Payout[]>([]);
  const visiblePayouts = ref<Payout[]>([]);
  const payoutDetails = ref<Record<string, Payout>>({});
  const paymentsAccount = ref<ShopifyPaymentsAccount | null>(null);
  const payoutMetadata = ref<Record<string, ShopifyPaymentsPayoutMetadata>>({});
  const transactionsByPayout = ref<Record<string, Transaction[]>>({});
  const loadedPayoutDetails = ref<Record<string, boolean>>({});
  const payoutDetailPageInfo = ref<Record<string, ShopifyRestPageInfo>>({});
  const balanceTransactions = ref<Transaction[]>([]);
  const visibleBalanceTransactions = ref<Transaction[]>([]);
  const disputes = ref<ShopifyPaymentsDispute[]>([]);
  const visibleDisputes = ref<ShopifyPaymentsDispute[]>([]);
  const transactionPageInfo = ref(emptyConnectionPage());
  const payoutPageInfo = ref(emptyConnectionPage());
  const disputePageInfo = ref(emptyConnectionPage());
  const defaultTransactionPageInfo = ref(emptyConnectionPage());
  const defaultPayoutPageInfo = ref(emptyConnectionPage());
  const defaultDisputePageInfo = ref(emptyConnectionPage());
  const hasFetchedAccount = ref(false);
  const hasFetchedPayouts = ref(false);
  const hasFetchedBalanceTransactions = ref(false);
  const hasFetchedDisputes = ref(false);
  const isShowingDefaultTransactions = ref(true);
  const isShowingDefaultPayouts = ref(true);
  const isShowingDefaultDisputes = ref(true);
  const isLoadingAccount = ref(false);
  const isLoadingPayouts = ref(false);
  const isLoadingTransactions = ref(false);
  const isLoadingDisputes = ref(false);
  const isLoadingPayoutDetail = ref(false);
  const isLoading = computed(
    () =>
      isLoadingAccount.value ||
      isLoadingPayouts.value ||
      isLoadingTransactions.value ||
      isLoadingDisputes.value ||
      isLoadingPayoutDetail.value,
  );
  const error = ref<string | null>(null);
  const graphqlWarning = ref<string | null>(null);
  let storeScopeVersion = 0;
  const payoutDetailRequests = new Map<string, Promise<void>>();

  const storeCache = usePerStoreCache<PaymentStoreCache>({
    capture: () => ({
      balance: balance.value,
      payouts: [...payouts.value],
      visiblePayouts: [...visiblePayouts.value],
      payoutDetails: { ...payoutDetails.value },
      paymentsAccount: paymentsAccount.value,
      payoutMetadata: { ...payoutMetadata.value },
      transactionsByPayout: { ...transactionsByPayout.value },
      loadedPayoutDetails: { ...loadedPayoutDetails.value },
      payoutDetailPageInfo: { ...payoutDetailPageInfo.value },
      balanceTransactions: [...balanceTransactions.value],
      visibleBalanceTransactions: [...visibleBalanceTransactions.value],
      disputes: [...disputes.value],
      visibleDisputes: [...visibleDisputes.value],
      transactionPageInfo: { ...transactionPageInfo.value },
      payoutPageInfo: { ...payoutPageInfo.value },
      disputePageInfo: { ...disputePageInfo.value },
      defaultTransactionPageInfo: { ...defaultTransactionPageInfo.value },
      defaultPayoutPageInfo: { ...defaultPayoutPageInfo.value },
      defaultDisputePageInfo: { ...defaultDisputePageInfo.value },
      hasFetchedAccount: hasFetchedAccount.value,
      hasFetchedPayouts: hasFetchedPayouts.value,
      hasFetchedBalanceTransactions: hasFetchedBalanceTransactions.value,
      hasFetchedDisputes: hasFetchedDisputes.value,
      isShowingDefaultTransactions: isShowingDefaultTransactions.value,
      isShowingDefaultPayouts: isShowingDefaultPayouts.value,
      isShowingDefaultDisputes: isShowingDefaultDisputes.value,
      graphqlWarning: graphqlWarning.value,
    }),
    restore: restoreStore,
    reset: resetState,
    onStoreChange: () => {
      storeScopeVersion += 1;
      payoutDetailRequests.clear();
    },
  });
  const activateStore = storeCache.activate;
  const hydrate = storeCache.hydrate;
  const evictStore = storeCache.evict;
  const rememberStore = storeCache.remember;

  function isActiveRequest(storeId: string, requestScope: number) {
    return storeCache.isActive(storeId) && storeScopeVersion === requestScope;
  }

  function requireCredentials(storeId: string, token: string) {
    if (storeId && token) return true;
    error.value = "Store ID and Access Token are required.";
    return false;
  }

  async function fetchPaymentsAccount(storeId: string, token: string, force = false) {
    if (!requireCredentials(storeId, token)) return;
    activateStore(storeId);
    const requestScope = storeScopeVersion;
    if (!force && hasFetchedAccount.value) return;

    isLoadingAccount.value = true;
    graphqlWarning.value = null;
    try {
      const response = await $fetch<ShopifyPaymentsAccountResponse>(
        "/api/payment/account",
        { method: "POST", body: { storeId, token } },
      );
      if (!isActiveRequest(storeId, requestScope)) return;
      applyPaymentsAccountResponse(response);
      hasFetchedAccount.value = true;
      rememberStore(storeId);
    } catch (cause) {
      if (isActiveRequest(storeId, requestScope)) {
        graphqlWarning.value = getAppErrorMessage(
          cause,
          "Shopify Payments account details are unavailable.",
        );
      }
    } finally {
      if (isActiveRequest(storeId, requestScope)) isLoadingAccount.value = false;
    }
  }

  async function fetchGraphqlBalanceTransactions(
    storeId: string,
    token: string,
    filters: ShopifyPaymentsBalanceTransactionSearchFilters = {},
    options: PageRequestOptions = {},
  ) {
    if (!requireCredentials(storeId, token)) return;
    activateStore(storeId);
    const requestScope = storeScopeVersion;
    const filtered = hasActiveFilters(filters);
    if (
      !options.append &&
      !options.force &&
      !filtered &&
      hasFetchedBalanceTransactions.value
    ) {
      showDefaultBalanceTransactions();
      return;
    }

    isLoadingTransactions.value = true;
    error.value = null;
    try {
      const response = await $fetch<ShopifyPaymentsGraphqlTransactionsResponse>(
        "/api/payment/graphql-balance-transactions",
        {
          method: "POST",
          body: {
            storeId,
            token,
            filters,
            pagination: { first: 100, after: options.cursor || null },
          },
        },
      );
      if (!isActiveRequest(storeId, requestScope)) return;
      const page = response.transactions.filter(
        (transaction) => transaction.type !== "payout",
      );
      visibleBalanceTransactions.value = options.append
        ? mergeById(visibleBalanceTransactions.value, page)
        : page;
      transactionPageInfo.value = { ...response.pageInfo };
      isShowingDefaultTransactions.value = !filtered;
      if (!filtered) {
        balanceTransactions.value = [...visibleBalanceTransactions.value];
        defaultTransactionPageInfo.value = { ...response.pageInfo };
        transactionsByPayout.value = groupByPayout(balanceTransactions.value);
        loadedPayoutDetails.value = {};
        hasFetchedBalanceTransactions.value = true;
      }
      graphqlWarning.value = null;
      rememberStore(storeId);
    } catch (cause) {
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(
          cause,
          "Failed to load Shopify Payments transactions.",
        );
      }
    } finally {
      if (isActiveRequest(storeId, requestScope)) isLoadingTransactions.value = false;
    }
  }

  function fetchMoreBalanceTransactions(
    storeId: string,
    token: string,
    filters: ShopifyPaymentsBalanceTransactionSearchFilters = {},
  ) {
    const cursor = transactionPageInfo.value.endCursor;
    if (!transactionPageInfo.value.hasNextPage || !cursor) return Promise.resolve();
    return fetchGraphqlBalanceTransactions(storeId, token, filters, {
      append: true,
      cursor,
      force: true,
    });
  }

  function fetchBalanceTransactions(
    storeId: string,
    token: string,
    force = false,
    filters: ShopifyBalanceTransactionFilters = {},
  ) {
    return fetchGraphqlBalanceTransactions(
      storeId,
      token,
      {
        ...(filters.payout_id
          ? { payments_transfer_id: String(filters.payout_id) }
          : {}),
        ...(filters.payout_status ? { payout_status: filters.payout_status } : {}),
        ...(typeof filters.test === "boolean" ? { test: filters.test } : {}),
        ...(filters.since_id ? { since_id: filters.since_id } : {}),
        ...(filters.last_id ? { last_id: filters.last_id } : {}),
      },
      { force },
    );
  }

  async function fetchPayouts(
    storeId: string,
    token: string,
    filters: ShopifyPayoutFilters = {},
    options: PageRequestOptions = {},
  ) {
    if (!requireCredentials(storeId, token)) return;
    activateStore(storeId);
    const requestScope = storeScopeVersion;
    const filtered = hasActiveFilters(filters);
    if (!options.append && !options.force && !filtered && hasFetchedPayouts.value) {
      showDefaultPayouts();
      return;
    }

    isLoadingPayouts.value = true;
    error.value = null;
    try {
      const response = await $fetch<PayoutsResponse>("/api/payment/payout/all", {
        method: "POST",
        body: {
          storeId,
          token,
          filters,
          pagination: { first: 100, after: options.cursor || null },
        },
      });
      if (!isActiveRequest(storeId, requestScope)) return;
      visiblePayouts.value = options.append
        ? mergeById(visiblePayouts.value, response.payouts)
        : response.payouts;
      payoutPageInfo.value = { ...response.pageInfo };
      isShowingDefaultPayouts.value = !filtered;
      payoutMetadata.value = {
        ...payoutMetadata.value,
        ...Object.fromEntries(
          response.metadata.map((item) => [String(item.legacyResourceId), item]),
        ),
      };
      if (!filtered) {
        payouts.value = [...visiblePayouts.value];
        defaultPayoutPageInfo.value = { ...response.pageInfo };
        hasFetchedPayouts.value = true;
      }
      rememberStore(storeId);
    } catch (cause) {
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(cause, "Failed to load payouts.");
      }
    } finally {
      if (isActiveRequest(storeId, requestScope)) isLoadingPayouts.value = false;
    }
  }

  function fetchMorePayouts(
    storeId: string,
    token: string,
    filters: ShopifyPayoutFilters = {},
  ) {
    const cursor = payoutPageInfo.value.endCursor;
    if (!payoutPageInfo.value.hasNextPage || !cursor) return Promise.resolve();
    return fetchPayouts(storeId, token, filters, {
      append: true,
      cursor,
      force: true,
    });
  }

  async function fetchDisputes(
    storeId: string,
    token: string,
    filters: ShopifyPaymentsDisputeFilters = {},
    options: PageRequestOptions = {},
  ) {
    if (!requireCredentials(storeId, token)) return;
    activateStore(storeId);
    const requestScope = storeScopeVersion;
    const filtered = hasActiveFilters(filters);
    if (!options.append && !options.force && !filtered && hasFetchedDisputes.value) {
      showDefaultDisputes();
      return;
    }

    isLoadingDisputes.value = true;
    error.value = null;
    try {
      const response = await $fetch<ShopifyPaymentsDisputesResponse>(
        "/api/payment/dispute/all",
        {
          method: "POST",
          body: {
            storeId,
            token,
            filters,
            pagination: { first: 100, after: options.cursor || null },
          },
        },
      );
      if (!isActiveRequest(storeId, requestScope)) return;
      visibleDisputes.value = options.append
        ? mergeById(visibleDisputes.value, response.disputes)
        : response.disputes;
      disputePageInfo.value = { ...response.pageInfo };
      isShowingDefaultDisputes.value = !filtered;
      if (!filtered) {
        disputes.value = [...visibleDisputes.value];
        defaultDisputePageInfo.value = { ...response.pageInfo };
        hasFetchedDisputes.value = true;
      }
      rememberStore(storeId);
    } catch (cause) {
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(
          cause,
          "Failed to load Shopify Payments disputes.",
        );
      }
    } finally {
      if (isActiveRequest(storeId, requestScope)) isLoadingDisputes.value = false;
    }
  }

  function fetchMoreDisputes(
    storeId: string,
    token: string,
    filters: ShopifyPaymentsDisputeFilters = {},
  ) {
    const cursor = disputePageInfo.value.endCursor;
    if (!disputePageInfo.value.hasNextPage || !cursor) return Promise.resolve();
    return fetchDisputes(storeId, token, filters, {
      append: true,
      cursor,
      force: true,
    });
  }

  function getTransactionsForPayout(payoutId: string | number): Transaction[] {
    return transactionsByPayout.value[String(payoutId)] ?? [];
  }

  function showDefaultBalanceTransactions() {
    visibleBalanceTransactions.value = [...balanceTransactions.value];
    transactionPageInfo.value = { ...defaultTransactionPageInfo.value };
    isShowingDefaultTransactions.value = true;
  }

  function showDefaultPayouts() {
    visiblePayouts.value = [...payouts.value];
    payoutPageInfo.value = { ...defaultPayoutPageInfo.value };
    isShowingDefaultPayouts.value = true;
  }

  function showDefaultDisputes() {
    visibleDisputes.value = [...disputes.value];
    disputePageInfo.value = { ...defaultDisputePageInfo.value };
    isShowingDefaultDisputes.value = true;
  }

  async function fetchPayoutDetail(
    storeId: string,
    token: string,
    payoutId: string | number,
    force = false,
  ) {
    if (!requireCredentials(storeId, token)) return;
    activateStore(storeId);
    const requestScope = storeScopeVersion;
    const normalizedPayoutId = String(payoutId);
    const requestKey = `${storeId}:${normalizedPayoutId}:initial`;
    const pendingRequest = payoutDetailRequests.get(requestKey);
    if (pendingRequest) return pendingRequest;
    if (!force && loadedPayoutDetails.value[normalizedPayoutId]) return;

    isLoadingPayoutDetail.value = true;
    error.value = null;
    const request = (async () => {
      try {
        const response = await $fetch<PayoutDetailResponse>(
          `/api/payment/payout/${normalizedPayoutId}`,
          {
            params: { storeId },
            headers: { "x-shopify-access-token": token },
          },
        );
        if (!isActiveRequest(storeId, requestScope)) return;
        applyPayoutDetail(normalizedPayoutId, response);
        loadedPayoutDetails.value[normalizedPayoutId] = true;
        rememberStore(storeId);
      } catch (cause) {
        if (isActiveRequest(storeId, requestScope)) {
          error.value = getAppErrorMessage(cause, "Failed to fetch payout detail.");
        }
      }
    })();
    payoutDetailRequests.set(requestKey, request);
    await finishPayoutRequest(requestKey, request, storeId, requestScope);
  }

  async function fetchMorePayoutTransactions(
    storeId: string,
    token: string,
    payoutId: string | number,
  ) {
    if (!requireCredentials(storeId, token)) return;
    activateStore(storeId);
    const requestScope = storeScopeVersion;
    const normalizedPayoutId = String(payoutId);
    const cursor = payoutDetailPageInfo.value[normalizedPayoutId]?.nextCursor;
    if (!cursor) return;
    const requestKey = `${storeId}:${normalizedPayoutId}:${cursor}`;
    const pendingRequest = payoutDetailRequests.get(requestKey);
    if (pendingRequest) return pendingRequest;

    isLoadingPayoutDetail.value = true;
    error.value = null;
    const request = (async () => {
      try {
        const response = await $fetch<PayoutTransactionsPageResponse>(
          `/api/payment/payout/${normalizedPayoutId}/transactions`,
          {
            params: { storeId, cursor },
            headers: { "x-shopify-access-token": token },
          },
        );
        if (!isActiveRequest(storeId, requestScope)) return;
        transactionsByPayout.value[normalizedPayoutId] = mergeById(
          transactionsByPayout.value[normalizedPayoutId] || [],
          enrichTransactions(response.transactions),
        );
        payoutDetailPageInfo.value[normalizedPayoutId] = { ...response.pageInfo };
        rememberStore(storeId);
      } catch (cause) {
        if (isActiveRequest(storeId, requestScope)) {
          error.value = getAppErrorMessage(
            cause,
            "Failed to load more payout transactions.",
          );
        }
      }
    })();
    payoutDetailRequests.set(requestKey, request);
    await finishPayoutRequest(requestKey, request, storeId, requestScope);
  }

  async function finishPayoutRequest(
    requestKey: string,
    request: Promise<void>,
    storeId: string,
    requestScope: number,
  ) {
    try {
      await request;
    } finally {
      if (payoutDetailRequests.get(requestKey) === request) {
        payoutDetailRequests.delete(requestKey);
      }
      if (isActiveRequest(storeId, requestScope)) {
        isLoadingPayoutDetail.value = payoutDetailRequests.size > 0;
      }
    }
  }

  function applyPayoutDetail(payoutId: string, response: PayoutDetailResponse) {
    if (response.payout) {
      payoutDetails.value[payoutId] = response.payout;
      payouts.value = upsertById(payouts.value, response.payout);
      visiblePayouts.value = upsertById(visiblePayouts.value, response.payout);
    }
    if (response.metadata) {
      payoutMetadata.value[payoutId] = response.metadata;
    }
    transactionsByPayout.value[payoutId] = enrichTransactions(response.transactions);
    payoutDetailPageInfo.value[payoutId] = { ...response.pageInfo };
  }

  function enrichTransactions(items: Transaction[]) {
    const enrichedById = new Map(
      balanceTransactions.value.map((transaction) => [
        String(transaction.id),
        transaction,
      ]),
    );
    return items.map((transaction) => {
      const enriched = enrichedById.get(String(transaction.id));
      return enriched
        ? {
            ...transaction,
            source_order_name:
              enriched.source_order_name || transaction.source_order_name,
          }
        : transaction;
    });
  }

  function restoreStore(cached: PaymentStoreCache) {
    balance.value = cached.balance;
    payouts.value = [...cached.payouts];
    visiblePayouts.value = [...(cached.visiblePayouts || cached.payouts)];
    payoutDetails.value = { ...cached.payoutDetails };
    paymentsAccount.value = cached.paymentsAccount || null;
    payoutMetadata.value = { ...(cached.payoutMetadata || {}) };
    transactionsByPayout.value = { ...cached.transactionsByPayout };
    loadedPayoutDetails.value = { ...(cached.loadedPayoutDetails || {}) };
    payoutDetailPageInfo.value = { ...(cached.payoutDetailPageInfo || {}) };
    balanceTransactions.value = [...cached.balanceTransactions];
    visibleBalanceTransactions.value = [
      ...(cached.visibleBalanceTransactions || cached.balanceTransactions),
    ];
    disputes.value = [...(cached.disputes || [])];
    visibleDisputes.value = [...(cached.visibleDisputes || cached.disputes || [])];
    transactionPageInfo.value = {
      ...(cached.transactionPageInfo || emptyConnectionPage()),
    };
    payoutPageInfo.value = { ...(cached.payoutPageInfo || emptyConnectionPage()) };
    disputePageInfo.value = { ...(cached.disputePageInfo || emptyConnectionPage()) };
    defaultTransactionPageInfo.value = {
      ...(cached.defaultTransactionPageInfo ||
        cached.transactionPageInfo ||
        emptyConnectionPage()),
    };
    defaultPayoutPageInfo.value = {
      ...(cached.defaultPayoutPageInfo ||
        cached.payoutPageInfo ||
        emptyConnectionPage()),
    };
    defaultDisputePageInfo.value = {
      ...(cached.defaultDisputePageInfo ||
        cached.disputePageInfo ||
        emptyConnectionPage()),
    };
    hasFetchedAccount.value = cached.hasFetchedAccount || false;
    hasFetchedPayouts.value = cached.hasFetchedPayouts || false;
    hasFetchedBalanceTransactions.value = cached.hasFetchedBalanceTransactions;
    hasFetchedDisputes.value = cached.hasFetchedDisputes || false;
    isShowingDefaultTransactions.value = cached.isShowingDefaultTransactions ?? true;
    isShowingDefaultPayouts.value = cached.isShowingDefaultPayouts ?? true;
    isShowingDefaultDisputes.value = cached.isShowingDefaultDisputes ?? true;
    graphqlWarning.value = cached.graphqlWarning || null;
    clearTransientState();
  }

  function $reset() {
    storeScopeVersion += 1;
    payoutDetailRequests.clear();
    resetState();
  }

  function resetState() {
    balance.value = null;
    payouts.value = [];
    visiblePayouts.value = [];
    payoutDetails.value = {};
    paymentsAccount.value = null;
    payoutMetadata.value = {};
    transactionsByPayout.value = {};
    loadedPayoutDetails.value = {};
    payoutDetailPageInfo.value = {};
    balanceTransactions.value = [];
    visibleBalanceTransactions.value = [];
    disputes.value = [];
    visibleDisputes.value = [];
    transactionPageInfo.value = emptyConnectionPage();
    payoutPageInfo.value = emptyConnectionPage();
    disputePageInfo.value = emptyConnectionPage();
    defaultTransactionPageInfo.value = emptyConnectionPage();
    defaultPayoutPageInfo.value = emptyConnectionPage();
    defaultDisputePageInfo.value = emptyConnectionPage();
    hasFetchedAccount.value = false;
    hasFetchedPayouts.value = false;
    hasFetchedBalanceTransactions.value = false;
    hasFetchedDisputes.value = false;
    isShowingDefaultTransactions.value = true;
    isShowingDefaultPayouts.value = true;
    isShowingDefaultDisputes.value = true;
    graphqlWarning.value = null;
    clearTransientState();
  }

  function clearTransientState() {
    error.value = null;
    isLoadingAccount.value = false;
    isLoadingPayouts.value = false;
    isLoadingTransactions.value = false;
    isLoadingDisputes.value = false;
    isLoadingPayoutDetail.value = false;
  }

  function hasActiveFilters(filters: object) {
    return Object.values(filters).some(
      (value) => value !== undefined && value !== null && value !== "",
    );
  }

  function groupByPayout(items: Transaction[]) {
    const grouped: Record<string, Transaction[]> = {};
    for (const transaction of items) {
      if (transaction.payout_id === null) continue;
      (grouped[String(transaction.payout_id)] ||= []).push(transaction);
    }
    return grouped;
  }

  function applyPaymentsAccountResponse(response: ShopifyPaymentsAccountResponse) {
    paymentsAccount.value = response.account;
    balance.value = response.account
      ? response.account.balance.map((money) => ({
          amount: money.amount,
          currency: money.currencyCode,
        }))
      : null;
  }

  function mergeById<T extends { id: string | number }>(current: T[], next: T[]) {
    const items = new Map(current.map((item) => [String(item.id), item]));
    for (const item of next) items.set(String(item.id), item);
    return [...items.values()];
  }

  function upsertById<T extends { id: string | number }>(items: T[], item: T) {
    const index = items.findIndex((current) => String(current.id) === String(item.id));
    if (index < 0) return [item, ...items];
    const updated = [...items];
    updated[index] = item;
    return updated;
  }

  return {
    balance,
    payouts,
    visiblePayouts,
    payoutDetails,
    paymentsAccount,
    payoutMetadata,
    transactionsByPayout,
    payoutDetailPageInfo,
    balanceTransactions,
    visibleBalanceTransactions,
    disputes,
    visibleDisputes,
    transactionPageInfo,
    payoutPageInfo,
    disputePageInfo,
    hasFetchedAccount,
    hasFetchedPayouts,
    hasFetchedBalanceTransactions,
    hasFetchedDisputes,
    isShowingDefaultTransactions,
    isShowingDefaultPayouts,
    isShowingDefaultDisputes,
    isLoading,
    isLoadingAccount,
    isLoadingPayouts,
    isLoadingTransactions,
    isLoadingDisputes,
    isLoadingPayoutDetail,
    error,
    graphqlWarning,
    isStoreActive: storeCache.isActive,
    fetchPayouts,
    fetchMorePayouts,
    fetchBalanceTransactions,
    fetchGraphqlBalanceTransactions,
    fetchMoreBalanceTransactions,
    fetchPaymentsAccount,
    fetchDisputes,
    fetchMoreDisputes,
    fetchPayoutDetail,
    fetchMorePayoutTransactions,
    getTransactionsForPayout,
    showDefaultBalanceTransactions,
    showDefaultPayouts,
    showDefaultDisputes,
    hydrate,
    evictStore,
    $reset,
  };
});
