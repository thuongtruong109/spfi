import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { fetchShopifyPaymentsPayouts } from "~~/server/utils/shopify-payments-graphql";
import type { ShopifyPayoutFilters } from "~~/types/shopify-payment";

interface PayoutAllBody {
  storeId?: string;
  token?: string;
  filters?: ShopifyPayoutFilters;
  pagination?: {
    first?: number;
    after?: string | null;
  };
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<PayoutAllBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  return fetchShopifyPaymentsPayouts(
    { event, storeId, token },
    body.filters || {},
    body.pagination || {},
  );
});
