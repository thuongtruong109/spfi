import { defineStore } from "pinia";
import { ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import type {
  PaymentsOverviewResponse,
  PayoutDetailResponse,
  ShopifyBalance,
  ShopifyBalanceTransaction,
  ShopifyPayout,
} from "~~/types/shopify";
import type {
  ShopifyBalanceTransactionFilters,
  ShopifyPayoutFilters,
} from "~~/types/shopify-payment";
import type {
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

interface PaymentStoreCache {
  balance: Balance | Balance[] | null;
  payouts: Payout[];
  visiblePayouts: Payout[];
  payoutDetails: Record<string, Payout>;
  paymentsAccount: ShopifyPaymentsAccount | null;
  payoutMetadata: Record<string, ShopifyPaymentsPayoutMetadata>;
  transactionsByPayout: Record<string, Transaction[]>;
  loadedPayoutDetails: Record<string, boolean>;
  balanceTransactions: Transaction[];
  visibleBalanceTransactions: Transaction[];
  disputes: ShopifyPaymentsDispute[];
  visibleDisputes: ShopifyPaymentsDispute[];
  hasFetchedAll: boolean;
  hasFetchedBalanceTransactions: boolean;
  hasFetchedDisputes: boolean;
  graphqlWarning: string | null;
}

export const usePaymentStore = defineStore("payment", () => {
  const balance = ref<Balance | Balance[] | null>(null);
  const payouts = ref<Payout[]>([]);
  const visiblePayouts = ref<Payout[]>([]);
  const payoutDetails = ref<Record<string, Payout>>({});
  const paymentsAccount = ref<ShopifyPaymentsAccount | null>(null);
  const payoutMetadata = ref<Record<string, ShopifyPaymentsPayoutMetadata>>({});
  const transactionsByPayout = ref<Record<string, Transaction[]>>({});
  const loadedPayoutDetails = ref<Record<string, boolean>>({});

  const balanceTransactions = ref<Transaction[]>([]);
  const visibleBalanceTransactions = ref<Transaction[]>([]);
  const disputes = ref<ShopifyPaymentsDispute[]>([]);
  const visibleDisputes = ref<ShopifyPaymentsDispute[]>([]);
  const hasFetchedAll = ref(false);
  const hasFetchedBalanceTransactions = ref(false);
  const hasFetchedDisputes = ref(false);

  const isLoading = ref(false);
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
      balanceTransactions: [...balanceTransactions.value],
      visibleBalanceTransactions: [...visibleBalanceTransactions.value],
      disputes: [...disputes.value],
      visibleDisputes: [...visibleDisputes.value],
      hasFetchedAll: hasFetchedAll.value,
      hasFetchedBalanceTransactions: hasFetchedBalanceTransactions.value,
      hasFetchedDisputes: hasFetchedDisputes.value,
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

  async function fetchAll(storeId: string, token: string, force = false) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    activateStore(storeId);
    const requestScope = storeScopeVersion;
    if (!force && hasFetchedAll.value) return;

    isLoading.value = true;
    error.value = null;
    graphqlWarning.value = null;

    try {
      const [overviewResult, accountResult, graphqlTransactionsResult] =
        await Promise.allSettled([
          $fetch<PaymentsOverviewResponse>("/api/payment/all", {
            method: "POST",
            body: { storeId, token },
          }),
          $fetch<ShopifyPaymentsAccountResponse>("/api/payment/account", {
            method: "POST",
            body: { storeId, token },
          }),
          $fetch<ShopifyPaymentsGraphqlTransactionsResponse>(
            "/api/payment/graphql-balance-transactions",
            {
              method: "POST",
              body: { storeId, token, filters: {} },
            },
          ),
        ]);

      if (!isActiveRequest(storeId, requestScope)) return;

      if (overviewResult.status === "rejected") throw overviewResult.reason;
      const response = overviewResult.value;

      const overview = response.data;
      payouts.value = overview.payouts;
      visiblePayouts.value = [...payouts.value];
      const restTransactions = overview.balanceTransactions.filter(
        (transaction) => transaction.type !== "payout",
      );

      if (accountResult.status === "fulfilled") {
        applyPaymentsAccountResponse(accountResult.value);
      } else {
        balance.value = overview.balance;
      }

      const preferredTransactions =
        graphqlTransactionsResult.status === "fulfilled"
          ? graphqlTransactionsResult.value.transactions
          : restTransactions;
      balanceTransactions.value = preferredTransactions.filter(
        (transaction) => transaction.type !== "payout",
      );
      visibleBalanceTransactions.value = [...balanceTransactions.value];
      transactionsByPayout.value = groupByPayout(
        graphqlTransactionsResult.status === "fulfilled"
          ? graphqlTransactionsResult.value.transactions
          : overview.balanceTransactions,
      );
      loadedPayoutDetails.value = {};

      const warnings: string[] = [];
      if (accountResult.status === "rejected") {
        warnings.push(
          getAppErrorMessage(
            accountResult.reason,
            "Shopify Payments account details are unavailable.",
          ),
        );
      }
      if (graphqlTransactionsResult.status === "rejected") {
        warnings.push(
          getAppErrorMessage(
            graphqlTransactionsResult.reason,
            "GraphQL transaction enrichment is unavailable; showing REST data.",
          ),
        );
      }
      graphqlWarning.value = warnings.length ? warnings.join(" ") : null;

      hasFetchedAll.value = true;
      hasFetchedBalanceTransactions.value = true;
      rememberStore(storeId);
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(err, "Failed to fetch payment data.");
      }
    } finally {
      if (isActiveRequest(storeId, requestScope)) isLoading.value = false;
    }
  }

  function isActiveRequest(storeId: string, requestScope: number) {
    return storeCache.isActive(storeId) && storeScopeVersion === requestScope;
  }

  async function fetchPaymentsAccount(storeId: string, token: string, force = false) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }
    activateStore(storeId);
    const requestScope = storeScopeVersion;
    if (!force && paymentsAccount.value) return;

    try {
      const response = await $fetch<ShopifyPaymentsAccountResponse>(
        "/api/payment/account",
        {
          method: "POST",
          body: { storeId, token },
        },
      );
      if (!isActiveRequest(storeId, requestScope)) return;
      applyPaymentsAccountResponse(response);
      graphqlWarning.value = null;
      rememberStore(storeId);
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        graphqlWarning.value = getAppErrorMessage(
          err,
          "Shopify Payments account details are unavailable.",
        );
      }
    }
  }

  async function fetchGraphqlBalanceTransactions(
    storeId: string,
    token: string,
    filters: ShopifyPaymentsBalanceTransactionSearchFilters = {},
  ) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    activateStore(storeId);
    const requestScope = storeScopeVersion;
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<ShopifyPaymentsGraphqlTransactionsResponse>(
        "/api/payment/graphql-balance-transactions",
        {
          method: "POST",
          body: { storeId, token, filters },
        },
      );
      if (!isActiveRequest(storeId, requestScope)) return;
      visibleBalanceTransactions.value = response.transactions || [];
      if (!hasActiveFilters(filters)) {
        balanceTransactions.value = [...visibleBalanceTransactions.value];
        transactionsByPayout.value = groupByPayout(visibleBalanceTransactions.value);
        loadedPayoutDetails.value = {};
      }
      hasFetchedBalanceTransactions.value = true;
      graphqlWarning.value = null;
      rememberStore(storeId);
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(
          err,
          "Failed to load Shopify Payments transactions.",
        );
      }
    } finally {
      if (isActiveRequest(storeId, requestScope)) isLoading.value = false;
    }
  }

  async function fetchDisputes(
    storeId: string,
    token: string,
    filters: ShopifyPaymentsDisputeFilters = {},
  ) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    activateStore(storeId);
    const requestScope = storeScopeVersion;
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<ShopifyPaymentsDisputesResponse>(
        "/api/payment/dispute/all",
        {
          method: "POST",
          body: { storeId, token, filters },
        },
      );
      if (!isActiveRequest(storeId, requestScope)) return;
      visibleDisputes.value = response.disputes || [];
      if (!hasActiveFilters(filters)) {
        disputes.value = [...visibleDisputes.value];
      }
      hasFetchedDisputes.value = true;
      rememberStore(storeId);
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(
          err,
          "Failed to load Shopify Payments disputes.",
        );
      }
    } finally {
      if (isActiveRequest(storeId, requestScope)) isLoading.value = false;
    }
  }

  async function fetchBalanceTransactions(
    storeId: string,
    token: string,
    force = false,
    filters: ShopifyBalanceTransactionFilters = {},
  ) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    activateStore(storeId);
    const requestScope = storeScopeVersion;
    if (!force && hasFetchedBalanceTransactions.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const res = await $fetch<{ transactions?: Transaction[] }>(
        "/api/payment/balance-transactions",
        {
          method: "POST",
          body: { storeId, token, filters },
        },
      );
      if (!isActiveRequest(storeId, requestScope)) return;
      const transactions = (res.transactions || []).filter(
        (transaction) => transaction.type !== "payout",
      );
      visibleBalanceTransactions.value = transactions;
      if (!hasActiveFilters(filters)) {
        balanceTransactions.value = transactions;
        transactionsByPayout.value = groupByPayout(res.transactions || []);
        loadedPayoutDetails.value = {};
      }
      hasFetchedBalanceTransactions.value = true;
      rememberStore(storeId);
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(err, "Failed to load transactions");
      }
    } finally {
      if (isActiveRequest(storeId, requestScope)) isLoading.value = false;
    }
  }

  async function fetchPayouts(
    storeId: string,
    token: string,
    filters: ShopifyPayoutFilters = {},
  ) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    activateStore(storeId);
    const requestScope = storeScopeVersion;
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ payouts?: Payout[] }>("/api/payment/payout/all", {
        method: "POST",
        body: { storeId, token, filters },
      });
      if (!isActiveRequest(storeId, requestScope)) return;
      visiblePayouts.value = response.payouts || [];
      if (!hasActiveFilters(filters)) {
        payouts.value = [...visiblePayouts.value];
      }
      rememberStore(storeId);
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(err, "Failed to load payouts.");
      }
    } finally {
      if (isActiveRequest(storeId, requestScope)) isLoading.value = false;
    }
  }

  function getTransactionsForPayout(payoutId: string | number): Transaction[] {
    return transactionsByPayout.value[String(payoutId)] ?? [];
  }

  async function fetchPayoutDetail(
    storeId: string,
    token: string,
    payoutId: string | number,
    force = false,
  ) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    activateStore(storeId);
    const requestScope = storeScopeVersion;
    const normalizedPayoutId = String(payoutId);
    const requestKey = `${storeId}:${normalizedPayoutId}`;
    const pendingRequest = payoutDetailRequests.get(requestKey);
    if (pendingRequest) return pendingRequest;
    if (!force && loadedPayoutDetails.value[normalizedPayoutId]) return;

    isLoading.value = true;
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

        if (response.payout) {
          payoutDetails.value[normalizedPayoutId] = response.payout;

          const listIndex = payouts.value.findIndex(
            (payout) => String(payout.id) === normalizedPayoutId,
          );
          if (listIndex > -1) {
            payouts.value[listIndex] = response.payout;
          } else {
            payouts.value = [response.payout, ...payouts.value];
          }
        }

        const enrichedById = new Map(
          balanceTransactions.value.map((transaction) => [
            String(transaction.id),
            transaction,
          ]),
        );
        transactionsByPayout.value[normalizedPayoutId] = (
          response.transactions ?? []
        ).map((transaction) => {
          const enriched = enrichedById.get(String(transaction.id));
          return enriched
            ? {
                ...transaction,
                source_order_name:
                  enriched.source_order_name || transaction.source_order_name,
              }
            : transaction;
        });
        loadedPayoutDetails.value[normalizedPayoutId] = true;

        rememberStore(storeId);
      } catch (err) {
        if (isActiveRequest(storeId, requestScope)) {
          error.value = getAppErrorMessage(err, "Failed to fetch payout detail.");
        }
      } finally {
        if (isActiveRequest(storeId, requestScope)) isLoading.value = false;
      }
    })();

    payoutDetailRequests.set(requestKey, request);
    try {
      await request;
    } finally {
      if (payoutDetailRequests.get(requestKey) === request) {
        payoutDetailRequests.delete(requestKey);
      }
    }
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
    balanceTransactions.value = [...cached.balanceTransactions];
    visibleBalanceTransactions.value = [
      ...(cached.visibleBalanceTransactions || cached.balanceTransactions),
    ];
    disputes.value = [...(cached.disputes || [])];
    visibleDisputes.value = [...(cached.visibleDisputes || cached.disputes || [])];
    hasFetchedAll.value = cached.hasFetchedAll;
    hasFetchedBalanceTransactions.value = cached.hasFetchedBalanceTransactions;
    hasFetchedDisputes.value = cached.hasFetchedDisputes || false;
    graphqlWarning.value = cached.graphqlWarning || null;
    error.value = null;
    isLoading.value = false;
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
    balanceTransactions.value = [];
    visibleBalanceTransactions.value = [];
    disputes.value = [];
    visibleDisputes.value = [];
    hasFetchedAll.value = false;
    hasFetchedBalanceTransactions.value = false;
    hasFetchedDisputes.value = false;
    error.value = null;
    graphqlWarning.value = null;
    isLoading.value = false;
  }

  function hasActiveFilters(filters: object) {
    return Object.values(filters).some(
      (value) => value !== undefined && value !== null && value !== "",
    );
  }

  function groupByPayout(transactions: Transaction[]) {
    const grouped: Record<string, Transaction[]> = {};
    for (const transaction of transactions) {
      if (transaction.payout_id === null) continue;
      (grouped[String(transaction.payout_id)] ||= []).push(transaction);
    }
    return grouped;
  }

  function applyPaymentsAccountResponse(response: ShopifyPaymentsAccountResponse) {
    paymentsAccount.value = response.account;
    payoutMetadata.value = Object.fromEntries(
      (response.payouts || []).map((payout) => [
        String(payout.legacyResourceId),
        payout,
      ]),
    );
    if (response.account?.balance.length) {
      balance.value = response.account.balance.map((money) => ({
        amount: money.amount,
        currency: money.currencyCode,
      }));
    }
  }

  return {
    balance,
    payouts,
    visiblePayouts,
    payoutDetails,
    paymentsAccount,
    payoutMetadata,
    transactionsByPayout,
    balanceTransactions,
    visibleBalanceTransactions,
    disputes,
    visibleDisputes,
    hasFetchedAll,
    hasFetchedBalanceTransactions,
    hasFetchedDisputes,
    isLoading,
    error,
    graphqlWarning,
    isStoreActive: storeCache.isActive,
    fetchAll,
    fetchPayouts,
    fetchBalanceTransactions,
    fetchGraphqlBalanceTransactions,
    fetchPaymentsAccount,
    fetchDisputes,
    fetchPayoutDetail,
    getTransactionsForPayout,
    hydrate,
    evictStore,
    $reset,
  };
});
