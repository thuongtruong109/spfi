import type { H3Event } from "h3";
import { callShopifyApi, createApiErrorFromMessage } from "./callShopifyApi";
import { callShopifyPaginatedApiPage } from "./callShopifyPaginatedApi";
import { normalizeShopifyBalanceTransaction } from "./shopify-payment-normalization";
import type { ShopifyBalanceTransaction, ShopifyPayout } from "~~/types/shopify";

export const PAYOUT_TRANSACTION_PAGE_SIZE = 100;

export function normalizePayoutTransactionCursor(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string" || raw.length > 8192) {
    throw createApiErrorFromMessage("Invalid payout transaction cursor.", 400);
  }
  return raw;
}

interface PayoutTransactionPageOptions {
  event: H3Event;
  storeId: string;
  token: string;
  payoutId: string;
  cursor?: string | null;
}

export function fetchPayoutTransactionPage({
  event,
  storeId,
  token,
  payoutId,
  cursor = null,
}: PayoutTransactionPageOptions) {
  return callShopifyPaginatedApiPage<ShopifyBalanceTransaction>({
    event,
    storeId,
    token,
    path: "/shopify_payments/balance/transactions.json",
    resourceKey: "transactions",
    params: { payout_id: payoutId },
    cursor,
    pageSize: PAYOUT_TRANSACTION_PAGE_SIZE,
    mapItem: normalizeShopifyBalanceTransaction,
    preserveUnsafeIntegers: true,
    forwardResponseHeaders: false,
  });
}

interface ShopifyPayoutResponse {
  payout?: ShopifyPayout;
}

export async function fetchShopifyPayoutById({
  event,
  storeId,
  token,
  payoutId,
}: Omit<PayoutTransactionPageOptions, "cursor">) {
  const response = await callShopifyApi<ShopifyPayoutResponse>({
    event,
    storeId,
    token,
    path: `/shopify_payments/payouts/${payoutId}.json`,
    preserveUnsafeIntegers: true,
    forwardResponseHeaders: false,
  });

  if (!response.payout) {
    throw createApiErrorFromMessage(
      "Shopify returned an invalid payout response.",
      502,
    );
  }

  return response.payout;
}
