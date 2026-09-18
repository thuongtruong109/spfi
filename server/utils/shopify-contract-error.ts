import { randomUUID } from "node:crypto";
import { H3Error } from "h3";

export class ShopifyContractError extends H3Error {
  declare data: {
    success: false;
    error: {
      code: string;
      message: string;
      status: number;
      details: { field: string; expected: string; requestId?: string };
    };
  };

  constructor(message: string, field: string, expected: string) {
    super(message);
    this.statusCode = 502;
    this.statusMessage = message;
    this.data = {
      success: false,
      error: {
        code: "SHOPIFY_RESPONSE_CONTRACT_ERROR",
        message,
        status: 502,
        details: { field, expected },
      },
    };
  }
}

export function reportShopifyContractError(
  error: unknown,
  upstreamRequestId: unknown,
  resource: string,
  itemIndex?: number,
) {
  if (!(error instanceof ShopifyContractError)) return;

  const requestId =
    typeof upstreamRequestId === "string" &&
    /^[a-zA-Z0-9._:-]{1,128}$/.test(upstreamRequestId)
      ? upstreamRequestId
      : randomUUID();
  error.data.error.details.requestId = requestId;

  // Only schema metadata is logged: never payloads, request options or tokens.
  console.warn("Shopify response schema mismatch", {
    code: error.data.error.code,
    requestId,
    resource,
    field: error.data.error.details.field,
    expected: error.data.error.details.expected,
    ...(itemIndex !== undefined ? { itemIndex } : {}),
  });
}
