import { createError } from "h3";
import type {
  ShopifyAdjustmentOrderTransaction,
  ShopifyBalanceTransaction,
  ShopifyBalanceTransactionSourceType,
  ShopifyNumericId,
  ShopifyRestBalanceTransactionType,
} from "~~/types/shopify";

type UnknownRecord = Record<string, unknown>;

/**
 * Validates Shopify's REST balance-transaction payload at the API boundary and
 * converts its nullable/legacy fields into the stable shape used by the UI.
 */
export function normalizeShopifyBalanceTransaction(
  value: unknown,
): ShopifyBalanceTransaction {
  const transaction = requireRecord(value, "transaction");
  const processedAt = requireString(transaction.processed_at, "processed_at");

  if (Number.isNaN(Date.parse(processedAt))) {
    throw invalidField("processed_at", "an ISO-8601 date string");
  }

  const sourceOrderName = optionalNullableString(
    transaction.source_order_name,
    "source_order_name",
  );

  return {
    id: requireId(transaction.id, "id"),
    type: requireString(transaction.type, "type") as ShopifyRestBalanceTransactionType,
    test: requireBoolean(transaction.test, "test"),
    payout_id: optionalNullableId(transaction.payout_id, "payout_id"),
    payout_status: requireString(transaction.payout_status, "payout_status"),
    currency: requireString(transaction.currency, "currency"),
    amount: requireMoney(transaction.amount, "amount"),
    fee: requireMoney(transaction.fee, "fee"),
    net: requireMoney(transaction.net, "net"),
    source_id: optionalNullableId(transaction.source_id, "source_id"),
    source_type: optionalNullableString(
      transaction.source_type,
      "source_type",
    ) as ShopifyBalanceTransactionSourceType | null,
    source_order_id: optionalNullableId(
      transaction.source_order_id,
      "source_order_id",
    ),
    ...(sourceOrderName !== undefined
      ? { source_order_name: sourceOrderName }
      : {}),
    source_order_transaction_id: optionalNullableId(
      transaction.source_order_transaction_id,
      "source_order_transaction_id",
    ),
    processed_at: processedAt,
    adjustment_order_transactions: normalizeAdjustmentOrders(
      transaction.adjustment_order_transactions,
    ),
    adjustment_reason:
      optionalNullableString(
        transaction.adjustment_reason,
        "adjustment_reason",
      ) ?? null,
  };
}

function normalizeAdjustmentOrders(
  value: unknown,
): ShopifyAdjustmentOrderTransaction[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw invalidField("adjustment_order_transactions", "an array or null");
  }

  return value.map((adjustment, index) =>
    normalizeAdjustmentOrder(adjustment, index),
  );
}

function normalizeAdjustmentOrder(
  value: unknown,
  index: number,
): ShopifyAdjustmentOrderTransaction {
  const field = `adjustment_order_transactions[${index}]`;
  const adjustment = requireRecord(value, field);
  const order = requireRecord(adjustment.order, `${field}.order`);
  const feeValue = adjustment.fee ?? adjustment.fees ?? "0";

  return {
    id: requireId(adjustment.id, `${field}.id`),
    amount: requireMoney(adjustment.amount, `${field}.amount`),
    fee: requireMoney(feeValue, `${field}.fee`),
    net: requireMoney(adjustment.net, `${field}.net`),
    order: {
      id: optionalNullableId(order.id, `${field}.order.id`),
      name: requireString(order.name, `${field}.order.name`, true),
    },
  };
}

function requireRecord(value: unknown, field: string): UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw invalidField(field, "an object");
  }
  return value as UnknownRecord;
}

function requireString(
  value: unknown,
  field: string,
  allowEmpty = false,
): string {
  if (typeof value !== "string" || (!allowEmpty && value.trim() === "")) {
    throw invalidField(field, allowEmpty ? "a string" : "a non-empty string");
  }
  return value;
}

function optionalNullableString(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw invalidField(field, "a string or null");
  return value;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw invalidField(field, "a boolean");
  return value;
}

function requireMoney(value: unknown, field: string): string {
  const amount = requireString(value, field);
  if (!/^-?\d+(?:\.\d+)?$/.test(amount)) {
    throw invalidField(field, "a decimal string");
  }
  return amount;
}

function requireId(value: unknown, field: string): ShopifyNumericId {
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  throw invalidField(field, "a string or safe integer ID");
}

function optionalNullableId(
  value: unknown,
  field: string,
): ShopifyNumericId | null {
  if (value === undefined || value === null) return null;
  return requireId(value, field);
}

function invalidField(field: string, expected: string) {
  const message = `Invalid Shopify balance transaction: ${field} must be ${expected}.`;
  return createError({
    statusCode: 502,
    statusMessage: message,
    data: {
      success: false,
      error: { message, status: 502 },
    },
  });
}
