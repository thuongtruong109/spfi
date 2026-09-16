import { defineEventHandler, readBody, setResponseHeader } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { fetchShopifyTraffic } from "~~/server/utils/shopify-traffic";

interface TrafficBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<TrafficBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);

  setResponseHeader(event, "cache-control", "private, no-store");
  const traffic = await fetchShopifyTraffic({ event, storeId, token });
  setResponseHeader(event, "x-spf-field-convention", "app-camel-case");
  return traffic;
});
