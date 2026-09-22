import { useRuntimeConfig } from "#imports";
import {
  createError,
  createEventStream,
  defineEventHandler,
  readBody,
  setResponseHeader,
} from "h3";
import { resolveClientIp } from "~~/server/utils/client-ip";
import { readRuntimeBoolean } from "~~/server/utils/runtime-config";
import {
  getWebhookNotifications,
  getWebhookShop,
  matchesWebhookStreamToken,
  subscribeToWebhookNotifications,
} from "~~/server/utils/webhook-registry";
import {
  resolveWebhookStreamLimits,
  webhookStreamLimiter,
} from "~~/server/utils/webhook-stream-limiter";
import type { WebhookNotification, WebhookStreamCredential } from "~~/types/webhook";

interface StreamBody {
  subscriptions?: WebhookStreamCredential[];
}

const SHARED_STORAGE_POLL_INTERVAL_MS = 2_000;
const MAX_STREAM_SUBSCRIPTIONS = 100;

export default defineEventHandler(async (event) => {
  const body = (await readBody<StreamBody>(event)) || {};
  const subscriptions = Array.isArray(body.subscriptions) ? body.subscriptions : [];
  if (!subscriptions.length) {
    throw createError({ statusCode: 400, statusMessage: "Subscriptions required" });
  }
  if (subscriptions.length > MAX_STREAM_SUBSCRIPTIONS) {
    throw createError({
      statusCode: 413,
      statusMessage: "Too many stream subscriptions",
    });
  }

  const config = useRuntimeConfig(event);
  const encryptionKey = String(config.webhookEncryptionKey || "").trim() || undefined;
  const shopDomains = new Set<string>();
  for (const subscription of subscriptions) {
    const storeId = String(subscription?.storeId || "").trim();
    const token = String(subscription?.token || "").trim();
    if (!storeId || !token) continue;

    const candidates = await Promise.all(
      [...new Set([storeId, `${storeId}.myshopify.com`])].map((candidate) =>
        getWebhookShop(candidate.toLowerCase(), encryptionKey),
      ),
    );
    const shop = candidates.find((item) => item?.storeId === storeId) || null;
    if (shop && matchesWebhookStreamToken(shop.streamToken, token)) {
      shopDomains.add(shop.shopDomain);
    }
  }

  if (!shopDomains.size) {
    throw createError({ statusCode: 401, statusMessage: "Invalid stream token" });
  }

  const limits = resolveWebhookStreamLimits(config as Record<string, unknown>);
  const clientIp = resolveClientIp(event, readRuntimeBoolean(config.trustProxyHeaders));
  const slot = webhookStreamLimiter.acquire({
    ip: clientIp,
    shopDomains,
    limits,
  });
  if (!slot.acquired) {
    setResponseHeader(event, "Retry-After", 30);
    throw createError({
      statusCode: slot.scope === "process" ? 503 : 429,
      statusMessage:
        slot.scope === "process"
          ? "Webhook stream capacity reached"
          : "Too many active webhook streams",
    });
  }

  let stream: ReturnType<typeof createEventStream>;
  try {
    setResponseHeader(event, "X-Accel-Buffering", "no");
    stream = createEventStream(event);
  } catch (error) {
    slot.release();
    throw error;
  }
  const deliveredIds = new Set<string>();
  const pushNotification = (notification: WebhookNotification) => {
    if (deliveredIds.has(notification.id)) return Promise.resolve();
    deliveredIds.add(notification.id);
    return stream.push({
      id: notification.id,
      event: "notification",
      data: JSON.stringify(notification),
    });
  };
  let unsubscribe: () => void = () => {};
  let isPolling = false;
  const pollSharedStorage = async () => {
    if (isPolling) return;
    isPolling = true;
    try {
      for (const notification of await getWebhookNotifications(shopDomains)) {
        await pushNotification(notification);
      }
    } catch {
      // The local subscriber remains available while shared storage recovers.
    } finally {
      isPolling = false;
    }
  };
  let storagePoll: ReturnType<typeof setInterval> | undefined;
  let keepAlive: ReturnType<typeof setInterval> | undefined;
  let maxLifetime: ReturnType<typeof setTimeout> | undefined;
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    clearInterval(keepAlive);
    clearInterval(storagePoll);
    clearTimeout(maxLifetime);
    unsubscribe();
    slot.release();
  };
  stream.onClosed(cleanup);

  try {
    unsubscribe = subscribeToWebhookNotifications({
      shopDomains,
      publish: pushNotification,
      revoke: () => stream.close(),
    });
    storagePoll = setInterval(
      () => void pollSharedStorage(),
      SHARED_STORAGE_POLL_INTERVAL_MS,
    );
    keepAlive = setInterval(() => {
      void stream.push({ event: "keepalive", data: new Date().toISOString() });
    }, 15_000);
    maxLifetime = setTimeout(() => {
      void stream
        .push({ event: "reconnect", data: "maximum_lifetime_reached" })
        .finally(() => stream.close());
    }, limits.maxLifetimeMs);

    await stream.push({
      event: "connected",
      data: JSON.stringify({
        stores: shopDomains.size,
        maxLifetimeSeconds: Math.floor(limits.maxLifetimeMs / 1_000),
      }),
    });
    for (const notification of await getWebhookNotifications(shopDomains)) {
      await pushNotification(notification);
    }

    return await stream.send();
  } catch (error) {
    cleanup();
    await stream.close();
    throw error;
  }
});
