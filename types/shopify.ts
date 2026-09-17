export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type ShopifyNumericId = string | number;

export interface AppErrorData {
  data?: {
    error?: {
      message?: unknown;
    };
  };
  error?: {
    message?: unknown;
  };
  message?: unknown;
  statusMessage?: unknown;
}

export interface AppErrorLike {
  data?: AppErrorData;
  message?: unknown;
}

export interface StoreLocalData {
  domain?: string;
  sock?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  expiresTime?: number;
}

export interface ShopifyMoneySet {
  shop_money?: {
    amount?: string;
    currency_code?: string;
    currency?: string;
  };
  presentment_money?: {
    amount?: string;
    currency_code?: string;
    currency?: string;
  };
}

export interface ShopifyAddress {
  name?: string | null;
  company?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  phone?: string | null;
  province?: string | null;
  province_code?: string | null;
  zip?: string | null;
  country?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ShopifyCustomerAddress extends ShopifyAddress {
  id?: ShopifyNumericId;
  customer_id?: ShopifyNumericId;
  first_name?: string | null;
  last_name?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  default?: boolean;
}

export interface ShopifyMarketingConsent {
  state?: string | null;
  opt_in_level?: string | null;
  consent_updated_at?: string | null;
  consent_collected_from?: string | null;
}

export interface ShopifyCustomer {
  id?: ShopifyNumericId;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  orders_count?: number;
  total_spent?: string;
  currency?: string;
  state?: string;
  tags?: string;
  note?: string | null;
  verified_email?: boolean;
  tax_exempt?: boolean;
  created_at?: string;
  updated_at?: string;
  last_order_id?: ShopifyNumericId | null;
  last_order_name?: string | null;
  email_marketing_consent?: ShopifyMarketingConsent | null;
  sms_marketing_consent?: ShopifyMarketingConsent | null;
  default_address?: ShopifyCustomerAddress | null;
  addresses?: ShopifyCustomerAddress[];
}

export interface ShopifyLineItem {
  id: ShopifyNumericId;
  admin_graphql_api_id?: string;
  name?: string;
  title?: string;
  variant_title?: string | null;
  sku?: string | null;
  price?: string;
  quantity?: number;
  current_quantity?: number;
  fulfillable_quantity?: number;
  product_id?: ShopifyNumericId | null;
  variant_id?: ShopifyNumericId | null;
  discount_allocations?: Array<{
    amount?: string;
    amount_set?: ShopifyMoneySet;
    discount_application_index?: number;
  }>;
}

export interface ShopifyFulfillment {
  id?: ShopifyNumericId;
  order_id?: ShopifyNumericId;
  name?: string;
  status?: string;
  service?: string;
  shipment_status?: string | null;
  location_id?: ShopifyNumericId | null;
  tracking_company?: string | null;
  tracking_number?: string | null;
  tracking_numbers?: string[];
  tracking_url?: string | null;
  tracking_urls?: string[];
  created_at?: string;
  updated_at?: string;
  admin_graphql_api_id?: string;
  line_items?: ShopifyLineItem[];
}

export interface ShopifyRefundLineItem {
  id?: ShopifyNumericId;
  line_item_id: ShopifyNumericId;
  quantity: number;
  restock_type?: string;
}

export interface ShopifyRefund {
  id: ShopifyNumericId;
  order_id?: ShopifyNumericId;
  created_at?: string;
  processed_at?: string;
  note?: string | null;
  user_id?: ShopifyNumericId | null;
  admin_graphql_api_id?: string;
  refund_line_items?: ShopifyRefundLineItem[];
  transactions?: ShopifyOrderTransaction[];
}

export interface ShopifyOrder {
  id: ShopifyNumericId;
  admin_graphql_api_id?: string;
  name?: string;
  order_number: number;
  created_at: string;
  updated_at?: string;
  closed_at?: string | null;
  cancelled_at?: string | null;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  current_total_price?: string;
  total_outstanding?: string;
  subtotal_price?: string;
  current_subtotal_price?: string;
  total_tax?: string;
  current_total_tax?: string;
  total_discounts?: string;
  current_total_discounts?: string;
  total_shipping_price_set?: ShopifyMoneySet;
  currency: string;
  email?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  note?: string | null;
  tags?: string;
  test?: boolean;
  source_name?: string;
  referring_site?: string | null;
  customer?: ShopifyCustomer | null;
  shipping_address?: ShopifyAddress | null;
  billing_address?: ShopifyAddress | null;
  shipping_lines?: Array<{ title?: string }>;
  line_items: ShopifyLineItem[];
  fulfillments?: ShopifyFulfillment[];
  refunds?: ShopifyRefund[];
}

export interface ShopifyOrderTransaction {
  id: ShopifyNumericId;
  order_id?: ShopifyNumericId;
  kind: string;
  gateway?: string;
  status: string;
  message?: string | null;
  created_at: string;
  test?: boolean;
  authorization?: string | null;
  authorization_expires_at?: string | null;
  amount: string;
  currency: string;
  parent_id?: ShopifyNumericId | null;
  processed_at?: string;
  location_id?: ShopifyNumericId | null;
  user_id?: ShopifyNumericId | null;
  device_id?: ShopifyNumericId | null;
  source_name?: string | null;
  error_code?: string | null;
  payment_id?: string | null;
  manual_payment_gateway?: boolean;
  admin_graphql_api_id?: string;
  extended_authorization_attributes?: {
    standard_authorization_expires_at?: string | null;
    extended_authorization_expires_at?: string | null;
  } | null;
  total_unsettled_set?: ShopifyMoneySet | null;
  currency_exchange_adjustment?: {
    id: ShopifyNumericId;
    adjustment: string;
    original_amount: string;
    final_amount: string;
    currency: string;
  } | null;
  amount_rounding?: string | null;
  payment_details?: {
    credit_card_bin?: string | null;
    credit_card_company?: string | null;
    credit_card_number?: string | null;
    credit_card_name?: string | null;
    credit_card_wallet?: string | null;
    credit_card_expiration_month?: number | null;
    credit_card_expiration_year?: number | null;
    payment_method_name?: string | null;
    buyer_action_info?: Record<string, unknown> | null;
    avs_result_code?: string | null;
    cvv_result_code?: string | null;
  } | null;
  payments_refund_attributes?: {
    status?: string | null;
    acquirer_reference_number?: string | null;
  } | null;
  receipt?: Record<string, unknown> | null;
}

export interface ShopifyOrderEvent {
  id: ShopifyNumericId;
  subject_id: ShopifyNumericId;
  subject_type: string;
  verb: string;
  created_at: string;
  author?: string | null;
  description?: string | null;
  message?: string | null;
  body?: string | null;
  arguments?: string[];
  path?: string | null;
}

export interface ShopifyVariant {
  id: ShopifyNumericId;
  product_id?: ShopifyNumericId;
  title?: string;
  price?: string;
  compare_at_price?: string | null;
  sku?: string | null;
  barcode?: string | null;
  position?: number;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  image_id?: ShopifyNumericId | null;
  taxable?: boolean;
  requires_shipping?: boolean;
  weight?: number;
  weight_unit?: string;
  inventory_item_id?: ShopifyNumericId;
  inventory_management?: string | null;
  fulfillment_service?: string;
  inventory_policy?: string;
  inventory_quantity?: number;
  presentment_prices?: Array<{
    price: {
      amount: string;
      currency_code: string;
    };
    compare_at_price?: {
      amount: string;
      currency_code: string;
    } | null;
  }>;
  admin_graphql_api_id?: string;
}

export interface ShopifyProductOption {
  id?: ShopifyNumericId;
  product_id?: ShopifyNumericId;
  name: string;
  position?: number;
  values: string[];
  linkedMetafield?: { namespace: string; key: string } | null;
  optionValues?: Array<{
    id: ShopifyNumericId;
    name: string;
    linkedMetafieldValue?: string | null;
    hasVariants?: boolean;
  }>;
}

export interface ShopifyProductImage {
  id?: ShopifyNumericId;
  src: string;
  alt?: string | null;
  position?: number;
  product_id?: ShopifyNumericId;
  variant_ids?: ShopifyNumericId[];
  width?: number;
  height?: number;
  admin_graphql_api_id?: string;
}

export type ShopifyProductStatus = "active" | "archived" | "draft" | "unlisted";

export interface ShopifyProductInput {
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string;
  status?: ShopifyProductStatus;
  published?: boolean;
  handle?: string;
  template_suffix?: string | null;
  options?: ShopifyProductOption[];
  variants?: Array<Partial<ShopifyVariant>>;
  images?: ShopifyProductImage[];
  metafields?: Array<Partial<ShopifyMetafield> & Record<string, unknown>>;
}

export interface ShopifyProduct extends ShopifyProductInput {
  id: ShopifyNumericId;
  admin_graphql_api_id?: string;
  status: ShopifyProductStatus;
  variants: ShopifyVariant[];
  variants_count?: number;
  total_inventory?: number;
  min_price?: string;
  max_price?: string;
  price_currency?: string;
  options?: ShopifyProductOption[];
  image?: ShopifyProductImage | null;
  images?: ShopifyProductImage[];
  handle?: string;
  template_suffix?: string | null;
  published_scope?: "global" | "web";
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  category?: { id: string; name: string; full_name: string } | null;
  seo?: { title: string | null; description: string | null };
  is_gift_card?: boolean;
  requires_selling_plan?: boolean;
  media_count?: number;
}

export interface ShopifyPayoutSummary {
  adjustments_fee_amount: string;
  adjustments_gross_amount: string;
  charges_fee_amount: string;
  charges_gross_amount: string;
  refunds_fee_amount: string;
  refunds_gross_amount: string;
  reserved_funds_fee_amount: string;
  reserved_funds_gross_amount: string;
  retried_payouts_fee_amount: string;
  retried_payouts_gross_amount: string;
}

export interface ShopifyPayout {
  id: ShopifyNumericId;
  status: string;
  date: string;
  currency: string;
  amount: string;
  summary: ShopifyPayoutSummary;
}

export interface ShopifyBalance {
  currency: string;
  amount: string;
  on_hold_amount?: string;
  pending_amount?: string;
}

export const SHOPIFY_REST_BALANCE_TRANSACTION_TYPES = [
  "charge",
  "refund",
  "dispute",
  "reserve",
  "adjustment",
  "credit",
  "debit",
  "payout",
  "payout_failure",
  "payout_cancellation",
] as const;

export type ShopifyRestBalanceTransactionType =
  | (typeof SHOPIFY_REST_BALANCE_TRANSACTION_TYPES)[number]
  | "capture"
  | "advance"
  | "SHOPIFY_COLLECTIVE_DEBIT_REVERSAL"
  | "seller_protection_credit_reversal"
  | (string & {});

export type ShopifyBalanceTransactionSourceType =
  | "charge"
  | "refund"
  | "dispute"
  | "reserve"
  | "adjustment"
  | "payout"
  | `Payments::${string}`
  | (string & {});

export interface ShopifyAdjustmentOrderTransaction {
  id: ShopifyNumericId;
  amount: string;
  fee: string;
  net: string;
  order: {
    id: ShopifyNumericId | null;
    name: string;
  };
}

export interface ShopifyBalanceTransaction {
  id: ShopifyNumericId;
  type: ShopifyRestBalanceTransactionType;
  test: boolean;
  payout_id: ShopifyNumericId | null;
  payout_status: string;
  currency: string;
  amount: string;
  fee: string;
  net: string;
  source_id: ShopifyNumericId | null;
  source_type: ShopifyBalanceTransactionSourceType | null;
  source_order_id: ShopifyNumericId | null;
  /** Enriched from GraphQL ShopifyPaymentsAssociatedOrder. */
  source_order_name?: string | null;
  source_order_transaction_id: ShopifyNumericId | null;
  processed_at: string;
  adjustment_order_transactions: ShopifyAdjustmentOrderTransaction[];
  adjustment_reason: string | null;
}

export interface ShopifyShop {
  id?: ShopifyNumericId;
  name?: string;
  email?: string;
  domain?: string;
  myshopify_domain?: string;
  shop_owner?: string;
  customer_email?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  province_code?: string;
  country?: string;
  country_code?: string;
  zip?: string;
  currency?: string;
  money_format?: string;
  money_with_currency_format?: string;
  timezone?: string;
  iana_timezone?: string;
  plan_name?: string;
  plan_display_name?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ShopifyFulfillmentOrderLineItem {
  id: ShopifyNumericId;
  quantity: number;
  fulfillable_quantity?: number;
  line_item_id?: ShopifyNumericId;
  inventory_item_id?: ShopifyNumericId;
  variant_id?: ShopifyNumericId | null;
}

export interface ShopifyFulfillmentOrder {
  id: ShopifyNumericId;
  status?: string;
  line_items?: ShopifyFulfillmentOrderLineItem[];
}

export interface ShopifyLocation {
  id: ShopifyNumericId;
  name?: string;
  active?: boolean;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  zip?: string | null;
  province?: string | null;
  province_code?: string | null;
  country?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  phone?: string | null;
  legacy?: boolean;
  created_at?: string;
  updated_at?: string;
  localized_country_name?: string | null;
  localized_province_name?: string | null;
  admin_graphql_api_id?: string;
}

export interface ShopifyInventoryLevel {
  inventory_item_id: ShopifyNumericId;
  location_id: ShopifyNumericId;
  available: number | null;
  updated_at?: string;
  admin_graphql_api_id?: string;
  quantities?: Partial<Record<ShopifyInventoryQuantityStateName, number>>;
}

export type ShopifyInventoryQuantityStateName =
  | "available"
  | "incoming"
  | "committed"
  | "damaged"
  | "on_hand"
  | "quality_control"
  | "reserved"
  | "safety_stock";

export interface ShopifyAccessTokenResponse {
  access_token?: string;
  scope?: string;
  expires_in?: number;
  associated_user_scope?: string;
}

export interface OrdersResponse {
  orders?: ShopifyOrder[];
  order?: ShopifyOrder;
}

export interface ProductsResponse {
  products?: ShopifyProduct[];
  product?: ShopifyProduct;
}

export type ProductsListResponse = import("./api-contract").ApiSuccessResponse<
  { products: ShopifyProduct[] },
  import("./api-contract").ApiContractMeta<"products", "complete">
>;

export interface CustomersResponse {
  customers?: ShopifyCustomer[];
  customer?: ShopifyCustomer;
}

export interface CustomerDetailResponse {
  customer: ShopifyCustomer | null;
  orders: ShopifyOrder[];
}

export interface ShopifyMetafield {
  id: ShopifyNumericId;
  namespace: string;
  key: string;
  value: string;
  type: string;
  description?: string | null;
  owner_id?: ShopifyNumericId;
  owner_resource?: string;
  created_at?: string;
  updated_at?: string;
  admin_graphql_api_id?: string;
}

export interface MetafieldsResponse {
  metafields?: ShopifyMetafield[];
  metafield?: ShopifyMetafield;
}

export interface InventoryLevelsResponse {
  inventory_levels?: ShopifyInventoryLevel[];
}

export interface LocationsResponse extends InventoryLevelsResponse {
  locations?: ShopifyLocation[];
  location?: ShopifyLocation;
}

export interface ShopProfileResponse {
  shop: ShopifyShop | null;
  domain: string;
}

export interface BalanceTransactionsResponse {
  transactions: ShopifyBalanceTransaction[];
}

export interface OrderTransactionsResponse {
  transactions: ShopifyOrderTransaction[];
}

export interface OrderTransactionResponse {
  transaction: ShopifyOrderTransaction;
}

export interface OrderTransactionCountResponse {
  count: number;
}

export interface OrderEventsResponse {
  events: ShopifyOrderEvent[];
}

export interface PaymentsOverviewData {
  balance: ShopifyBalance | ShopifyBalance[] | null;
  payouts: ShopifyPayout[];
  balanceTransactions: ShopifyBalanceTransaction[];
  transactionsByPayout: Record<string, ShopifyBalanceTransaction[]>;
}

export type PaymentsOverviewResponse = import("./api-contract").ApiSuccessResponse<
  PaymentsOverviewData,
  import("./api-contract").ApiContractMeta<"payments", "aggregate">
>;

export interface PayoutsResponse {
  payouts: ShopifyPayout[];
  metadata: import("./shopify-payments-graphql").ShopifyPaymentsPayoutMetadata[];
  pageInfo: import("./shopify-payments-graphql").ShopifyConnectionPageInfo;
}

export interface ShopifyRestPageInfo {
  nextCursor: string | null;
  previousCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PayoutDetailIssue {
  message: string;
  statusCode: number;
}

export interface PayoutDetailResponse {
  payout: ShopifyPayout | null;
  metadata: import("./shopify-payments-graphql").ShopifyPaymentsPayoutMetadata | null;
  transactions: ShopifyBalanceTransaction[];
  pageInfo: ShopifyRestPageInfo;
  issues?: {
    metadata?: PayoutDetailIssue;
    transactions?: PayoutDetailIssue;
  };
}

export interface PayoutTransactionsPageResponse {
  transactions: ShopifyBalanceTransaction[];
  pageInfo: ShopifyRestPageInfo;
}
