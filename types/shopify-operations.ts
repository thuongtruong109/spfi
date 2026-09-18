export interface CommerceMoney {
  amount: string;
  currencyCode: string;
}

export interface CommercePageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

export interface DraftOrderSummary {
  id: string;
  name: string;
  status: string;
  email: string;
  customerName: string;
  createdAt: string;
  updatedAt: string;
  invoiceSentAt: string | null;
  completedAt: string | null;
  invoiceUrl: string | null;
  totalPrice: CommerceMoney;
  itemCount: number;
  orderId: string | null;
}

export interface DiscountSummary {
  id: string;
  type: string;
  title: string;
  code: string | null;
  summary: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  usageCount: number;
}

export interface AbandonedCheckoutSummary {
  id: string;
  name: string;
  customerName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  recoveryUrl: string;
  totalPrice: CommerceMoney;
  itemCount: number;
  itemTitles: string[];
  discountCodes: string[];
}

export interface ReturnSummary {
  id: string;
  name: string;
  status: "REQUESTED" | "OPEN" | "CLOSED" | "DECLINED" | "CANCELED" | string;
  createdAt: string;
  closedAt: string | null;
  totalQuantity: number;
  orderId: string;
  orderName: string;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    reason: string;
    customerNote: string;
  }>;
}

export interface CommerceListResponse<T> {
  items: T[];
  pageInfo: CommercePageInfo;
}

export interface DraftOrderCreateInput {
  email?: string;
  note?: string;
  tags?: string[];
  currencyCode: string;
  lineItems: Array<{
    title: string;
    quantity: number;
    unitPrice: string;
    requiresShipping?: boolean;
    taxable?: boolean;
  }>;
}

export type DraftOrderAction = "complete" | "invoice" | "delete";

export interface DiscountCreateInput {
  title: string;
  code: string;
  valueType: "percentage" | "fixed";
  value: string;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number | null;
  appliesOncePerCustomer?: boolean;
}

export type DiscountAction = "activate" | "deactivate";

export type ReturnAction = "approve" | "decline" | "close" | "cancel";

export interface ReturnActionInput {
  declineReason?: "FINAL_SALE" | "OTHER" | "RETURN_PERIOD_ENDED";
  declineNote?: string;
  notifyCustomer?: boolean;
}

export type OrderBulkAction = "capture" | "fulfill" | "refund";

export interface OrderBulkRequest {
  storeId: string;
  token: string;
  action: OrderBulkAction;
  orderIds: Array<string | number>;
  notifyCustomer?: boolean;
}

export interface OrderBulkResult {
  orderId: string;
  ok: boolean;
  message: string;
}

export interface OrderBulkResponse {
  action: OrderBulkAction;
  requested: number;
  succeeded: number;
  failed: number;
  results: OrderBulkResult[];
}
