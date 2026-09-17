import { defineEventHandler, getQuery } from "h3";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import {
  fetchPayoutTransactionPage,
  normalizePayoutTransactionCursor,
} from "~~/server/utils/shopify-payout-detail";
import type { PayoutTransactionsPageResponse } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const payoutId = requireShopifyResourceId(event.context.params?.id, "Payout");
  const { storeId, token } = getShopifyQueryCredentials(event);
  const cursor = normalizePayoutTransactionCursor(getQuery(event).cursor);
  const page = await fetchPayoutTransactionPage({
    event,
    storeId,
    token,
    payoutId,
    cursor,
  });

  return {
    transactions: page.items,
    pageInfo: page.pageInfo,
  } satisfies PayoutTransactionsPageResponse;
});
