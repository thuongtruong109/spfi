import type {
  DashboardAggregate,
  DashboardMoney,
  DashboardPayoutSummary,
  DashboardRevenuePoint,
  DashboardRevenueSummary,
  DashboardStoreFailure,
  DashboardTransactionSummary,
  StoreDashboardSnapshot,
} from "~~/types/dashboard";
import { moneyRowsFromMap } from "./dashboard-money.ts";
import { aggregateDashboardTraffic } from "./dashboard-traffic.ts";

export function aggregateDashboardSnapshots(
  stores: StoreDashboardSnapshot[],
  failures: DashboardStoreFailure[] = [],
): DashboardAggregate {
  const today = new Map<string, number>();
  const week = new Map<string, number>();
  const month = new Map<string, number>();
  const balance = new Map<string, number>();
  const payoutTotal = new Map<string, number>();
  const payoutPending = new Map<string, number>();
  const transactionGross = new Map<string, number>();
  const transactionFees = new Map<string, number>();
  const transactionNet = new Map<string, number>();
  const revenueCounts = new Map<
    string,
    { today: number; week: number; month: number }
  >();
  const payoutCounts = new Map<
    string,
    { count: number; pendingCount: number; paidCount: number; failedCount: number }
  >();
  const transactionCounts = new Map<string, number>();
  const daily = new Map<
    string,
    {
      orders: number;
      orderCounts: Map<string, number>;
      money: Map<string, number>;
    }
  >();
  let orderCountToday = 0;
  let orderCountWeek = 0;
  let orderCountMonth = 0;
  let customerCount = 0;
  let productCount = 0;
  let userCount = 0;
  let pendingFulfillmentCount = 0;
  let availableStores = 0;
  const fulfillmentBreakdown = {
    fulfilled: 0,
    partial: 0,
    unfulfilled: 0,
  };
  const payouts: DashboardPayoutSummary = {
    count: 0,
    pendingCount: 0,
    paidCount: 0,
    failedCount: 0,
    currencyCounts: [],
    total: [],
    pending: [],
  };
  const transactions: DashboardTransactionSummary = {
    count: 0,
    currencyCounts: [],
    gross: [],
    fees: [],
    net: [],
    recent: [],
  };

  for (const store of stores) {
    addMoneyRows(today, store.revenue.today);
    addMoneyRows(week, store.revenue.week);
    addMoneyRows(month, store.revenue.month);
    orderCountToday += store.revenue.orderCountToday;
    orderCountWeek += store.revenue.orderCountWeek;
    orderCountMonth += store.revenue.orderCountMonth;
    for (const row of store.revenue.currencyCounts) {
      const counts = revenueCounts.get(row.currency) || {
        today: 0,
        week: 0,
        month: 0,
      };
      counts.today += row.today;
      counts.week += row.week;
      counts.month += row.month;
      revenueCounts.set(row.currency, counts);
    }
    customerCount += store.customerCount;
    productCount += store.productCount;
    userCount += store.users.length;
    pendingFulfillmentCount += store.pendingFulfillments.count;
    fulfillmentBreakdown.fulfilled += store.fulfillmentBreakdown.fulfilled;
    fulfillmentBreakdown.partial += store.fulfillmentBreakdown.partial;
    fulfillmentBreakdown.unfulfilled += store.fulfillmentBreakdown.unfulfilled;

    for (const point of store.revenue.daily) {
      const entry = daily.get(point.date) || {
        orders: 0,
        orderCounts: new Map<string, number>(),
        money: new Map<string, number>(),
      };
      entry.orders += point.orders;
      addCountRows(entry.orderCounts, point.orderCounts);
      addMoneyRows(entry.money, point.values);
      daily.set(point.date, entry);
    }

    if (store.payments.available) availableStores += 1;
    addMoneyRows(balance, store.payments.balance);
    payouts.count += store.payments.payouts.count;
    payouts.pendingCount += store.payments.payouts.pendingCount;
    payouts.paidCount += store.payments.payouts.paidCount;
    payouts.failedCount += store.payments.payouts.failedCount;
    for (const row of store.payments.payouts.currencyCounts) {
      const counts = payoutCounts.get(row.currency) || {
        count: 0,
        pendingCount: 0,
        paidCount: 0,
        failedCount: 0,
      };
      counts.count += row.count;
      counts.pendingCount += row.pendingCount;
      counts.paidCount += row.paidCount;
      counts.failedCount += row.failedCount;
      payoutCounts.set(row.currency, counts);
    }
    addMoneyRows(payoutTotal, store.payments.payouts.total);
    addMoneyRows(payoutPending, store.payments.payouts.pending);
    transactions.count += store.payments.transactions.count;
    addCountRows(transactionCounts, store.payments.transactions.currencyCounts);
    addMoneyRows(transactionGross, store.payments.transactions.gross);
    addMoneyRows(transactionFees, store.payments.transactions.fees);
    addMoneyRows(transactionNet, store.payments.transactions.net);
  }

  const revenue: DashboardRevenueSummary = {
    today: moneyRowsFromMap(today),
    week: moneyRowsFromMap(week),
    month: moneyRowsFromMap(month),
    orderCountToday,
    orderCountWeek,
    orderCountMonth,
    currencyCounts: [...revenueCounts.entries()]
      .map(([currency, counts]) => ({ currency, ...counts }))
      .sort((a, b) => b.month - a.month || a.currency.localeCompare(b.currency)),
    daily: [...daily.entries()]
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, entry]): DashboardRevenuePoint => ({
        date,
        orders: entry.orders,
        orderCounts: countRows(entry.orderCounts),
        values: moneyRowsFromMap(entry.money),
      })),
  };

  return {
    stores,
    failures,
    revenue,
    topProducts: stores
      .flatMap((store) =>
        store.topProducts.map((product) => ({
          ...product,
          key: `${store.storeId}:${product.key}`,
          storeId: store.storeId,
          storeName: store.storeName,
        })),
      )
      .sort((a, b) => b.units - a.units || b.orders - a.orders)
      .slice(0, 10),
    pendingOrders: stores
      .flatMap((store) =>
        store.pendingFulfillments.orders.map((order) => ({
          ...order,
          storeId: store.storeId,
          storeName: store.storeName,
        })),
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, 12),
    recentTransactions: stores
      .flatMap((store) =>
        store.payments.transactions.recent.map((transaction) => ({
          ...transaction,
          storeId: store.storeId,
          storeName: store.storeName,
        })),
      )
      .sort(
        (a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime(),
      )
      .slice(0, 12),
    customerCount,
    productCount,
    userCount,
    pendingFulfillmentCount,
    fulfillmentBreakdown,
    payments: {
      availableStores,
      balance: moneyRowsFromMap(balance),
      payouts: {
        ...payouts,
        currencyCounts: [...payoutCounts.entries()]
          .map(([currency, counts]) => ({ currency, ...counts }))
          .sort((a, b) => b.count - a.count || a.currency.localeCompare(b.currency)),
        total: moneyRowsFromMap(payoutTotal),
        pending: moneyRowsFromMap(payoutPending),
      },
      transactions: {
        ...transactions,
        currencyCounts: countRows(transactionCounts),
        gross: moneyRowsFromMap(transactionGross),
        fees: moneyRowsFromMap(transactionFees),
        net: moneyRowsFromMap(transactionNet),
        recent: [],
      },
    },
    traffic: aggregateDashboardTraffic(stores.map((store) => store.traffic)),
  };
}

