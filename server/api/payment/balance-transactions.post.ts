import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import { normalizeShopifyBalanceTransaction } from "~~/server/utils/shopify-payment-normalization";
import { buildBalanceTransactionQueryParams } from "~~/server/utils/shopify-payment-query";
import type { BalanceTransactionsResponse } from "~~/types/shopify";
import type { ShopifyBalanceTransactionFilters } from "~~/types/shopify-payment";

interface BalanceTransactionsBody {
  storeId?: string;
  token?: string;
  filters?: ShopifyBalanceTransactionFilters;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<BalanceTransactionsBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  const transactions = await callShopifyPaginatedApi<
    BalanceTransactionsResponse["transactions"][number]
  >({
    event,
    storeId,
    token,
    path: "/shopify_payments/balance/transactions.json",
    resourceKey: "transactions",
    params: buildBalanceTransactionQueryParams(body.filters),
    mapItem: normalizeShopifyBalanceTransaction,
    missingProxyMessage: "Missing sock proxy for this store.",
    preserveUnsafeIntegers: true,
  });

  return {
    transactions,
  } satisfies BalanceTransactionsResponse;
});
