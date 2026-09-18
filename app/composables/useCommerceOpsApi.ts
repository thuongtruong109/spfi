import type {
  AbandonedCheckoutSummary,
  CommerceListResponse,
  DiscountAction,
  DiscountCreateInput,
  DiscountSummary,
  DraftOrderAction,
  DraftOrderCreateInput,
  DraftOrderSummary,
  ReturnAction,
  ReturnActionInput,
  ReturnSummary,
} from "~~/types/shopify-operations";

interface CommerceOpsAuth {
  storeId: string;
  token: string;
}

export function useCommerceOpsApi() {
  const post = <T>(url: string, auth: CommerceOpsAuth, body = {}) =>
    $fetch<T>(url, { method: "POST", body: { ...auth, ...body } });

  return {
    listDraftOrders: (auth: CommerceOpsAuth) =>
      post<CommerceListResponse<DraftOrderSummary>>(
        "/api/commerce-ops/draft-orders",
        auth,
      ),
    createDraftOrder: (auth: CommerceOpsAuth, input: DraftOrderCreateInput) =>
      post<{ draftOrder: DraftOrderSummary }>(
        "/api/commerce-ops/draft-orders/create",
        auth,
        { input },
      ),
    runDraftOrderAction: (
      auth: CommerceOpsAuth,
      id: string,
      action: DraftOrderAction,
    ) =>
      post<Record<string, unknown>>("/api/commerce-ops/draft-orders/action", auth, {
        id,
        action,
      }),
    listDiscounts: (auth: CommerceOpsAuth) =>
      post<CommerceListResponse<DiscountSummary>>("/api/commerce-ops/discounts", auth),
    createDiscount: (auth: CommerceOpsAuth, input: DiscountCreateInput) =>
      post<{ id: string }>("/api/commerce-ops/discounts/create", auth, { input }),
    runDiscountAction: (auth: CommerceOpsAuth, id: string, action: DiscountAction) =>
      post<{ id: string }>("/api/commerce-ops/discounts/action", auth, {
        id,
        action,
      }),
    listAbandonedCheckouts: (auth: CommerceOpsAuth) =>
      post<CommerceListResponse<AbandonedCheckoutSummary>>(
        "/api/commerce-ops/abandoned-checkouts",
        auth,
      ),
    listReturns: (auth: CommerceOpsAuth) =>
      post<CommerceListResponse<ReturnSummary>>("/api/commerce-ops/returns", auth),
    runReturnAction: (
      auth: CommerceOpsAuth,
      id: string,
      action: ReturnAction,
      input: ReturnActionInput = {},
    ) =>
      post<{ id: string; status: string }>("/api/commerce-ops/returns/action", auth, {
        id,
        action,
        ...input,
      }),
  };
}
