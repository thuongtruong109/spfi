export const SHOPIFY_WEBHOOK_TOPICS = [
  "APP_UNINSTALLED",
  "SHOP_UPDATE",
  "ORDERS_CREATE",
  "ORDERS_UPDATED",
  "ORDERS_DELETE",
  "FULFILLMENTS_CREATE",
  "FULFILLMENTS_UPDATE",
  "REFUNDS_CREATE",
  "DISPUTES_CREATE",
  "DISPUTES_UPDATE",
  "PRODUCTS_CREATE",
  "PRODUCTS_UPDATE",
  "PRODUCTS_DELETE",
  "INVENTORY_LEVELS_UPDATE",
  "CUSTOMERS_CREATE",
  "CUSTOMERS_DELETE",
] as const;

export type ShopifyWebhookTopic = (typeof SHOPIFY_WEBHOOK_TOPICS)[number];
export type WebhookNotificationKind =
  | "app"
  | "shop"
  | "order"
  | "fulfillment"
  | "refund"
  | "dispute"
  | "product"
  | "inventory"
  | "customer";

export type WebhookDeliveryStatus = "processing" | "succeeded" | "failed";

export interface WebhookNotification {
  id: string;
  webhookId: string;
  eventId: string | null;
  storeId: string;
  shopDomain: string;
  topic: ShopifyWebhookTopic;
  kind: WebhookNotificationKind;
  resourceId: string;
  orderId: string | null;
  orderName: string;
  status: string;
  occurredAt: string;
  receivedAt: string;
}

export interface ClientWebhookNotification extends WebhookNotification {
  read: boolean;
}

export interface WebhookStreamCredential {
  storeId: string;
  token: string;
}

export interface WebhookRegistrationResponse {
  storeId: string;
  shopDomain: string;
  streamToken: string;
  webhookUrl: string | null;
  registeredTopics: ShopifyWebhookTopic[];
  warnings: string[];
  synchronizationError: string | null;
  streamTokenVersion: number;
  streamTokenIssuedAt: string;
  streamTokenRotatedAt: string | null;
}

export interface WebhookStreamTokenRotationResponse {
  storeId: string;
  shopDomain: string;
  streamToken: string;
  streamTokenVersion: number;
  streamTokenIssuedAt: string;
  streamTokenRotatedAt: string;
}

export interface ShopifyWebhookSubscription {
  id: string;
  topic: ShopifyWebhookTopic;
  uri: string;
  updatedAt: string;
  isCurrentCallback: boolean;
}

export interface WebhookDeliveryHealth {
  status: WebhookDeliveryStatus;
  attemptedAt: string;
  lastSucceededAt: string | null;
  lastFailedAt: string | null;
  webhookId: string;
  topic: ShopifyWebhookTopic;
  error: string | null;
}

export interface WebhookStoreStatusResponse {
  storeId: string;
  shopDomain: string;
  webhookUrl: string | null;
  subscriptions: ShopifyWebhookSubscription[];
  delivery: WebhookDeliveryHealth | null;
  streamTokenVersion: number | null;
  streamTokenIssuedAt: string | null;
  streamTokenRotatedAt: string | null;
  error: string | null;
}

export interface WebhookConfigurationResponse {
  webhookUrl: string | null;
  publicUrlConfigured: boolean;
  usesRequestOrigin: boolean;
  explicitPublicUrlRecommended: boolean;
  encryptionKeyConfigured: boolean;
  encryptedShopCount: number;
  unreadableEncryptedShopCount: number;
  sharedStorageConfigured: boolean;
  error: string | null;
}
