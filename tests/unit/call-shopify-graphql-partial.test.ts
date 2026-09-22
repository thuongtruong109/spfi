import { describe, expect, it } from "vitest";
import { createShopifyGraphqlPartialResponse } from "~~/server/utils/callShopifyGraphql";

describe("Shopify GraphQL partial responses", () => {
  it("retains errors and maps their top-level paths to failed aliases", () => {
    const response = createShopifyGraphqlPartialResponse(
      {
        daily: { tableData: { rows: [] } },
        sources7Days: null,
      },
      [
        {
          message: "Response too large",
          path: ["sources7Days", "tableData"],
          extensions: { code: "RESPONSE_TOO_LARGE" },
        },
      ],
    );

    expect(response).toEqual({
      data: {
        daily: { tableData: { rows: [] } },
        sources7Days: null,
      },
      errors: [
        {
          message: "Response too large",
          path: ["sources7Days", "tableData"],
          extensions: { code: "RESPONSE_TOO_LARGE" },
        },
      ],
      availability: {
        daily: "available",
        sources7Days: "failed",
      },
    });
  });

  it("uses null aliases for Shopify errors that omit a path", () => {
    const response = createShopifyGraphqlPartialResponse(
      { daily: { tableData: { rows: [] } }, sources7Days: null },
      [{ message: "Response too large" }],
    );

    expect(response?.availability).toEqual({
      daily: "available",
      sources7Days: "failed",
    });
  });

  it("fails closed when an error cannot be attributed to an alias", () => {
    expect(
      createShopifyGraphqlPartialResponse({ daily: { tableData: { rows: [] } } }, [
        { message: "Unknown partial failure" },
      ]),
    ).toBeNull();
  });
});
