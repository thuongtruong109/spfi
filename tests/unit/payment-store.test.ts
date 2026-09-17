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

    resolveRequest({ payout, transactions: [] });
    await Promise.all([first, duplicate]);

    expect(store.isLoading).toBe(false);
    expect(store.payoutDetails["123"]).toEqual(payout);
    expect(store.transactionsByPayout["123"]).toEqual([]);

    await store.fetchPayoutDetail("shop-a", "token", "123");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("deduplicates forced refreshes while allowing a later refresh", async () => {
    const request = vi.fn().mockResolvedValue({ payout, transactions: [] });
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

  it("does not reuse or apply an in-flight request after the store is reset", async () => {
    let resolveStaleRequest!: (response: PayoutDetailResponse) => void;
    const staleResponse = new Promise<PayoutDetailResponse>((resolve) => {
      resolveStaleRequest = resolve;
    });
    const refreshedPayout = { ...payout, amount: "84.00" };
    const request = vi
      .fn()
      .mockReturnValueOnce(staleResponse)
      .mockResolvedValueOnce({ payout: refreshedPayout, transactions: [] });
    vi.stubGlobal("$fetch", request);
    const store = usePaymentStore();

    const staleRequest = store.fetchPayoutDetail("shop-a", "token", "123");
    store.$reset();
    await store.fetchPayoutDetail("shop-a", "token", "123");

    expect(request).toHaveBeenCalledTimes(2);
    expect(store.payoutDetails["123"]?.amount).toBe("84.00");

    resolveStaleRequest({ payout, transactions: [] });
    await staleRequest;
    expect(store.payoutDetails["123"]?.amount).toBe("84.00");
  });
});
