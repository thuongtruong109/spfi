import type { H3Event } from "h3";
import type {
  ShopifyPaymentsAccount,
  ShopifyPaymentsBalanceTransactionSearchFilters,
  ShopifyPaymentsBankAccount,
  ShopifyConnectionPageInfo,
  ShopifyPaymentsDispute,
  ShopifyPaymentsDisputeFilters,
  ShopifyPaymentsPayoutMetadata,
} from "~~/types/shopify-payments-graphql";
import type {
  ShopifyAdjustmentOrderTransaction,
  ShopifyBalanceTransaction,
  ShopifyPayout,
} from "~~/types/shopify";
import type { ShopifyPayoutFilters } from "~~/types/shopify-payment";
import { callShopifyGraphql } from "./callShopifyGraphql";
import { createApiErrorFromMessage } from "./callShopifyApi";
import { buildPayoutQueryParams } from "./shopify-payment-query";

interface Connection<T> {
  nodes: T[];
  pageInfo: ShopifyConnectionPageInfo;
}

interface ShopifyPaymentsAccountCore {
  id: string;
  accountOpenerName: string | null;
  activated: boolean;
  onboardable: boolean;
  country: string;
  defaultCurrency: string;
  balance: ShopifyPaymentsAccount["balance"];
  payoutSchedule: ShopifyPaymentsAccount["payoutSchedule"];
  payoutStatementDescriptor: string | null;
  chargeStatementDescriptors: ShopifyPaymentsAccount["chargeStatementDescriptors"];
}

interface AccountData {
  shopifyPaymentsAccount:
    | (ShopifyPaymentsAccountCore & {
        bankAccounts: Connection<ShopifyPaymentsBankAccount>;
      })
    | null;
}

interface PayoutsData {
  shopifyPaymentsAccount: {
    payouts: Connection<GraphqlPayout>;
  } | null;
}

interface GraphqlPayout extends ShopifyPaymentsPayoutMetadata {
  net: {
    amount: string;
    currencyCode: string;
  };
  status: string;
  summary: {
    adjustmentsFee: { amount: string };
    adjustmentsGross: { amount: string };
    chargesFee: { amount: string };
    chargesGross: { amount: string };
    refundsFee: { amount: string };
    refundsFeeGross: { amount: string };
    reservedFundsFee: { amount: string };
    reservedFundsGross: { amount: string };
    retriedPayoutsFee: { amount: string };
    retriedPayoutsGross: { amount: string };
  };
}

interface GraphqlAdjustmentOrder {
  orderTransactionId: string;
  amount: {
    amount: string;
    currencyCode: string;
  };
  fees: {
    amount: string;
    currencyCode: string;
  };
  net: {
    amount: string;
    currencyCode: string;
  };
  link: string;
  name: string;
}

interface GraphqlBalanceTransaction {
  id: string;
  type: string;
  test: boolean;
  associatedPayout: {
    id: string | null;
    status: string | null;
  };
  amount: {
    amount: string;
    currencyCode: string;
  };
  fee: {
    amount: string;
    currencyCode: string;
  };
  net: {
    amount: string;
    currencyCode: string;
  };
  sourceId: string | null;
  sourceType: string | null;
  sourceOrderTransactionId: string | null;
  associatedOrder: {
    id: string;
    name: string;
  } | null;
  adjustmentsOrders: GraphqlAdjustmentOrder[];
  adjustmentReason: string | null;
  transactionDate: string;
}

interface BalanceTransactionsData {
  shopifyPaymentsAccount: {
    balanceTransactions: Connection<GraphqlBalanceTransaction>;
  } | null;
}

interface DisputesData {
  disputes: Connection<ShopifyPaymentsDispute>;
}

interface ShopifyGraphqlRequestContext {
  event: H3Event;
  storeId: string;
  token: string;
}

interface ConnectionPageInput {
  first?: number;
  after?: string | null;
}

const CONNECTION_PAGE_SIZE = 100;
const BANK_ACCOUNT_PAGE_SIZE = 50;

