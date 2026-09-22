import type { ShopifyBalanceTransaction } from "./shopify";

export interface ShopifyMoneyV2 {
  amount: string;
  currencyCode: string;
}

export interface ShopifyPaymentsPayoutSchedule {
  interval: string;
  weeklyAnchor: string | null;
  monthlyAnchor: number | null;
}

export interface ShopifyPaymentsBankAccount {
  id: string;
  accountNumberLastDigits: string;
  bankName: string | null;
  country: string;
  createdAt: string;
  currency: string;
  status: string;
}

export interface ShopifyPaymentsBusinessEntity {
  id: string;
  displayName: string;
  companyName: string | null;
  primary: boolean;
}

export interface ShopifyPaymentsPayoutMetadata {
  id: string;
  legacyResourceId: string;
  externalTraceId: string | null;
  issuedAt: string;
  transactionType: "DEPOSIT" | "WITHDRAWAL" | (string & {});
  businessEntity: ShopifyPaymentsBusinessEntity;
}

export interface ShopifyPaymentsAccount {
  id: string;
  accountOpenerName: string | null;
  activated: boolean;
  onboardable: boolean;
  country: string;
  defaultCurrency: string;
  balance: ShopifyMoneyV2[];
  payoutSchedule: ShopifyPaymentsPayoutSchedule;
  payoutStatementDescriptor: string | null;
  chargeStatementDescriptors: {
    default: string | null;
    prefix: string;
  } | null;
  bankAccounts: ShopifyPaymentsBankAccount[];
}

export interface ShopifyPaymentsAccountResponse {
  account: ShopifyPaymentsAccount | null;
}

export interface ShopifyConnectionPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export const SHOPIFY_PAYMENTS_DISPUTE_STATUSES = [
  "ACCEPTED",
  "LOST",
  "NEEDS_RESPONSE",
  "PREVENTED",
  "UNDER_REVIEW",
  "WON",
] as const;

export type ShopifyPaymentsDisputeStatus =
  (typeof SHOPIFY_PAYMENTS_DISPUTE_STATUSES)[number];

export interface ShopifyPaymentsDispute {
  id: string;
  legacyResourceId: string;
  amount: ShopifyMoneyV2;
  evidenceDueBy: string | null;
  evidenceSentOn: string | null;
  finalizedOn: string | null;
  initiatedAt: string;
  order: {
    id: string;
    legacyResourceId: string;
    name: string;
  } | null;
  reasonDetails: {
    reason: string;
    networkReasonCode: string | null;
  };
  status: ShopifyPaymentsDisputeStatus | (string & {});
  type: string;
}

export interface ShopifyPaymentsDisputeFilters {
  status?: ShopifyPaymentsDisputeStatus;
  initiated_at_min?: string;
  initiated_at_max?: string;
}

export interface ShopifyPaymentsDisputesResponse {
  disputes: ShopifyPaymentsDispute[];
  pageInfo: ShopifyConnectionPageInfo;
}

export interface ShopifyPaymentsBalanceTransactionSearchFilters {
  transaction_type?: string;
  payout_status?: string;
  payout_date?: string;
  processed_at_min?: string;
  processed_at_max?: string;
  currency?: string;
  credit_card_last4?: string;
  payment_method_name?: string;
  payments_transfer_id?: string;
  tax_reporting_exempt?: boolean;
  hide_transfers?: boolean;
  test?: boolean;
  since_id?: string | number;
  last_id?: string | number;
}

export interface ShopifyPaymentsGraphqlTransactionsResponse {
  transactions: ShopifyBalanceTransaction[];
  pageInfo: ShopifyConnectionPageInfo;
}
