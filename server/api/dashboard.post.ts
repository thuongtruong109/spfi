import { defineEventHandler, readBody, setResponseHeader } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { fetchStoreDashboard } from "~~/server/utils/shopify-dashboard";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import type { DashboardService } from "~~/types/dashboard";
import {
  isDashboardServiceList,
  normalizeDashboardServices,
} from "~~/utils/dashboard-load";

interface DashboardBody {
  storeId?: string;
  token?: string;
  timezoneOffsetMinutes?: number;
  services?: DashboardService[];
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<DashboardBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);

  const timezoneOffsetMinutes = Number(body.timezoneOffsetMinutes || 0);
  if (
    !Number.isFinite(timezoneOffsetMinutes) ||
    timezoneOffsetMinutes < -840 ||
    timezoneOffsetMinutes > 840
  ) {
    throw createApiErrorFromMessage("Invalid timezone offset.", 400);
  }
  if (body.services !== undefined && !isDashboardServiceList(body.services)) {
    throw createApiErrorFromMessage("Invalid dashboard services.", 400);
  }

  setResponseHeader(event, "cache-control", "private, no-store");
  const dashboard = await fetchStoreDashboard({
    event,
    storeId,
    token,
    timezoneOffsetMinutes,
    services: normalizeDashboardServices(body.services),
  });
  setResponseHeader(event, "x-spf-field-convention", "app-camel-case");
  return dashboard;
});
