import { defineEventHandler, readBody, setResponseHeader } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { isRequestAbortError } from "~~/server/utils/request-abort";
import { fetchShopifyTrafficRange } from "~~/server/utils/shopify-traffic";
import { setTrafficDiagnosticsHeaders } from "~~/server/utils/traffic-response";
import { DASHBOARD_TRAFFIC_RANGES, type DashboardTrafficRange } from "~~/types/traffic";

interface TrafficRangeBody {
  storeId?: string;
  token?: string;
  range?: string;
  timeZone?: string;
  refresh?: boolean;
}

const VALID_RANGES = new Set<string>(DASHBOARD_TRAFFIC_RANGES);

export default defineEventHandler(async (event) => {
  const body = (await readBody<TrafficRangeBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const range = String(body.range || "").trim();
  if (!VALID_RANGES.has(range)) {
    throw createApiErrorFromMessage(
      `Traffic range must be one of ${DASHBOARD_TRAFFIC_RANGES.join(", ")}.`,
      400,
    );
  }

  setResponseHeader(event, "cache-control", "private, no-store");
  try {
    const result = await fetchShopifyTrafficRange({
      event,
      storeId,
      token,
      range: range as DashboardTrafficRange,
      timeZone: body.timeZone,
      refresh: body.refresh === true,
    });
    setTrafficDiagnosticsHeaders(event, result);
    setResponseHeader(event, "x-spf-field-convention", "app-camel-case");
    return result;
  } catch (error) {
    if (isRequestAbortError(error)) return;
    throw error;
  }
});
