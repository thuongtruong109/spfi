import { useRuntimeConfig } from "#imports";
import {
  createError,
  defineEventHandler,
  getHeader,
  readRawBody,
  setResponseStatus,
} from "h3";
import { parseJsonPreservingUnsafeIntegers } from "~~/server/utils/lossless-json";
import {
  claimWebhookDelivery,
  completeWebhookDelivery,
  getWebhookShop,
  publishWebhookNotification,
  recordWebhookDeliveryHealth,
  releaseWebhookDelivery,
  removeWebhookShop,
  saveWebhookNotification,
  withWebhookShopLock,
} from "~~/server/utils/webhook-registry";
import {
  buildWebhookNotification,
  normalizeShopifyShopDomain,
  resolveShopifyWebhookTopic,
  verifyShopifyWebhookHmac,
} from "~~/server/utils/webhook-verification";
import { MAX_API_BODY_BYTES } from "~~/server/utils/request-body-limit";

const MAX_WEBHOOK_BODY_BYTES = MAX_API_BODY_BYTES;

export default defineEventHandler(async (event) => {
  const contentLength = Number(getHeader(event, "content-length") || 0);
  if (contentLength > MAX_WEBHOOK_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "Webhook payload too large" });
  }

  const shopDomain = normalizeShopifyShopDomain(
    getHeader(event, "x-shopify-shop-domain") || "",
  );
  const topic = resolveShopifyWebhookTopic(getHeader(event, "x-shopify-topic") || "");
  const webhookId = String(getHeader(event, "x-shopify-webhook-id") || "").trim();
  const signature = String(getHeader(event, "x-shopify-hmac-sha256") || "").trim();
  if (!shopDomain || !topic || !webhookId || !signature || webhookId.length > 128) {
    throw createError({ statusCode: 400, statusMessage: "Invalid webhook headers" });
  }

  const rawBody = await readRawBody(event, false);
  if (rawBody && rawBody.length > MAX_WEBHOOK_BODY_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: "Webhook payload too large",
    });
  }
  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: "Invalid webhook payload" });
  }

  const config = useRuntimeConfig(event);
  const shop = await getWebhookShop(
    shopDomain,
    String(config.webhookEncryptionKey || "").trim() || undefined,
  );
  if (!shop || !verifyShopifyWebhookHmac(rawBody, signature, shop.clientSecret)) {
    throw createError({ statusCode: 401, statusMessage: "Invalid webhook signature" });
  }

  const notification = await withWebhookShopLock(shopDomain, async () => {
    const claim = await claimWebhookDelivery(shopDomain, webhookId);
    if (claim === "duplicate") return null;
    if (claim === "busy") {
      throw createError({
        statusCode: 503,
        statusMessage: "Webhook delivery is already being processed",
      });
    }

    try {
      await recordWebhookDeliveryHealth({
        shopDomain,
        webhookId,
        topic,
        status: "processing",
      });
      const payload = parseWebhookPayload(rawBody);
      const nextNotification = buildWebhookNotification({
        webhookId,
        eventId: getHeader(event, "x-shopify-event-id") || undefined,
        storeId: shop.storeId,
        shopDomain,
        topic,
        triggeredAt: getHeader(event, "x-shopify-triggered-at") || undefined,
        payload,
      });

      await saveWebhookNotification(nextNotification);
      await completeWebhookDelivery(shopDomain, webhookId);
      await recordWebhookDeliveryHealth({
        shopDomain,
        webhookId,
        topic,
        status: "succeeded",
      });
      return nextNotification;
    } catch (error) {
      await Promise.allSettled([
        releaseWebhookDelivery(shopDomain, webhookId),
        recordWebhookDeliveryHealth({
          shopDomain,
          webhookId,
          topic,
          status: "failed",
          error: getWebhookErrorMessage(error),
        }),
      ]);
      throw error;
    }
  });

  if (!notification) {
    setResponseStatus(event, 200);
    return { accepted: true, duplicate: true };
  }

  await publishWebhookNotification(notification);
  if (notification.topic === "APP_UNINSTALLED") {
    await removeWebhookShop(shopDomain);
  }
  setResponseStatus(event, 200);
  return { accepted: true, duplicate: false };
});

function getWebhookErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const candidate = error as { statusMessage?: unknown; message?: unknown };
    return String(candidate.statusMessage || candidate.message || "").trim();
  }
  return String(error || "").trim();
}

function parseWebhookPayload(rawBody: Buffer) {
  try {
    const value = parseJsonPreservingUnsafeIntegers(rawBody.toString("utf8"));
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // Convert malformed payloads into a stable 400 response below.
  }

  throw createError({ statusCode: 400, statusMessage: "Invalid webhook JSON" });
}
