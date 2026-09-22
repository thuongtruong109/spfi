import type {
  DashboardMoney,
  DashboardReconciliation,
  DashboardReconciliationRow,
} from "~~/types/dashboard";
import {
  addMoneyAmount,
  moneyRowsFromMap,
  roundMoneyAmount,
  type DashboardMoneyAccumulator,
} from "./dashboard-money.ts";
import { subtractDecimalStrings } from "./decimal-string.ts";

export function buildDashboardReconciliation(
  orderTotals: DashboardMoney[],
  paymentGross: DashboardMoney[],
  available: boolean,
  dataAsOf: string | null,
): DashboardReconciliation {
  if (!available) return emptyDashboardReconciliation();

  const orders = moneyMap(orderTotals);
  const payments = moneyMap(paymentGross);
  const currencies = new Set([...orders.keys(), ...payments.keys()]);
  const rows = [...currencies]
    .map((currency): DashboardReconciliationRow => {
      const orderTotal = orders.get(currency) || 0;
      const transactionGross = payments.get(currency) || 0;
      const difference = roundMoneyAmount(
        Number(subtractDecimalStrings(String(transactionGross), String(orderTotal))),
        currency,
      );
      return {
        currency,
        orderTotal,
        paymentGross: transactionGross,
        difference,
        status: difference === 0 ? "matched" : "mismatch",
      };
    })
    .sort(
      (left, right) =>
        Math.abs(right.difference) - Math.abs(left.difference) ||
        left.currency.localeCompare(right.currency),
    );

  return { available: true, dataAsOf, rows };
}

export function aggregateDashboardReconciliations(
  reconciliations: DashboardReconciliation[],
): DashboardReconciliation {
  const available = reconciliations.filter((item) => item.available);
  if (!available.length) return emptyDashboardReconciliation();

  const orders: DashboardMoneyAccumulator = new Map();
  const payments: DashboardMoneyAccumulator = new Map();
  for (const reconciliation of available) {
    for (const row of reconciliation.rows) {
      addMoneyAmount(orders, row.currency, row.orderTotal);
      addMoneyAmount(payments, row.currency, row.paymentGross);
    }
  }

  return buildDashboardReconciliation(
    moneyRowsFromMap(orders),
    moneyRowsFromMap(payments),
    true,
    oldestTimestamp(available.map((item) => item.dataAsOf)),
  );
}

export function emptyDashboardReconciliation(): DashboardReconciliation {
  return { available: false, dataAsOf: null, rows: [] };
}

function moneyMap(rows: DashboardMoney[]) {
  return new Map(rows.map((row) => [row.currency, row.amount]));
}

function oldestTimestamp(values: Array<string | null>) {
  const valid = values.filter(
    (value): value is string => Boolean(value) && Number.isFinite(Date.parse(value!)),
  );
  return valid.sort((left, right) => Date.parse(left) - Date.parse(right))[0] || null;
}
