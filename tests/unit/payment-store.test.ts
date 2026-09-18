import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePaymentStore } from "~/stores/payment";
import type { PayoutDetailResponse, ShopifyPayout } from "~~/types/shopify";

const payout: ShopifyPayout = {
  id: "123",
  status: "paid",
  date: "2026-09-17",
  currency: "USD",
  amount: "42.00",
  summary: {
    adjustments_fee_amount: "0",
    adjustments_gross_amount: "0",
    charges_fee_amount: "0",
    charges_gross_amount: "42.00",
    refunds_fee_amount: "0",
    refunds_gross_amount: "0",
    reserved_funds_fee_amount: "0",
    reserved_funds_gross_amount: "0",
    retried_payouts_fee_amount: "0",
    retried_payouts_gross_amount: "0",
  },
};

const noMorePages = {
  nextCursor: null,
  previousCursor: null,
  hasNextPage: false,
  hasPreviousPage: false,
};

function payoutDetailResponse(
  payoutValue: ShopifyPayout = payout,
): PayoutDetailResponse {
  return {
    payout: payoutValue,
    metadata: null,
    transactions: [],
    pageInfo: noMorePages,
  };
}

describe("payment store payout details", () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.unstubAllGlobals());

  it("deduplicates concurrent detail requests and caches an empty transaction list", async () => {
    let resolveRequest!: (response: PayoutDetailResponse) => void;
    const response = new Promise<PayoutDetailResponse>((resolve) => {
      resolveRequest = resolve;
    });
    const request = vi.fn().mockReturnValue(response);
    vi.stubGlobal("$fetch", request);
    const store = usePaymentStore();

    const first = store.fetchPayoutDetail("shop-a", "token", "123");
    const duplicate = store.fetchPayoutDetail("shop-a", "token", "123");

    expect(request).toHaveBeenCalledTimes(1);
    expect(store.isLoading).toBe(true);

    resolveRequest(payoutDetailResponse());
    await Promise.all([first, duplicate]);

    expect(store.isLoading).toBe(false);
    expect(store.payoutDetails["123"]).toEqual(payout);
    expect(store.transactionsByPayout["123"]).toEqual([]);
    expect(store.payoutDetailStates["123"]?.status).toBe("success");

    await store.fetchPayoutDetail("shop-a", "token", "123");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("loads transaction pages independently and forwards the GraphQL cursor", async () => {
    const transaction = {
      id: "1",
      type: "charge",
      test: false,
      payout_id: null,
      payout_status: "pending",
      currency: "USD",
      amount: "10.00",
      fee: "1.00",
      net: "9.00",
      source_id: null,
      source_type: null,
      source_order_id: null,
      source_order_transaction_id: null,
      processed_at: "2026-09-17T00:00:00Z",
      adjustment_order_transactions: [],
      adjustment_reason: null,
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        transactions: [transaction],
        pageInfo: { hasNextPage: true, endCursor: "graphql-cursor" },
      })
      .mockResolvedValueOnce({
        transactions: [{ ...transaction, id: "2" }],
        pageInfo: { hasNextPage: false, endCursor: null },
      });
    vi.stubGlobal("$fetch", request);
    const store = usePaymentStore();

    await store.fetchGraphqlBalanceTransactions("shop-a", "token");
    await store.fetchMoreBalanceTransactions("shop-a", "token");

    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[0]).toBe(
      "/api/payment/graphql-balance-transactions",
    );
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      body: { pagination: { first: 100, after: "graphql-cursor" } },
    });
    expect(store.visibleBalanceTransactions.map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("restores an empty payout cache for the correct shop", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(payoutDetailResponse())
      .mockResolvedValueOnce(payoutDetailResponse({ ...payout, amount: "84.00" }));
    vi.stubGlobal("$fetch", request);
    const store = usePaymentStore();

    await store.fetchPayoutDetail("shop-a", "token-a", "123");
    await store.fetchPayoutDetail("shop-b", "token-b", "123");
    expect(store.payoutDetails["123"]?.amount).toBe("84.00");

    await store.fetchPayoutDetail("shop-a", "token-a", "123");
    expect(request).toHaveBeenCalledTimes(2);
    expect(store.payoutDetails["123"]?.amount).toBe("42.00");
    expect(store.transactionsByPayout["123"]).toEqual([]);
    expect(store.payoutDetailStates["123"]?.status).toBe("success");
  });

  it("retries a failed request instead of caching it as an empty success", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce({ statusCode: 502 })
      .mockResolvedValueOnce(payoutDetailResponse());
    vi.stubGlobal("$fetch", request);
    const store = usePaymentStore();

    await store.fetchPayoutDetail("shop-a", "token", "123");
    expect(store.payoutDetailStates["123"]?.status).toBe("error");
    await store.fetchPayoutDetail("shop-a", "token", "123");
    await store.fetchPayoutDetail("shop-a", "token", "123");
    expect(request).toHaveBeenCalledTimes(2);
    expect(store.payoutDetailStates["123"]?.status).toBe("success");
  });

  it("restores the cached default transaction page after a filtered view", async () => {
    const transaction = {
      id: "1",
      type: "charge",
      test: false,
      payout_id: null,
      payout_status: "pending",
      currency: "USD",
      amount: "10.00",
      fee: "1.00",
      net: "9.00",
      source_id: null,
      source_type: null,
      source_order_id: null,
      source_order_transaction_id: null,
      processed_at: "2026-09-17T00:00:00Z",
      adjustment_order_transactions: [],
      adjustment_reason: null,
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        transactions: [transaction],
        pageInfo: { hasNextPage: false, endCursor: null },
      })
      .mockResolvedValueOnce({
        transactions: [{ ...transaction, id: "2", test: true }],
        pageInfo: { hasNextPage: false, endCursor: null },
      });
    vi.stubGlobal("$fetch", request);
    const store = usePaymentStore();

    await store.fetchGraphqlBalanceTransactions("shop-a", "token");
    await store.fetchGraphqlBalanceTransactions(
      "shop-a",
      "token",
      { test: true },
      { force: true },
    );
    expect(store.visibleBalanceTransactions[0]?.id).toBe("2");

    await store.fetchGraphqlBalanceTransactions("shop-a", "token");

    expect(request).toHaveBeenCalledTimes(2);
    expect(store.visibleBalanceTransactions[0]?.id).toBe("1");
    expect(store.isShowingDefaultTransactions).toBe(true);
  });

  it("loads account and payouts as separate resources", async () => {
    const request = vi.fn(async (url: string) => {
      if (url === "/api/payment/account") return { account: null };
      if (url === "/api/payment/payout/all") {
        return {
          payouts: [payout],
          metadata: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("$fetch", request);
    const store = usePaymentStore();

    await store.fetchPayouts("shop-a", "token");

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("/api/payment/payout/all", expect.any(Object));
    expect(store.hasFetchedPayouts).toBe(true);
    expect(store.hasFetchedAccount).toBe(false);

    await store.fetchPaymentsAccount("shop-a", "token");
    expect(request).toHaveBeenCalledTimes(2);
    expect(store.hasFetchedAccount).toBe(true);
  });

  it("deduplicates forced refreshes while allowing a later refresh", async () => {
    const request = vi.fn().mockResolvedValue(payoutDetailResponse());
    vi.stubGlobal("$fetch", request);
    const store = usePaymentStore();

    await Promise.all([
      store.fetchPayoutDetail("shop-a", "token", "123", true),
      store.fetchPayoutDetail("shop-a", "token", "123", true),
    ]);
    expect(request).toHaveBeenCalledTimes(1);

    await store.fetchPayoutDetail("shop-a", "token", "123", true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [404, "not-found"],
    [500, "error"],
  ] as const)(
    "maps a %s detail response to the %s state",
    async (statusCode, expectedStatus) => {
      vi.stubGlobal(
        "$fetch",
        vi.fn().mockRejectedValue({
          data: {
            statusCode,
            statusMessage: `Request failed (${statusCode})`,
          },
        }),
      );
      const store = usePaymentStore();

      await store.fetchPayoutDetail("shop-a", "token", "123");

      expect(store.payoutDetailStates["123"]?.status).toBe(expectedStatus);
      expect(store.payoutDetails["123"]).toBeUndefined();
      expect(store.error).toBeNull();
    },
  );

  it("reports missing credentials as unauthorized without making a request", async () => {
    const request = vi.fn();
    vi.stubGlobal("$fetch", request);
    const store = usePaymentStore();

    await store.fetchPayoutDetail("shop-a", "", "123");

    expect(request).not.toHaveBeenCalled();
    expect(store.payoutDetailStates["123"]).toMatchObject({
      status: "unauthorized",
      detailError: null,
    });
  });

  it("keeps a partial payout visible and records section-specific failures", async () => {
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockResolvedValue({
        ...payoutDetailResponse(),
        issues: {
          metadata: { message: "Metadata request failed.", statusCode: 403 },
          transactions: {
            message: "Transaction request timed out.",
            statusCode: 504,
          },
        },
      }),
    );
    const store = usePaymentStore();

    await store.fetchPayoutDetail("shop-a", "token", "123");

    expect(store.payoutDetails["123"]).toEqual(payout);
    expect(store.payoutDetailStates["123"]).toEqual({
      status: "partial",
      detailError: null,
      metadataError: "Metadata request failed.",
      transactionsError: "Transaction request timed out.",
    });
    expect(store.transactionsByPayout["123"]).toBeUndefined();
  });

  it("does not reuse or apply an in-flight request after the store is reset", async () => {
    let resolveStaleRequest!: (response: PayoutDetailResponse) => void;
    const staleResponse = new Promise<PayoutDetailResponse>((resolve) => {
      resolveStaleRequest = resolve;
    });
    const refreshedPayout = { ...payout, amount: "84.00" };
    const request = vi
      .fn()
      .mockReturnValueOnce(staleResponse)
      .mockResolvedValueOnce(payoutDetailResponse(refreshedPayout));
    vi.stubGlobal("$fetch", request);
    const store = usePaymentStore();

    const staleRequest = store.fetchPayoutDetail("shop-a", "token", "123");
    store.$reset();
    await store.fetchPayoutDetail("shop-a", "token", "123");

    expect(request).toHaveBeenCalledTimes(2);
    expect(store.payoutDetails["123"]?.amount).toBe("84.00");

    resolveStaleRequest(payoutDetailResponse());
    await staleRequest;
    expect(store.payoutDetails["123"]?.amount).toBe("84.00");
  });

  it("loads one payout transaction page at a time and appends the next page", async () => {
    const firstTransaction = {
      id: "1",
      type: "charge",
      test: false,
      payout_id: "123",
      payout_status: "paid",
      currency: "USD",
      amount: "10.00",
      fee: "1.00",
      net: "9.00",
      source_id: null,
      source_type: null,
      source_order_id: null,
      source_order_transaction_id: null,
      processed_at: "2026-09-17T00:00:00Z",
      adjustment_order_transactions: [],
      adjustment_reason: null,
    } as const;
    const secondTransaction = { ...firstTransaction, id: "2" };
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        ...payoutDetailResponse(),
        transactions: [firstTransaction],
        pageInfo: {
          ...noMorePages,
          nextCursor: "next-page",
          hasNextPage: true,
        },
      })
      .mockResolvedValueOnce({
        transactions: [secondTransaction],
        pageInfo: noMorePages,
      });
    vi.stubGlobal("$fetch", request);
    const store = usePaymentStore();

    await store.fetchPayoutDetail("shop-a", "token", "123");
    await store.fetchMorePayoutTransactions("shop-a", "token", "123");

    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      params: { storeId: "shop-a", cursor: "next-page" },
    });
    expect(store.transactionsByPayout["123"]?.map((item) => item.id)).toEqual([
      "1",
      "2",
    ]);
    expect(store.payoutDetailPageInfo["123"]?.hasNextPage).toBe(false);
  });

  it("preserves loaded transactions when a later page fails", async () => {
    const firstTransaction = {
      id: "1",
      type: "charge",
      test: false,
      payout_id: "123",
      payout_status: "paid",
      currency: "USD",
      amount: "10.00",
      fee: "1.00",
      net: "9.00",
      source_id: null,
      source_type: null,
      source_order_id: null,
      source_order_transaction_id: null,
      processed_at: "2026-09-17T00:00:00Z",
      adjustment_order_transactions: [],
      adjustment_reason: null,
    } as const;
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        ...payoutDetailResponse(),
        transactions: [firstTransaction],
        pageInfo: {
          ...noMorePages,
          nextCursor: "next-page",
          hasNextPage: true,
        },
      })
      .mockRejectedValueOnce(new Error("Shopify timed out."));
    vi.stubGlobal("$fetch", request);
    const store = usePaymentStore();

    await store.fetchPayoutDetail("shop-a", "token", "123");
    await store.fetchMorePayoutTransactions("shop-a", "token", "123");

    expect(store.transactionsByPayout["123"]?.map((item) => item.id)).toEqual(["1"]);
    expect(store.payoutDetailPageInfo["123"]?.nextCursor).toBe("next-page");
    expect(store.payoutDetailStates["123"]?.status).toBe("partial");
    expect(store.payoutDetailStates["123"]?.transactionsError).toBe(
      "Shopify timed out.",
    );
  });

  it("retries only the first transaction page after a partial response", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        ...payoutDetailResponse(),
        issues: {
          transactions: { message: "Transactions failed.", statusCode: 502 },
        },
      })
      .mockResolvedValueOnce({ transactions: [], pageInfo: noMorePages });
    vi.stubGlobal("$fetch", request);
    const store = usePaymentStore();

    await store.fetchPayoutDetail("shop-a", "token", "123");
    await store.retryPayoutTransactions("shop-a", "token", "123");

    expect(request.mock.calls[1]?.[0]).toBe("/api/payment/payout/123/transactions");
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      params: { storeId: "shop-a" },
    });
    expect(store.payoutDetailStates["123"]?.status).toBe("success");
    expect(store.payoutDetailStates["123"]?.transactionsError).toBeNull();
  });
});
