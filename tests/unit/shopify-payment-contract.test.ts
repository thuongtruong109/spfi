import { afterEach, describe, expect, it, vi } from "vitest";
import { callShopifyPaginatedApiPage } from "~~/server/utils/callShopifyPaginatedApi";
import { normalizeShopifyBalanceTransaction } from "~~/server/utils/shopify-payment-normalization";

const request = vi.hoisted(() => vi.fn());
vi.mock("~~/server/utils/callShopifyApi", () => ({
  callShopifyApiWithResponse: request,
  createApiErrorFromMessage: vi.fn(),
}));

function fetchPage() {
  return callShopifyPaginatedApiPage({
    event: {} as never,
    storeId: "shop-a",
    token: "secret-access-token",
    path: "/shopify_payments/balance/transactions.json",
    resourceKey: "transactions",
    mapItem: normalizeShopifyBalanceTransaction,
  });
}

describe("Shopify payment response contracts", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([null, [], {}, { transactions: null }, { transactions: {} }])(
    "returns a structured 502 for a malformed response envelope: %j",
    async (data) => {
      const log = vi.spyOn(console, "warn").mockImplementation(() => {});
      request.mockResolvedValue({
        data,
        headers: { "x-request-id": "shopify-request-123" },
      });

      await expect(fetchPage()).rejects.toMatchObject({
        statusCode: 502,
        data: {
          error: {
            code: "SHOPIFY_RESPONSE_CONTRACT_ERROR",
            details: { field: "transactions", requestId: "shopify-request-123" },
          },
        },
      });
      expect(log).toHaveBeenCalledExactlyOnceWith("Shopify response schema mismatch", {
        code: "SHOPIFY_RESPONSE_CONTRACT_ERROR",
        requestId: "shopify-request-123",
        resource: "transactions",
        field: "transactions",
        expected: "an array",
      });
    },
  );

  it("logs only schema metadata and the upstream request ID for malformed items", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    request.mockResolvedValue({
      data: {
        transactions: [
          { processed_at: "sensitive-payload-value", token: "secret-access-token" },
        ],
      },
      headers: {
        "x-request-id": "shopify-request-456",
        authorization: "secret-access-token",
      },
    });

    await expect(fetchPage()).rejects.toMatchObject({ statusCode: 502 });
    expect(log).toHaveBeenCalledExactlyOnceWith("Shopify response schema mismatch", {
      code: "SHOPIFY_RESPONSE_CONTRACT_ERROR",
      requestId: "shopify-request-456",
      resource: "transactions",
      field: "processed_at",
      expected: "an ISO-8601 date string",
      itemIndex: 0,
    });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(
      /secret-access-token|sensitive-payload-value|authorization/,
    );
  });

  it.each([undefined, "bad\nrequest-id"])(
    "generates a correlation ID when Shopify supplies no usable ID",
    async (requestId) => {
      const log = vi.spyOn(console, "warn").mockImplementation(() => {});
      request.mockResolvedValue({
        data: { transactions: [null] },
        headers: { "x-request-id": requestId },
      });
      await expect(fetchPage()).rejects.toMatchObject({
        data: {
          error: { details: { requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) } },
        },
      });
      expect(log).toHaveBeenCalledTimes(1);
    },
  );

  it("accepts a successfully loaded empty transaction page without a warning", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    request.mockResolvedValue({ data: { transactions: [] }, headers: {} });
    await expect(fetchPage()).resolves.toMatchObject({
      items: [],
      pageInfo: { hasNextPage: false },
    });
    expect(log).not.toHaveBeenCalled();
  });
});
