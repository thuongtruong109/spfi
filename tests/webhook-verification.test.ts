import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  buildWebhookNotification,
  normalizeShopifyShopDomain,
  resolveShopifyWebhookTopic,
  verifyShopifyWebhookHmac,
} from "../server/utils/webhook-verification.ts";

test("Shopify webhook verification authenticates the exact raw body", () => {
  const body = Buffer.from('{"id":9007199254740993123,"name":"#1042"}');
  const signature = createHmac("sha256", "client-secret").update(body).digest("base64");

  assert.equal(verifyShopifyWebhookHmac(body, signature, "client-secret"), true);
  assert.equal(
    verifyShopifyWebhookHmac(
      Buffer.from(`${body.toString()}\n`),
      signature,
      "client-secret",
    ),
    false,
  );
  assert.equal(verifyShopifyWebhookHmac(body, "not-base64", "client-secret"), false);
});

test("Shopify webhook metadata is normalized through strict allowlists", () => {
  assert.equal(resolveShopifyWebhookTopic("orders/updated"), "ORDERS_UPDATED");
  assert.equal(
    resolveShopifyWebhookTopic("fulfillments/update"),
    "FULFILLMENTS_UPDATE",
  );
  assert.equal(resolveShopifyWebhookTopic("products/update"), "PRODUCTS_UPDATE");
  assert.equal(resolveShopifyWebhookTopic("app/uninstalled"), "APP_UNINSTALLED");
  assert.equal(resolveShopifyWebhookTopic("orders/delete"), "ORDERS_DELETE");
  assert.equal(resolveShopifyWebhookTopic("payouts/paid"), null);
  assert.equal(
    normalizeShopifyShopDomain("Example-Store.myshopify.com"),
    "example-store.myshopify.com",
  );
  assert.equal(normalizeShopifyShopDomain("example.com"), "");
});

test("resource-deletion webhooks are represented explicitly", () => {
  const notification = buildWebhookNotification({
    webhookId: "deletion-1",
    storeId: "example-store",
    shopDomain: "example-store.myshopify.com",
    topic: "PRODUCTS_DELETE",
    payload: { id: "9007199254740993123" },
  });

  assert.equal(notification.kind, "product");
  assert.equal(notification.status, "deleted");
  assert.equal(notification.resourceId, "9007199254740993123");
});

test("webhook notifications retain order routing and operational status", () => {
  const notification = buildWebhookNotification({
    webhookId: "delivery-1",
    eventId: "event-1",
    storeId: "example-store",
    shopDomain: "example-store.myshopify.com",
    topic: "FULFILLMENTS_UPDATE",
    triggeredAt: "2026-08-17T02:00:00Z",
    payload: {
      id: "9007199254740993123",
      order_id: "9007199254740993999",
      name: "#1042.1",
      shipment_status: "in_transit",
    },
    now: new Date("2026-08-17T02:00:01Z"),
  });

  assert.deepEqual(notification, {
    id: "delivery-1",
    webhookId: "delivery-1",
    eventId: "event-1",
    storeId: "example-store",
    shopDomain: "example-store.myshopify.com",
    topic: "FULFILLMENTS_UPDATE",
    kind: "fulfillment",
    resourceId: "9007199254740993123",
    orderId: "9007199254740993999",
    orderName: "#1042.1",
    status: "in_transit",
    occurredAt: "2026-08-17T02:00:00.000Z",
    receivedAt: "2026-08-17T02:00:01.000Z",
  });
});
