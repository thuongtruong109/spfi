export const SHOPIFY_PAYOUT_STATUSES = [
  "scheduled",
  "in_transit",
  "paid",
  "failed",
  "canceled",
] as const;

export type ShopifyPayoutStatus = (typeof SHOPIFY_PAYOUT_STATUSES)[number];
export type ShopifyBalancePayoutStatus = ShopifyPayoutStatus | "pending";

export interface ShopifyPayoutFilters {
  date?: string;
  date_max?: string;
  date_min?: string;
  last_id?: string | number;
  since_id?: string | number;
  status?: ShopifyPayoutStatus;
}

export interface ShopifyBalanceTransactionFilters {
  last_id?: string | number;
  payout_id?: string | number;
  payout_status?: ShopifyBalancePayoutStatus;
  since_id?: string | number;
  test?: boolean;
}

export type PayoutDetailStatus =
  "idle" | "loading" | "success" | "not-found" | "unauthorized" | "partial" | "error";

export interface PayoutDetailLoadState {
  status: PayoutDetailStatus;
  detailError: string | null;
  metadataError: string | null;
  transactionsError: string | null;
}
