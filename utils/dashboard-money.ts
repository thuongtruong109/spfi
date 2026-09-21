import type { DashboardMoney } from "~~/types/dashboard";
import { getCurrencyFractionDigits } from "./order.ts";
import { addDecimalStrings } from "./decimal-string.ts";

export type DashboardMoneyAccumulator = Map<string, string>;

export function addMoneyAmount(
  target: DashboardMoneyAccumulator,
  currency: string,
  amount: string | number,
) {
  target.set(
    currency,
    addDecimalStrings(target.get(currency) || "0", normalizeDecimalAmount(amount)),
  );
}

export function roundMoneyAmount(value: number, currency?: string) {
  const factor = 10 ** (getCurrencyFractionDigits(currency) ?? 2);
  const rounded = Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor;
  return value < 0 ? -rounded : rounded;
}

export function moneyRowsFromMap(source?: DashboardMoneyAccumulator): DashboardMoney[] {
  if (!source) return [];

  return [...source.entries()]
    .map(([currency, amount]) => ({
      currency,
      amount: roundMoneyAmount(Number(amount), currency),
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

function normalizeDecimalAmount(value: string | number) {
  const normalized = String(value ?? "0").trim();
  return /^-?\d+(?:\.\d+)?$/.test(normalized) ? normalized : "0";
}
