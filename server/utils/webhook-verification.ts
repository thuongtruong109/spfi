import { createHmac, timingSafeEqual } from "node:crypto";
import type { WebhookNotification, ShopifyWebhookTopic } from "~~/types/webhook";

const HEADER_TOPIC_MAP: Record<string, ShopifyWebhookTopic> = {
  "app/uninstalled": "APP_UNINSTALLED",
  "shop/update": "SHOP_UPDATE",
  "orders/create": "ORDERS_CREATE",
  "orders/updated": "ORDERS_UPDATED",
  "orders/delete": "ORDERS_DELETE",
  "fulfillments/create": "FULFILLMENTS_CREATE",
  "fulfillments/update": "FULFILLMENTS_UPDATE",
  "refunds/create": "REFUNDS_CREATE",
  "disputes/create": "DISPUTES_CREATE",
  "disputes/update": "DISPUTES_UPDATE",
  "products/create": "PRODUCTS_CREATE",
  "products/update": "PRODUCTS_UPDATE",
  "products/delete": "PRODUCTS_DELETE",
  "inventory_levels/update": "INVENTORY_LEVELS_UPDATE",
  "customers/create": "CUSTOMERS_CREATE",
  "customers/delete": "CUSTOMERS_DELETE",
};

interface NotificationInput {
  webhookId: string;
  eventId?: string;
  storeId: string;
  shopDomain: string;
  topic: ShopifyWebhookTopic;
  triggeredAt?: string;
  payload: Record<string, unknown>;
  now?: Date;
}

export function verifyShopifyWebhookHmac(
  rawBody: Buffer,
  signature: string,
  clientSecret: string,
) {
  const supplied = decodeSignature(signature);
  if (!supplied) return false;

  const expected = createHmac("sha256", clientSecret).update(rawBody).digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function resolveShopifyWebhookTopic(value: string) {
  return (
    HEADER_TOPIC_MAP[
      String(value || "")
        .trim()
        .toLowerCase()
    ] || null
  );
}

export function normalizeShopifyShopDomain(value: string) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(normalized) ? normalized : "";
}

export function buildWebhookNotification({
  webhookId,
  eventId,
  storeId,
  shopDomain,
  topic,
  triggeredAt,
  payload,
  now = new Date(),
}: NotificationInput): WebhookNotification {
  const kind = resolveNotificationKind(topic);
  const resourceId = resolveResourceId(kind, payload) || webhookId;
  const orderId = resolveOrderId(kind, payload, resourceId);
  const orderName = resolveNotificationName(kind, payload, resourceId, orderId);
  const status = resolveNotificationStatus(topic, kind, payload);

  return {
    id: webhookId,
    webhookId,
    eventId: String(eventId || "").trim() || null,
    storeId,
    shopDomain,
    topic,
    kind,
    resourceId,
    orderId,
    orderName,
    status: status || "updated",
    occurredAt:
      firstValidIsoDate(
        triggeredAt,
        readScalar(payload.updated_at),
        readScalar(payload.created_at),
      ) || now.toISOString(),
    receivedAt: now.toISOString(),
  };
}

function resolveNotificationKind(
  topic: ShopifyWebhookTopic,
): WebhookNotification["kind"] {
  if (topic.startsWith("FULFILLMENTS_")) return "fulfillment";
  if (topic === "APP_UNINSTALLED") return "app";
  if (topic === "SHOP_UPDATE") return "shop";
  if (topic === "REFUNDS_CREATE") return "refund";
  if (topic.startsWith("DISPUTES_")) return "dispute";
  if (topic.startsWith("PRODUCTS_")) return "product";
  if (topic === "INVENTORY_LEVELS_UPDATE") return "inventory";
  if (topic.startsWith("CUSTOMERS_")) return "customer";
  return "order";
}

function resolveResourceId(
  kind: WebhookNotification["kind"],
  payload: Record<string, unknown>,
) {
  if (kind === "inventory") {
    return readScalar(payload.inventory_item_id) || readScalar(payload.id);
  }
  return readScalar(payload.id);
}

function resolveOrderId(
  kind: WebhookNotification["kind"],
  payload: Record<string, unknown>,
  resourceId: string,
) {
  if (["fulfillment", "refund", "dispute"].includes(kind)) {
    return readScalar(payload.order_id) || null;
  }
  return kind === "order" ? resourceId || null : null;
}

function resolveNotificationName(
  kind: WebhookNotification["kind"],
  payload: Record<string, unknown>,
  resourceId: string,
  orderId: string | null,
) {
  const fullName = [readScalar(payload.first_name), readScalar(payload.last_name)]
    .filter(Boolean)
    .join(" ");
  const labels: Record<WebhookNotification["kind"], string> = {
    app: "Shopify app",
    shop: readScalar(payload.name) || shopLabel(payload),
    order: orderId ? `#${orderId}` : "Order",
    fulfillment: orderId ? `#${orderId}` : "Fulfillment",
    refund: orderId ? `#${orderId}` : `Refund ${resourceId}`,
    dispute: orderId ? `#${orderId}` : `Dispute ${resourceId}`,
    product: `Product ${resourceId}`,
    inventory: `Inventory item ${resourceId}`,
    customer: fullName || readScalar(payload.email) || `Customer ${resourceId}`,
  };

  return (
    readScalar(payload.name) ||
    readScalar(payload.title) ||
    readScalar(payload.order_name) ||
    labels[kind]
  );
}

function resolveNotificationStatus(
  topic: ShopifyWebhookTopic,
  kind: WebhookNotification["kind"],
  payload: Record<string, unknown>,
) {
  if (topic.endsWith("_DELETE")) return "deleted";
  if (kind === "fulfillment") {
    return readScalar(payload.shipment_status) || readScalar(payload.status);
  }
  if (kind === "order") {
    return (
      readScalar(payload.fulfillment_status) || readScalar(payload.financial_status)
    );
  }
  if (kind === "inventory") {
    const available = readScalar(payload.available);
    return available ? `${available} available` : "inventory updated";
  }
  if (kind === "refund") {
    return readScalar(payload.note) || "refund created";
  }
  if (kind === "app") return "uninstalled";
  if (kind === "shop") return "shop updated";
  return readScalar(payload.status) || `${kind} updated`;
}

function shopLabel(payload: Record<string, unknown>) {
  return readScalar(payload.myshopify_domain) || "Shop settings";
}

function decodeSignature(value: string) {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(normalized)) return null;

  const decoded = Buffer.from(normalized, "base64");
  return decoded.length === 32 ? decoded : null;
}

function readScalar(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  return "";
}

function firstValidIsoDate(...values: Array<string | undefined>) {
  for (const value of values) {
    if (!value) continue;
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }
  return "";
}