const ACCOUNT_QUERY = `#graphql
  query ShopifyPaymentsAccount($bankAccountLimit: Int!) {
    shopifyPaymentsAccount {
      id
      accountOpenerName
      activated
      onboardable
      country
      defaultCurrency
      balance {
        amount
        currencyCode
      }
      payoutSchedule {
        interval
        weeklyAnchor
        monthlyAnchor
      }
      payoutStatementDescriptor
      chargeStatementDescriptors {
        default
        prefix
      }
      bankAccounts(first: $bankAccountLimit) {
        nodes {
          id
          accountNumberLastDigits
          bankName
          country
          createdAt
          currency
          status
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const PAYOUTS_QUERY = `#graphql
  query ShopifyPaymentsPayouts($first: Int!, $after: String, $query: String) {
    shopifyPaymentsAccount {
      payouts(
        first: $first
        after: $after
        query: $query
        sortKey: ISSUED_AT
        reverse: true
      ) {
        nodes {
          id
          legacyResourceId
          externalTraceId
          issuedAt
          transactionType
          businessEntity {
            id
            displayName
            companyName
            primary
          }
          net {
            amount
            currencyCode
          }
          status
          summary {
            adjustmentsFee { amount }
            adjustmentsGross { amount }
            chargesFee { amount }
            chargesGross { amount }
            refundsFee { amount }
            refundsFeeGross { amount }
            reservedFundsFee { amount }
            reservedFundsGross { amount }
            retriedPayoutsFee { amount }
            retriedPayoutsGross { amount }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const BALANCE_TRANSACTIONS_QUERY = `#graphql
  query ShopifyPaymentsBalanceTransactions(
    $first: Int!
    $after: String
    $query: String
    $hideTransfers: Boolean!
  ) {
    shopifyPaymentsAccount {
      balanceTransactions(
        first: $first
        after: $after
        query: $query
        hideTransfers: $hideTransfers
        sortKey: PROCESSED_AT
        reverse: true
      ) {
        nodes {
          id
          type
          test
          associatedPayout {
            id
            status
          }
          amount {
            amount
            currencyCode
          }
          fee {
            amount
            currencyCode
          }
          net {
            amount
            currencyCode
          }
          sourceId
          sourceType
          sourceOrderTransactionId
          associatedOrder {
            id
            name
          }
          adjustmentsOrders {
            orderTransactionId
            amount {
              amount
              currencyCode
            }
            fees {
              amount
              currencyCode
            }
            net {
              amount
              currencyCode
            }
            link
            name
          }
          adjustmentReason
          transactionDate
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const DISPUTES_QUERY = `#graphql
  query ShopifyPaymentsDisputes(
    $first: Int!
    $after: String
    $query: String
  ) {
    disputes(first: $first, after: $after, query: $query, reverse: true) {
      nodes {
        id
        legacyResourceId
        amount {
          amount
          currencyCode
        }
        evidenceDueBy
        evidenceSentOn
        finalizedOn
        initiatedAt
        order {
          id
          legacyResourceId
          name
        }
        reasonDetails {
          reason
          networkReasonCode
        }
        status
        type
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export async function fetchShopifyPaymentsAccount(
  context: ShopifyGraphqlRequestContext,
) {
  const data = await callShopifyGraphql<AccountData, { bankAccountLimit: number }>({
    ...context,
    query: ACCOUNT_QUERY,
    operationName: "ShopifyPaymentsAccount",
    variables: { bankAccountLimit: BANK_ACCOUNT_PAGE_SIZE },
  });

  if (!data.shopifyPaymentsAccount) return { account: null };

  const { bankAccounts, ...account } = data.shopifyPaymentsAccount;

  return {
    account: {
      ...account,
      bankAccounts: bankAccounts.nodes,
    } satisfies ShopifyPaymentsAccount,
  };
}

export async function fetchShopifyPaymentsPayouts(
  context: ShopifyGraphqlRequestContext,
  filters: ShopifyPayoutFilters = {},
  page: ConnectionPageInput = {},
) {
  const connection = await fetchPayoutConnection(
    context,
    buildPayoutSearchQuery(filters),
    page,
  );
  const mapped = connection.nodes.map(mapPayout);
  return {
    payouts: mapped.map((item) => item.payout),
    metadata: mapped.map((item) => item.metadata),
    pageInfo: connection.pageInfo,
  };
}

export async function fetchShopifyPaymentsPayoutByLegacyId(
  context: ShopifyGraphqlRequestContext,
  payoutId: string,
) {
  const connection = await fetchPayoutConnection(context, `id:${payoutId}`, {
    first: 1,
  });
  return connection.nodes[0] ? mapPayout(connection.nodes[0]) : null;
}

export async function fetchShopifyPaymentsBalanceTransactions(
  context: ShopifyGraphqlRequestContext,
  filters: ShopifyPaymentsBalanceTransactionSearchFilters = {},
  page: ConnectionPageInput = {},
) {
  const searchQuery = buildBalanceTransactionSearchQuery(filters);
  const data = await callShopifyGraphql<
    BalanceTransactionsData,
    {
      first: number;
      after: string | null;
      query: string | null;
      hideTransfers: boolean;
    }
  >({
    ...context,
    query: BALANCE_TRANSACTIONS_QUERY,
    operationName: "ShopifyPaymentsBalanceTransactions",
    variables: {
      ...normalizeConnectionPage(page),
      query: searchQuery || null,
      hideTransfers: filters.hide_transfers === true,
    },
  });
  const connection =
    data.shopifyPaymentsAccount?.balanceTransactions ??
    emptyConnection<GraphqlBalanceTransaction>();
  const mapped = connection.nodes.map(mapBalanceTransaction);
  return {
    transactions:
      typeof filters.test === "boolean"
        ? mapped.filter((transaction) => transaction.test === filters.test)
        : mapped,
    pageInfo: connection.pageInfo,
  };
}

export async function fetchAllShopifyPaymentsBalanceTransactions(
  context: ShopifyGraphqlRequestContext,
  filters: ShopifyPaymentsBalanceTransactionSearchFilters = {},
) {
  const transactions: ShopifyBalanceTransaction[] = [];
  const visitedCursors = new Set<string>();
  let after: string | null = null;

  while (true) {
    const page = await fetchShopifyPaymentsBalanceTransactions(context, filters, {
      first: CONNECTION_PAGE_SIZE,
      after,
    });
    transactions.push(...page.transactions);

    if (!page.pageInfo.hasNextPage) return transactions;
    const nextCursor = page.pageInfo.endCursor;
    if (!nextCursor || visitedCursors.has(nextCursor)) {
      throw createApiErrorFromMessage(
        "Shopify GraphQL pagination returned a missing or repeated cursor.",
        502,
      );
    }
    visitedCursors.add(nextCursor);
    after = nextCursor;
  }
}

export async function fetchShopifyPaymentsDisputes(
  context: ShopifyGraphqlRequestContext,
  filters: ShopifyPaymentsDisputeFilters = {},
  page: ConnectionPageInput = {},
) {
  const searchQuery = buildDisputeSearchQuery(filters);
  const data = await callShopifyGraphql<
    DisputesData,
    { first: number; after: string | null; query: string | null }
  >({
    ...context,
    query: DISPUTES_QUERY,
    operationName: "ShopifyPaymentsDisputes",
    variables: {
      ...normalizeConnectionPage(page),
      query: searchQuery || null,
    },
  });
  return { disputes: data.disputes.nodes, pageInfo: data.disputes.pageInfo };
}

export function buildPayoutSearchQuery(filters: ShopifyPayoutFilters) {
  const params = buildPayoutQueryParams(filters);
  const parts: string[] = [];
  if (params.date) parts.push(`issued_at:${params.date}`);
  if (params.date_min) parts.push(`issued_at:>=${params.date_min}`);
  if (params.date_max) parts.push(`issued_at:<=${params.date_max}`);
  if (params.since_id) parts.push(`id:>${params.since_id}`);
  if (params.last_id) parts.push(`id:<${params.last_id}`);
  if (params.status) parts.push(`status:${params.status}`);
  return parts.join(" ");
}

export function buildBalanceTransactionSearchQuery(
  filters: ShopifyPaymentsBalanceTransactionSearchFilters,
) {
  const parts: string[] = [];

  addToken(parts, "transaction_type", filters.transaction_type, "identifier");
  addToken(parts, "payout_status", filters.payout_status, "identifier");
  addDateToken(parts, "payout_date", filters.payout_date);
  addDateRange(
    parts,
    "processed_at",
    filters.processed_at_min,
    filters.processed_at_max,
  );

  if (filters.currency) {
    const currency = String(filters.currency).trim().toUpperCase();
    if (!/^[A-Z]{3,4}$/.test(currency)) {
      throw createApiErrorFromMessage(
        'The "currency" filter must be a 3-4 character currency code.',
        400,
      );
    }
    parts.push(`currency:${currency}`);
  }

  if (filters.credit_card_last4) {
    const last4 = String(filters.credit_card_last4).trim();
    if (!/^\d{4}$/.test(last4)) {
      throw createApiErrorFromMessage(
        'The "credit_card_last4" filter must contain exactly four digits.',
        400,
      );
    }
    parts.push(`credit_card_last4:${last4}`);
  }

  addToken(parts, "payment_method_name", filters.payment_method_name, "quoted");
  addPositiveId(parts, "payments_transfer_id", filters.payments_transfer_id);
  addPositiveId(parts, "id", filters.since_id, ">");
  addPositiveId(parts, "id", filters.last_id, "<");

  if (typeof filters.tax_reporting_exempt === "boolean") {
    parts.push(`tax_reporting_exempt:${filters.tax_reporting_exempt}`);
  }

  return parts.join(" ");
}

export function buildDisputeSearchQuery(filters: ShopifyPaymentsDisputeFilters) {
  const parts: string[] = [];
  addToken(parts, "status", filters.status, "identifier");
  addDateRange(
    parts,
    "initiated_at",
    filters.initiated_at_min,
    filters.initiated_at_max,
  );
  return parts.join(" ");
}

async function fetchPayoutConnection(
  context: ShopifyGraphqlRequestContext,
  searchQuery: string,
  page: ConnectionPageInput,
) {
  const data = await callShopifyGraphql<
    PayoutsData,
    { first: number; after: string | null; query: string | null }
  >({
    ...context,
    query: PAYOUTS_QUERY,
    operationName: "ShopifyPaymentsPayouts",
    variables: {
      ...normalizeConnectionPage(page),
      query: searchQuery || null,
    },
  });
  return data.shopifyPaymentsAccount?.payouts ?? emptyConnection<GraphqlPayout>();
}

export function normalizeConnectionPage(page: ConnectionPageInput = {}) {
  const requestedFirst = Number(page.first ?? CONNECTION_PAGE_SIZE);
  const first = Number.isFinite(requestedFirst)
    ? Math.min(CONNECTION_PAGE_SIZE, Math.max(1, Math.trunc(requestedFirst)))
    : CONNECTION_PAGE_SIZE;
  const after = page.after == null ? null : String(page.after).trim();
  if (after && after.length > 8192) {
    throw createApiErrorFromMessage("The pagination cursor is too long.", 400);
  }
  return { first, after: after || null };
}

export function mapPayout(node: GraphqlPayout): {
  payout: ShopifyPayout;
  metadata: ShopifyPaymentsPayoutMetadata;
} {
  const metadata: ShopifyPaymentsPayoutMetadata = {
    id: node.id,
    legacyResourceId: String(node.legacyResourceId),
    externalTraceId: node.externalTraceId,
    issuedAt: node.issuedAt,
    transactionType: node.transactionType,
    businessEntity: node.businessEntity,
  };
  return {
    metadata,
    payout: {
      id: metadata.legacyResourceId,
      status: node.status.toLowerCase(),
      date: node.issuedAt.slice(0, 10),
      currency: node.net.currencyCode,
      amount: node.net.amount,
      summary: {
        adjustments_fee_amount: node.summary.adjustmentsFee.amount,
        adjustments_gross_amount: node.summary.adjustmentsGross.amount,
        charges_fee_amount: node.summary.chargesFee.amount,
        charges_gross_amount: node.summary.chargesGross.amount,
        refunds_fee_amount: node.summary.refundsFee.amount,
        refunds_gross_amount: node.summary.refundsFeeGross.amount,
        reserved_funds_fee_amount: node.summary.reservedFundsFee.amount,
        reserved_funds_gross_amount: node.summary.reservedFundsGross.amount,
        retried_payouts_fee_amount: node.summary.retriedPayoutsFee.amount,
        retried_payouts_gross_amount: node.summary.retriedPayoutsGross.amount,
      },
    },
  };
}

function emptyConnection<T>(): Connection<T> {
  return {
    nodes: [],
    pageInfo: { hasNextPage: false, endCursor: null },
  };
}

export function mapBalanceTransaction(
  transaction: GraphqlBalanceTransaction,
): ShopifyBalanceTransaction {
  const sourceOrderId = numericId(transaction.associatedOrder?.id);

  return {
    id: requireNumericId(transaction.id, "balance transaction"),
    type: transaction.type.toLowerCase(),
    test: transaction.test,
    payout_id: numericId(transaction.associatedPayout.id),
    payout_status: transaction.associatedPayout.status?.toLowerCase() || "pending",
    currency: transaction.amount.currencyCode,
    amount: transaction.amount.amount,
    fee: transaction.fee.amount,
    net: transaction.net.amount,
    source_id: numericScalar(transaction.sourceId),
    source_type: transaction.sourceType || null,
    source_order_id: sourceOrderId,
    source_order_name: transaction.associatedOrder?.name || null,
    source_order_transaction_id: numericScalar(transaction.sourceOrderTransactionId),
    processed_at: transaction.transactionDate,
    adjustment_order_transactions:
      transaction.adjustmentsOrders.map(mapAdjustmentOrder),
    adjustment_reason: transaction.adjustmentReason,
  };
}

function mapAdjustmentOrder(
  adjustment: GraphqlAdjustmentOrder,
): ShopifyAdjustmentOrderTransaction {
  return {
    id: requireNumericScalar(
      adjustment.orderTransactionId,
      "adjustment order transaction",
    ),
    amount: adjustment.amount.amount,
    fee: adjustment.fees.amount,
    net: adjustment.net.amount,
    order: {
      id: orderIdFromLink(adjustment.link),
      name: adjustment.name,
    },
  };
}

function numericId(value: string | null | undefined) {
  if (!value) return null;
  const lastPart = value.split("/").filter(Boolean).pop();
  return numericScalar(lastPart);
}

function numericScalar(value: string | null | undefined) {
  if (!value || !/^\d+$/.test(String(value))) return null;
  return String(value);
}

function orderIdFromLink(link: string) {
  const match = String(link || "").match(/\/orders\/(\d+)/);
  return numericScalar(match?.[1]);
}

function requireNumericId(value: string, resourceName: string) {
  const id = numericId(value);
  if (id) return id;

  throw createApiErrorFromMessage(
    `Shopify returned an invalid ${resourceName} ID.`,
    502,
  );
}

function requireNumericScalar(value: string, resourceName: string) {
  const id = numericScalar(value);
  if (id) return id;

  throw createApiErrorFromMessage(
    `Shopify returned an invalid ${resourceName} ID.`,
    502,
  );
}

function addToken(
  parts: string[],
  key: string,
  value: unknown,
  mode: "identifier" | "quoted",
) {
  if (value === undefined || value === null || value === "") return;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > 100) {
    throw createApiErrorFromMessage(`The "${key}" filter is invalid or too long.`, 400);
  }

  if (mode === "identifier") {
    if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
      throw createApiErrorFromMessage(
        `The "${key}" filter contains unsupported characters.`,
        400,
      );
    }
    parts.push(`${key}:${normalized.toLowerCase()}`);
    return;
  }

  parts.push(`${key}:${quoteSearchValue(normalized)}`);
}

function addPositiveId(parts: string[], key: string, value: unknown, comparator = "") {
  if (value === undefined || value === null || value === "") return;
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized) || normalized === "0") {
    throw createApiErrorFromMessage(
      `The "${key}" filter must be a positive numeric ID.`,
      400,
    );
  }
  parts.push(`${key}:${comparator}${normalized}`);
}

function addDateToken(parts: string[], key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return;
  const normalized = String(value).trim();
  assertIsoDate(key, normalized);
  parts.push(`${key}:${normalized}`);
}

function addDateRange(
  parts: string[],
  key: string,
  minValue: unknown,
  maxValue: unknown,
) {
  const min = normalizeOptionalDate(`${key}_min`, minValue);
  const max = normalizeOptionalDate(`${key}_max`, maxValue);
  if (min && max && min > max) {
    throw createApiErrorFromMessage(`"${key}_min" cannot be after "${key}_max".`, 400);
  }
  if (min) parts.push(`${key}:>=${min}T00:00:00Z`);
  if (max) parts.push(`${key}:<=${max}T23:59:59Z`);
}

function normalizeOptionalDate(key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  assertIsoDate(key, normalized);
  return normalized;
}

function assertIsoDate(key: string, value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(date.getTime()) ||
    !date.toISOString().startsWith(value)
  ) {
    throw createApiErrorFromMessage(
      `The "${key}" filter must be a valid YYYY-MM-DD date.`,
      400,
    );
  }
}

function quoteSearchValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
