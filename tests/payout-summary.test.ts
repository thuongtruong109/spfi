import assert from "node:assert/strict";
import test from "node:test";
import type { ShopifyPayoutSummary } from "../types/shopify.ts";
import { addDecimalStrings, sumDecimalStrings } from "../utils/decimal-string.ts";
import { buildPayoutSummaryContributions } from "../utils/payout-summary.ts";

function payoutSummary(
  overrides: Partial<ShopifyPayoutSummary> = {},
): ShopifyPayoutSummary {
  return {
    adjustments_fee_amount: "0",
    adjustments_gross_amount: "0",
    advance_fees_amount: "0",
    advance_gross_amount: "0",
    charges_fee_amount: "0",
    charges_gross_amount: "0",
    refunds_fee_amount: "0",
    refunds_gross_amount: "0",
    reserved_funds_fee_amount: "0",
    reserved_funds_gross_amount: "0",
    retried_payouts_fee_amount: "0",
    retried_payouts_gross_amount: "0",
    usdc_rebate_credit_amount: "0",
    ...overrides,
  };
}

test("adds decimal strings without floating-point precision loss", () => {
  assert.equal(addDecimalStrings("9007199254740993.10", "0.20"), "9007199254740993.3");
  assert.equal(sumDecimalStrings(["0.1", "0.2", "-0.3"]), "0");
});

test("includes every Shopify payout summary contribution", () => {
  const rows = buildPayoutSummaryContributions(
    payoutSummary({
      charges_gross_amount: "100.00",
      refunds_gross_amount: "-10.00",
      adjustments_gross_amount: "2.00",
      advance_gross_amount: "3.00",
      reserved_funds_gross_amount: "-4.00",
      retried_payouts_gross_amount: "5.00",
      usdc_rebate_credit_amount: "0.50",
      charges_fee_amount: "1.00",
      refunds_fee_amount: "0.25",
      adjustments_fee_amount: "0.10",
      advance_fees_amount: "0.15",
      reserved_funds_fee_amount: "0.20",
      retried_payouts_fee_amount: "0.30",
    }),
  );

  assert.deepEqual(
    rows.map(({ category, amount, negative }) => ({
      category,
      amount,
      negative,
    })),
    [
      { category: "charges", amount: "100.00", negative: false },
      { category: "refunds", amount: "-10.00", negative: true },
      { category: "adjustments", amount: "2.00", negative: false },
      { category: "advances", amount: "3.00", negative: false },
      { category: "reservedFunds", amount: "-4.00", negative: true },
      { category: "retriedPayouts", amount: "5.00", negative: false },
      { category: "usdcRebateCredit", amount: "0.50", negative: false },
      { category: "fees", amount: "-2", negative: true },
    ],
  );
});

test("preserves a fee credit as a positive payout contribution", () => {
  const rows = buildPayoutSummaryContributions(
    payoutSummary({
      charges_fee_amount: "0.10",
      refunds_fee_amount: "-0.25",
      adjustments_fee_amount: "0.05",
    }),
  );

  assert.deepEqual(rows, [{ category: "fees", amount: "0.1", negative: false }]);
});
