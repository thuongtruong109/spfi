import type { ShopifyPayoutSummary } from "~~/types/shopify";
import {
  compareDecimalStrings,
  negateDecimalString,
  sumDecimalStrings,
} from "./decimal-string.ts";

export type PayoutSummaryCategory =
  | "charges"
  | "refunds"
  | "adjustments"
  | "advances"
  | "reservedFunds"
  | "retriedPayouts"
  | "usdcRebateCredit"
  | "fees";

export interface PayoutSummaryContribution {
  category: PayoutSummaryCategory;
  amount: string;
  negative: boolean;
}

export function buildPayoutSummaryContributions(
  summary: ShopifyPayoutSummary,
): PayoutSummaryContribution[] {
  const contributions: Array<[PayoutSummaryCategory, string]> = [
    ["charges", summary.charges_gross_amount],
    ["refunds", summary.refunds_gross_amount],
    ["adjustments", summary.adjustments_gross_amount],
    ["advances", summary.advance_gross_amount || "0"],
    ["reservedFunds", summary.reserved_funds_gross_amount],
    ["retriedPayouts", summary.retried_payouts_gross_amount],
    ["usdcRebateCredit", summary.usdc_rebate_credit_amount || "0"],
  ];
  const fees = negateDecimalString(
    sumDecimalStrings([
      summary.charges_fee_amount,
      summary.refunds_fee_amount,
      summary.adjustments_fee_amount,
      summary.advance_fees_amount || "0",
      summary.reserved_funds_fee_amount,
      summary.retried_payouts_fee_amount,
    ]),
  );
  contributions.push(["fees", fees]);

  return contributions
    .filter(([, amount]) => compareDecimalStrings(amount, "0") !== 0)
    .map(([category, amount]) => ({
      category,
      amount,
      negative: compareDecimalStrings(amount, "0") < 0,
    }));
}
