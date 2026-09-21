import { defineEventHandler, readBody, setResponseHeader } from "h3";
import {
  DASHBOARD_TRAFFIC_RANGES,
  type DashboardTrafficRange,
} from "~~/types/dashboard";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import {
  fetchShopifyTrafficDimension,
  isDashboardTrafficDimensionKey,
} from "~~/server/utils/shopify-traffic";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { isRequestAbortError } from "~~/server/utils/request-abort";

interface TrafficDetailsBody {
  storeId?: string;
  token?: string;
  range?: string;
  dimension?: string;
  timeZone?: string;
  refresh?: boolean;
}

const VALID_RANGES = new Set<DashboardTrafficRange>(DASHBOARD_TRAFFIC_RANGES);

export default defineEventHandler(async (event) => {
  const body = (await readBody<TrafficDetailsBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const range = String(body.range || "").trim() as DashboardTrafficRange;
  if (!VALID_RANGES.has(range)) {
    throw createApiErrorFromMessage(
      'Traffic range must be one of "24h", "7d", or "30d".',
      400,
    );
  }
  const dimension = String(body.dimension || "").trim();
  if (!isDashboardTrafficDimensionKey(dimension)) {
    throw createApiErrorFromMessage("Traffic dimension is not supported.", 400);
  }

  setResponseHeader(event, "cache-control", "private, no-store");
  try {
    const dimensionResult = await fetchShopifyTrafficDimension({
      event,
      storeId,
      token,
      range,
      dimension,
      timeZone: body.timeZone,
      refresh: body.refresh === true,
    });
    setResponseHeader(event, "x-spf-field-convention", "app-camel-case");
    return dimensionResult;
  } catch (error) {
    if (isRequestAbortError(error)) return;
    throw error;
  }
});
