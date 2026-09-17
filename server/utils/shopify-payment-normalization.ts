import type {
  ShopifyAdjustmentOrderTransaction,
  ShopifyBalanceTransaction,
} from "~~/types/shopify";

type ShopifyRestAdjustmentOrderTransaction = Omit<
  ShopifyAdjustmentOrderTransaction,
  "fee"
> & {
  fee?: string;
  fees?: string;
};

type ShopifyRestBalanceTransaction = Omit<
  ShopifyBalanceTransaction,
  "adjustment_order_transactions"
> & {
  adjustment_order_transactions?: ShopifyRestAdjustmentOrderTransaction[] | null;
};

/**
 * Converts Shopify's REST balance-transaction shape into the stable shape used by
 * the application. Shopify returns null for adjustment_order_transactions on
 * most transaction types and names an adjustment's fee field `fees`.
 */
export function normalizeShopifyBalanceTransaction(
  value: unknown,
): ShopifyBalanceTransaction {
  const transaction = value as ShopifyRestBalanceTransaction;
  const adjustments = Array.isArray(transaction.adjustment_order_transactions)
    ? transaction.adjustment_order_transactions.map(normalizeAdjustmentOrder)
    : [];

  return {
    ...transaction,
    adjustment_order_transactions: adjustments,
  };
}

function normalizeAdjustmentOrder(
  adjustment: ShopifyRestAdjustmentOrderTransaction,
): ShopifyAdjustmentOrderTransaction {
  const { fees, fee, ...rest } = adjustment;

  return {
    ...rest,
    fee: fee ?? fees ?? "0",
  };
}
