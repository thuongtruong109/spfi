import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import { createApiSuccessResponse } from "~~/server/utils/api-response";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { normalizeShopifyBalanceTransaction } from "~~/server/utils/shopify-payment-normalization";
import { groupTransactionsByPayout } from "~~/server/utils/shopify-payment-query";
import type {
  PaymentsOverviewResponse,
  ShopifyBalance,
  ShopifyBalanceTransaction,
  ShopifyPayout,
} from "~~/types/shopify";

interface PaymentAllBody {
  storeId?: string;
  token?: string;
}

interface BalanceResponse {
  balance?: ShopifyBalance | ShopifyBalance[];
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<PaymentAllBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);

  const [balanceRes, payouts, balanceTransactions] = await Promise.all([
    callShopifyApi<BalanceResponse>({
      event,
      storeId,
      token,
      path: "/shopify_payments/balance.json",
    }),
    callShopifyPaginatedApi<ShopifyPayout>({
      event,
      storeId,
      token,
      path: "/shopify_payments/payouts.json",
      resourceKey: "payouts",
      preserveUnsafeIntegers: true,
    }),
    callShopifyPaginatedApi<ShopifyBalanceTransaction>({
      event,
      storeId,
      token,
      path: "/shopify_payments/balance/transactions.json",
      resourceKey: "transactions",
      mapItem: normalizeShopifyBalanceTransaction,
      preserveUnsafeIntegers: true,
    }),
  ]);

  const data = {
    balance: balanceRes.balance ?? null,
    payouts,
    balanceTransactions,
    transactionsByPayout: groupTransactionsByPayout(balanceTransactions),
  };

  return createApiSuccessResponse(data, {
    resource: "payments",
    strategy: "aggregate",
    fieldConvention: "shopify-rest",
  }) satisfies PaymentsOverviewResponse;
});
