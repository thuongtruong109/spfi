import type {
  ShopifyAdjustmentOrderTransaction,
  ShopifyBalanceTransaction,
} from "~~/types/shopify";

type OrderTransactionStatusSource = Pick<
  ShopifyBalanceTransaction,
  "source_order_id" | "payout_status"
>;

interface AdjustmentTransactionSource {
  adjustment_order_transactions?: ShopifyAdjustmentOrderTransaction[] | null;
}

export function getAdjustmentOrderTransactions(
  transaction: AdjustmentTransactionSource,
): ShopifyAdjustmentOrderTransaction[] {
  return Array.isArray(transaction.adjustment_order_transactions)
    ? transaction.adjustment_order_transactions
    : [];
}

export function buildOrderTransactionStatusMap(
  transactions: readonly OrderTransactionStatusSource[],
) {
  const statuses = new Map<string, string>();

  for (const transaction of transactions) {
    const orderId = String(transaction.source_order_id || "").trim();
    const status = String(transaction.payout_status || "").trim();
    if (orderId && status && !statuses.has(orderId)) {
      statuses.set(orderId, status);
    }
  }

  return statuses;
}
