import { describe, expect, it } from "vitest";
import healthHandler from "~~/server/api/health.get";
import {
  hasInvisibleOrControlChars,
  inspectProxyInput,
  maskProxyUrl,
  normalizeProxyUrl,
  resolveStoreAdminDomain,
} from "~~/server/utils/callShopifyApi";
import {
  buildBalanceTransactionSearchQuery,
  buildPayoutSearchQuery,
  mapBalanceTransaction,
  mapPayout,
  normalizeConnectionPage,
} from "~~/server/utils/shopify-payments-graphql";
import { normalizePayoutTransactionCursor } from "~~/server/utils/shopify-payout-detail";

describe("callShopifyApi helpers", () => {
  it("normalizes and masks proxy credentials without changing routing data", () => {
    expect(normalizeProxyUrl("8.8.8.8:1080:user:p@ss")).toBe(
      "socks5h://user:p%40ss@8.8.8.8:1080",
    );
    expect(maskProxyUrl("socks5h://user:p%40ss@8.8.8.8:1080")).toBe(
      "socks5h://****:****@8.8.8.8:1080",
    );
    expect(inspectProxyInput("8.8.8.8:1080:user:p@ss")).toMatchObject({
      segmentCount: 4,
      usernameLength: 4,
      passwordLength: 4,
    });
    expect(resolveStoreAdminDomain("custom.example", "shop-a.myshopify.com")).toBe(
      "shop-a.myshopify.com",
    );
  });

  it("detects invisible proxy characters consistently across repeated calls", () => {
    const input = "socks5h://user:pass@8.8.8.8:1080\u200B";

    expect(hasInvisibleOrControlChars(input)).toBe(true);
    expect(hasInvisibleOrControlChars(input)).toBe(true);
    expect(inspectProxyInput(input).hasInvisibleChars).toBe(true);
    expect(inspectProxyInput(input).hasInvisibleChars).toBe(true);
  });
});

describe("Shopify Payments GraphQL mapping", () => {
  it("keeps 64-bit IDs lossless in filters and mapped transactions", () => {
    const hugeId = "18446744073709551615";
    expect(
      buildBalanceTransactionSearchQuery({
        since_id: hugeId,
        last_id: "18446744073709551616",
      }),
    ).toBe(`id:>${hugeId} id:<18446744073709551616`);

    const mapped = mapBalanceTransaction({
      id: `gid://shopify/ShopifyPaymentsBalanceTransaction/${hugeId}`,
      type: "CHARGE",
      test: false,
      associatedPayout: { id: null, status: null },
      amount: { amount: "10.00", currencyCode: "USD" },
      fee: { amount: "1.00", currencyCode: "USD" },
      net: { amount: "9.00", currencyCode: "USD" },
      sourceId: hugeId,
      sourceType: "charge",
      sourceOrderTransactionId: "18446744073709551614",
      associatedOrder: {
        id: "gid://shopify/Order/18446744073709551613",
        name: "#1001",
      },
      adjustmentsOrders: [],
      adjustmentReason: null,
      transactionDate: "2026-08-10T00:00:00Z",
    });

    expect(mapped.id).toBe(hugeId);
    expect(mapped.source_id).toBe(hugeId);
    expect(mapped.source_order_id).toBe("18446744073709551613");
    expect(mapped.source_order_transaction_id).toBe("18446744073709551614");
  });

  it("builds validated payout search terms and caps connection pages", () => {
    expect(
      buildPayoutSearchQuery({
        date_min: "2026-09-01",
        date_max: "2026-09-30",
        status: "paid",
        since_id: "9007199254740993",
      }),
    ).toBe(
      "issued_at:>=2026-09-01 issued_at:<=2026-09-30 id:>9007199254740993 status:paid",
    );
    expect(normalizeConnectionPage({ first: 1000, after: "cursor" })).toEqual({
      first: 100,
      after: "cursor",
    });
    expect(normalizePayoutTransactionCursor(["rest-cursor"])).toBe("rest-cursor");
  });

  it("maps a GraphQL payout to the existing REST-shaped UI contract", () => {
    const mapped = mapPayout({
      id: "gid://shopify/ShopifyPaymentsPayout/123",
      legacyResourceId: "123",
      externalTraceId: "trace-1",
      issuedAt: "2026-09-17T10:30:00Z",
      transactionType: "DEPOSIT",
      businessEntity: {
        id: "gid://shopify/BusinessEntity/1",
        displayName: "Example LLC",
        companyName: "Example LLC",
        primary: true,
      },
      net: { amount: "42.00", currencyCode: "USD" },
      status: "PAID",
      summary: {
        adjustmentsFee: { amount: "0" },
        adjustmentsGross: { amount: "0" },
        advanceFees: { amount: "0.25" },
        advanceGross: { amount: "4" },
        chargesFee: { amount: "1" },
        chargesGross: { amount: "43" },
        refundsFee: { amount: "0" },
        refundsFeeGross: { amount: "0" },
        reservedFundsFee: { amount: "0" },
        reservedFundsGross: { amount: "0" },
        retriedPayoutsFee: { amount: "0" },
        retriedPayoutsGross: { amount: "0" },
        usdcRebateCreditAmount: { amount: "0.10" },
      },
    });

    expect(mapped.payout).toMatchObject({
      id: "123",
      amount: "42.00",
      currency: "USD",
      date: "2026-09-17",
      status: "paid",
    });
    expect(mapped.metadata.externalTraceId).toBe("trace-1");
    expect(mapped.payout.summary).toMatchObject({
      advance_fees_amount: "0.25",
      advance_gross_amount: "4",
      usdc_rebate_credit_amount: "0.10",
    });
  });
});

describe("API routes", () => {
  it("returns the health response envelope", async () => {
    expect(await healthHandler({} as never)).toEqual({ ok: true });
  });
});
