import { defineEventHandler } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { normalizeShopifyBalanceTransaction } from "~~/server/utils/shopify-payment-normalization";
import type {
  PayoutDetailResponse,
  ShopifyPayout,
  ShopifyBalanceTransaction,
} from "~~/types/shopify";

interface PayoutResponse {
  payout?: ShopifyPayout;
}

export default defineEventHandler(async (event) => {
  const payoutId = requireShopifyResourceId(event.context.params?.id, "Payout");
  const { storeId, token } = getShopifyQueryCredentials(event);

  const [payoutRes, transactions] = await Promise.all([
    callShopifyApi<PayoutResponse>({
      event,
      storeId,
      token,
      path: `/shopify_payments/payouts/${payoutId}.json`,
      preserveUnsafeIntegers: true,
    }),
    callShopifyPaginatedApi<ShopifyBalanceTransaction>({
      event,
      storeId,
      token,
      path: "/shopify_payments/balance/transactions.json",
      resourceKey: "transactions",
      params: { payout_id: payoutId },
      mapItem: normalizeShopifyBalanceTransaction,
      preserveUnsafeIntegers: true,
    }),
  ]);

  return {
    payout: payoutRes.payout ? { ...payoutRes.payout, id: payoutId } : null,
    transactions,
  } satisfies PayoutDetailResponse;
});
