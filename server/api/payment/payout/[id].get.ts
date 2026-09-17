import { defineEventHandler } from "h3";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { fetchPayoutTransactionPage } from "~~/server/utils/shopify-payout-detail";
import { fetchShopifyPaymentsPayoutByLegacyId } from "~~/server/utils/shopify-payments-graphql";
import type { PayoutDetailResponse } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const payoutId = requireShopifyResourceId(event.context.params?.id, "Payout");
  const { storeId, token } = getShopifyQueryCredentials(event);

  const [payoutResult, transactionPage] = await Promise.all([
    fetchShopifyPaymentsPayoutByLegacyId({ event, storeId, token }, payoutId),
    fetchPayoutTransactionPage({ event, storeId, token, payoutId }),
  ]);

  return {
    payout: payoutResult?.payout ?? null,
    metadata: payoutResult?.metadata ?? null,
    transactions: transactionPage.items,
    pageInfo: transactionPage.pageInfo,
  } satisfies PayoutDetailResponse;
});
