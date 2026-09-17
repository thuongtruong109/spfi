import { defineEventHandler } from "h3";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import {
  fetchPayoutTransactionPage,
  fetchShopifyPayoutById,
} from "~~/server/utils/shopify-payout-detail";
import { fetchShopifyPaymentsPayoutByLegacyId } from "~~/server/utils/shopify-payments-graphql";
import { getAppErrorMessage, getAppErrorStatusCode } from "~~/utils/error";
import type {
  PayoutDetailIssue,
  PayoutDetailResponse,
  ShopifyPayout,
} from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const payoutId = requireShopifyResourceId(event.context.params?.id, "Payout");
  const { storeId, token } = getShopifyQueryCredentials(event);

  const [payoutResult, transactionResult] = await Promise.allSettled([
    fetchShopifyPaymentsPayoutByLegacyId({ event, storeId, token }, payoutId),
    fetchPayoutTransactionPage({ event, storeId, token, payoutId }),
  ]);

  let payout: ShopifyPayout;
  let metadata: PayoutDetailResponse["metadata"] = null;
  let metadataIssue: PayoutDetailIssue | undefined;

  if (payoutResult.status === "fulfilled" && payoutResult.value) {
    payout = payoutResult.value.payout;
    metadata = payoutResult.value.metadata;
  } else {
    payout = await fetchShopifyPayoutById({ event, storeId, token, payoutId });
    metadataIssue = toPayoutDetailIssue(
      payoutResult.status === "rejected"
        ? payoutResult.reason
        : new Error("Shopify Payments payout metadata was not found."),
      "Shopify Payments payout metadata is unavailable.",
    );
  }

  const transactionIssue =
    transactionResult.status === "rejected"
      ? toPayoutDetailIssue(
          transactionResult.reason,
          "Payout transactions are unavailable.",
        )
      : undefined;

  return {
    payout,
    metadata,
    transactions:
      transactionResult.status === "fulfilled" ? transactionResult.value.items : [],
    pageInfo:
      transactionResult.status === "fulfilled"
        ? transactionResult.value.pageInfo
        : emptyRestPageInfo(),
    issues: {
      ...(metadataIssue ? { metadata: metadataIssue } : {}),
      ...(transactionIssue ? { transactions: transactionIssue } : {}),
    },
  } satisfies PayoutDetailResponse;
});

function toPayoutDetailIssue(
  error: unknown,
  fallback: string,
): PayoutDetailIssue {
  return {
    message: getAppErrorMessage(error, fallback),
    statusCode: getAppErrorStatusCode(error) || 500,
  };
}

function emptyRestPageInfo() {
  return {
    nextCursor: null,
    previousCursor: null,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}