export function filterDashboardAggregateCurrency(
  dashboard: DashboardAggregate,
  currency: string,
): DashboardAggregate {
  const normalizedCurrency = currency.trim().toUpperCase();
  if (!normalizedCurrency || normalizedCurrency === "ALL") return dashboard;
  const stores = dashboard.stores.map((store) =>
    filterStoreSnapshotCurrency(store, normalizedCurrency),
  );

  return aggregateDashboardSnapshots(stores, dashboard.failures);
}

function filterStoreSnapshotCurrency(
  store: StoreDashboardSnapshot,
  currency: string,
): StoreDashboardSnapshot {
  const filterMoney = (rows: DashboardMoney[]) =>
    rows.filter((row) => row.currency === currency);
  const revenueCount = store.revenue.currencyCounts.find(
    (row) => row.currency === currency,
  );
  const pendingCount = getCurrencyCount(
    store.pendingFulfillments.currencyCounts,
    currency,
  );
  const payoutCount = store.payments.payouts.currencyCounts.find(
    (row) => row.currency === currency,
  );
  const transactionCount = getCurrencyCount(
    store.payments.transactions.currencyCounts,
    currency,
  );
  const storeUsesCurrency = store.currency === currency;

  return {
    ...store,
    revenue: {
      today: filterMoney(store.revenue.today),
      week: filterMoney(store.revenue.week),
      month: filterMoney(store.revenue.month),
      orderCountToday: revenueCount?.today || 0,
      orderCountWeek: revenueCount?.week || 0,
      orderCountMonth: revenueCount?.month || 0,
      currencyCounts: revenueCount ? [revenueCount] : [],
      daily: store.revenue.daily.map((point) => {
        const orders = getCurrencyCount(point.orderCounts, currency);
        return {
          ...point,
          orders,
          orderCounts: orders ? [{ currency, count: orders }] : [],
          values: filterMoney(point.values),
        };
      }),
    },
    fulfillmentBreakdown: storeUsesCurrency
      ? store.fulfillmentBreakdown
      : { fulfilled: 0, partial: 0, unfulfilled: 0 },
    pendingFulfillments: {
      count: pendingCount,
      currencyCounts: pendingCount ? [{ currency, count: pendingCount }] : [],
      orders: store.pendingFulfillments.orders.filter(
        (order) => order.currency === currency,
      ),
    },
    topProducts: store.topProducts
      .flatMap((product) => {
        const stats = product.currencyStats.find((row) => row.currency === currency);
        if (!stats) return [];
        return [
          {
            ...product,
            units: stats.units,
            orders: stats.count,
            currencyStats: [stats],
            revenue: filterMoney(product.revenue),
          },
        ];
      })
      .sort((a, b) => b.units - a.units || b.orders - a.orders)
      .slice(0, 10),
    payments: {
      available:
        store.payments.available && store.payments.currencies.includes(currency),
      currencies: store.payments.currencies.includes(currency) ? [currency] : [],
      balance: filterMoney(store.payments.balance),
      payouts: {
        count: payoutCount?.count || 0,
        pendingCount: payoutCount?.pendingCount || 0,
        paidCount: payoutCount?.paidCount || 0,
        failedCount: payoutCount?.failedCount || 0,
        currencyCounts: payoutCount ? [payoutCount] : [],
        total: filterMoney(store.payments.payouts.total),
        pending: filterMoney(store.payments.payouts.pending),
      },
      transactions: {
        count: transactionCount,
        currencyCounts: transactionCount ? [{ currency, count: transactionCount }] : [],
        gross: filterMoney(store.payments.transactions.gross),
        fees: filterMoney(store.payments.transactions.fees),
        net: filterMoney(store.payments.transactions.net),
        recent: store.payments.transactions.recent.filter(
          (transaction) => transaction.currency === currency,
        ),
      },
    },
  };
}

function addMoneyRows(target: Map<string, number>, rows: DashboardMoney[]) {
  for (const row of rows) {
    target.set(row.currency, (target.get(row.currency) || 0) + row.amount);
  }
}

function addCountRows(
  target: Map<string, number>,
  rows: Array<{ currency: string; count: number }>,
) {
  for (const row of rows) {
    target.set(row.currency, (target.get(row.currency) || 0) + row.count);
  }
}

function getCurrencyCount(
  rows: Array<{ currency: string; count: number }>,
  currency: string,
) {
  return rows.find((row) => row.currency === currency)?.count || 0;
}

function countRows(source: Map<string, number>) {
  return [...source.entries()]
    .map(([currency, count]) => ({ currency, count }))
    .sort((a, b) => b.count - a.count || a.currency.localeCompare(b.currency));
}
