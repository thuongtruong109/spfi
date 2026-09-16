import Papa from "papaparse";
import type { DashboardAggregate, DashboardMoney } from "~~/types/dashboard";

export type DashboardExportFormat = "csv" | "json" | "tsv" | "html";

export function useDashboardExport() {
  function exportDashboard(
    dashboard: DashboardAggregate,
    format: DashboardExportFormat,
    filterDescription = "All stores and currencies",
  ) {
    const timestamp = new Date();
    const fileStamp = timestamp.toISOString().replace(/[:.]/g, "-");
    const baseName = `spfi-dashboard-${fileStamp}`;
    const rows = buildStoreRows(dashboard);

    if (format === "json") {
      download(
        `${baseName}.json`,
        JSON.stringify(
          {
            exportedAt: timestamp.toISOString(),
            filter: filterDescription,
            summary: {
              revenue: dashboard.revenue,
              customerCount: dashboard.customerCount,
              productCount: dashboard.productCount,
              userCount: dashboard.userCount,
              pendingFulfillmentCount: dashboard.pendingFulfillmentCount,
              payments: dashboard.payments,
              traffic: dashboard.traffic,
            },
            stores: dashboard.stores,
            failures: dashboard.failures,
          },
          null,
          2,
        ),
        "application/json;charset=utf-8",
      );
      return;
    }

    if (format === "html") {
      download(
        `${baseName}.html`,
        buildHtmlReport(dashboard, rows, filterDescription, timestamp),
        "text/html;charset=utf-8",
      );
      return;
    }

    const delimiter = format === "tsv" ? "\t" : ",";
    const content = Papa.unparse(rows, {
      delimiter,
      escapeFormulae: true,
      header: true,
      newline: "\r\n",
    });
    download(
      `${baseName}.${format}`,
      `\uFEFF${content}`,
      format === "tsv"
        ? "text/tab-separated-values;charset=utf-8"
        : "text/csv;charset=utf-8",
    );
  }

  return { exportDashboard };
}

function buildStoreRows(dashboard: DashboardAggregate) {
  return dashboard.stores.map((store) => ({
    store_id: store.storeId,
    store_name: store.storeName,
    domain: store.domain,
    plan: store.plan,
    revenue_today: moneyText(store.revenue.today),
    revenue_week: moneyText(store.revenue.week),
    revenue_month: moneyText(store.revenue.month),
    month_orders: store.revenue.orderCountMonth,
    pending_fulfillments: store.pendingFulfillments.count,
    customers: store.customerCount,
    products: store.productCount,
    payment_balance: moneyText(store.payments.balance),
    month_transactions: store.payments.transactions.count,
    pending_payouts: store.payments.payouts.pendingCount,
    users: store.users.length,
    sessions_today: store.traffic.today.sessions,
    visitors_today: store.traffic.today.visitors,
    pageviews_today: store.traffic.today.pageviews,
    sessions_7_days: store.traffic.last7Days.sessions,
    visitors_7_days: store.traffic.last7Days.visitors,
    sessions_30_days: store.traffic.last30Days.sessions,
    visitors_30_days: store.traffic.last30Days.visitors,
    warnings: store.warnings.map((warning) => warning.message).join(" | "),
    generated_at: store.generatedAt,
  }));
}

function buildHtmlReport(
  dashboard: DashboardAggregate,
  rows: ReturnType<typeof buildStoreRows>,
  filterDescription: string,
  timestamp: Date,
) {
  const tableRows = rows
    .map(
      (row) => `<tr>
        <td><strong>${escapeHtml(row.store_name)}</strong><small>${escapeHtml(row.domain)}</small></td>
        <td>${escapeHtml(row.revenue_today)}</td>
        <td>${escapeHtml(row.revenue_month)}</td>
        <td>${row.month_orders}</td>
        <td>${row.pending_fulfillments}</td>
        <td>${row.customers}</td>
        <td>${row.sessions_today}</td>
        <td>${row.visitors_today}</td>
        <td>${escapeHtml(row.payment_balance)}</td>
        <td>${row.users}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Spfi Dashboard Report</title>
  <style>
    body{margin:0;padding:40px;background:#f5f7f4;color:#14221b;font:14px/1.5 Arial,sans-serif}
    main{max-width:1200px;margin:auto}.hero{padding:28px;border-radius:18px;background:#dff4e8}
    h1{margin:0 0 6px;font-size:32px}.meta{color:#65756c}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}
    .metric{padding:14px;border:1px solid #d9e4dd;border-radius:12px;background:#fff}.metric span,small{display:block;color:#65756c;font-size:11px}.metric strong{font-size:20px}
    table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:11px;border-bottom:1px solid #d9e4dd;text-align:left}th{background:#eef4f0;font-size:11px}td small{margin-top:2px}
    @media(max-width:760px){body{padding:16px}.metrics{grid-template-columns:repeat(2,1fr)}table{font-size:11px}}
    @media print{body{padding:0;background:#fff}.hero,.metric{break-inside:avoid}}
  </style>
</head>
<body><main>
  <section class="hero"><h1>All-store dashboard</h1><div class="meta">${escapeHtml(filterDescription)} · Exported ${escapeHtml(timestamp.toLocaleString())}</div></section>
  <section class="metrics">
    <div class="metric"><span>Revenue today</span><strong>${escapeHtml(moneyText(dashboard.revenue.today))}</strong></div>
    <div class="metric"><span>Revenue month</span><strong>${escapeHtml(moneyText(dashboard.revenue.month))}</strong></div>
    <div class="metric"><span>Pending fulfillment</span><strong>${dashboard.pendingFulfillmentCount}</strong></div>
    <div class="metric"><span>Sessions today</span><strong>${dashboard.traffic.today.sessions}</strong></div>
  </section>
  <table><thead><tr><th>Store</th><th>Today</th><th>Month</th><th>Orders</th><th>Pending</th><th>Customers</th><th>Sessions</th><th>Visitors</th><th>Balance</th><th>Users</th></tr></thead><tbody>${tableRows}</tbody></table>
</main></body></html>`;
}

function moneyText(rows: DashboardMoney[]) {
  return rows.length
    ? rows.map((row) => `${row.currency} ${row.amount.toFixed(2)}`).join(" | ")
    : "—";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
