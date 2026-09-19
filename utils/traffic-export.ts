import type {
  DashboardTrafficPoint,
  DashboardTrafficRangeData,
} from "~~/types/dashboard";

export interface TrafficExportLabels {
  title: string;
  range: string;
  exportedAt: string;
  sessions: string;
  visitors: string;
  pageviews: string;
  bounceRate: string;
  conversionRate: string;
  averageDuration: string;
  trend: string;
  sources: string;
  countries: string;
  devices: string;
  details: string;
  dimension: string;
}

export interface TrafficExportInput {
  data: DashboardTrafficRangeData;
  points: DashboardTrafficPoint[];
  rangeLabel: string;
  exportedAt: Date;
  labels: TrafficExportLabels;
}

export function buildTrafficExportPayload(input: TrafficExportInput) {
  return {
    exportedAt: input.exportedAt.toISOString(),
    range: input.rangeLabel,
    metrics: input.data.metrics,
    availability: input.data.availability,
    trend: input.points,
    breakdowns: {
      sources: input.data.sources,
      countries: input.data.countries,
      devices: input.data.devices,
    },
    dimensions: input.data.dimensions,
  };
}

export function buildTrafficHtmlReport(input: TrafficExportInput) {
  const { data, labels } = input;
  const metricCards = [
    [labels.sessions, formatNumber(data.metrics.sessions)],
    [labels.visitors, formatNumber(data.metrics.visitors)],
    [labels.pageviews, formatNumber(data.metrics.pageviews)],
    [labels.bounceRate, formatPercent(data.metrics.bounceRate)],
    [labels.conversionRate, formatPercent(data.metrics.conversionRate)],
    [labels.averageDuration, formatDuration(data.metrics.averageSessionDuration)],
  ]
    .map(
      ([label, value]) =>
        `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`,
    )
    .join("");

  const trendRows = input.points
    .map(
      (point) =>
        `<tr><td>${escapeHtml(point.period)}</td><td>${formatNumber(point.sessions)}</td><td>${formatNumber(point.visitors)}</td><td>${formatNumber(point.pageviews)}</td></tr>`,
    )
    .join("");
  const breakdowns = [
    [labels.sources, data.sources],
    [labels.countries, data.countries],
    [labels.devices, data.devices],
  ]
    .map(
      ([title, rows]) =>
        `<section class="card"><h2>${escapeHtml(title)}</h2>${buildBreakdownTable(
          rows as DashboardTrafficRangeData["sources"],
          labels,
        )}</section>`,
    )
    .join("");
  const dimensionTables = Object.entries(data.dimensions)
    .flatMap(([dimension, result]) => {
      if (!result) return [];
      const rows = result.rows
        .map(
          (row) => `<tr>
            <td>${escapeHtml(row.label)}</td><td>${formatNumber(row.sessions)}</td><td>${formatNumber(row.visitors)}</td><td>${formatNumber(row.pageviews)}</td><td>${formatPercent(row.bounceRate)}</td><td>${formatPercent(row.conversionRate)}</td>
          </tr>`,
        )
        .join("");
      const count = `${result.rows.length}${result.hasMore ? "+" : ""}`;
      return [
        `<section class="wide"><h2>${escapeHtml(labels.details)} · ${escapeHtml(dimension)} <small>${escapeHtml(count)}</small></h2><table><thead><tr><th>${escapeHtml(labels.dimension)}</th><th>${escapeHtml(labels.sessions)}</th><th>${escapeHtml(labels.visitors)}</th><th>${escapeHtml(labels.pageviews)}</th><th>${escapeHtml(labels.bounceRate)}</th><th>${escapeHtml(labels.conversionRate)}</th></tr></thead><tbody>${rows}</tbody></table></section>`,
      ];
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(labels.title)} · ${escapeHtml(input.rangeLabel)}</title>
  <style>
    :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;padding:36px;background:#f4f7f5;color:#16221b;font:14px/1.5 Inter,Arial,sans-serif}main{max-width:1240px;margin:auto}.hero{padding:26px;border-radius:18px;background:linear-gradient(135deg,#dff5e8,#eef7ff)}h1,h2{margin:0}h1{font-size:30px}.meta{margin-top:5px;color:#607068}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.metric,.card{padding:15px;border:1px solid #d9e4dd;border-radius:13px;background:#fff}.metric span{display:block;color:#607068;font-size:11px;text-transform:uppercase}.metric strong{font-size:22px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:12px 0}.card{overflow:auto}.card h2{margin-bottom:10px;font-size:15px}table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:9px;border-bottom:1px solid #e3ebe6;text-align:right;white-space:nowrap}th{background:#eef4f0;color:#607068;font-size:10px;text-transform:uppercase}th:first-child,td:first-child{text-align:left}.wide{margin-top:12px;overflow:auto;border:1px solid #d9e4dd;border-radius:13px;background:#fff}.wide h2{padding:15px 15px 0;font-size:15px}@media(max-width:800px){body{padding:16px}.metrics,.grid{grid-template-columns:1fr 1fr}}@media(max-width:520px){.metrics,.grid{grid-template-columns:1fr}}@media print{body{padding:0;background:#fff}.hero,.metric,.card{break-inside:avoid}}
  </style>
</head>
<body><main>
  <header class="hero"><h1>${escapeHtml(labels.title)}</h1><div class="meta">${escapeHtml(input.rangeLabel)} · ${escapeHtml(labels.exportedAt)} ${escapeHtml(input.exportedAt.toLocaleString())}</div></header>
  <section class="metrics">${metricCards}</section>
  <section class="wide"><h2>${escapeHtml(labels.trend)}</h2><table><thead><tr><th>${escapeHtml(labels.range)}</th><th>${escapeHtml(labels.sessions)}</th><th>${escapeHtml(labels.visitors)}</th><th>${escapeHtml(labels.pageviews)}</th></tr></thead><tbody>${trendRows}</tbody></table></section>
  <div class="grid">${breakdowns}</div>
  ${dimensionTables}
</main></body></html>`;
}

function buildBreakdownTable(
  rows: DashboardTrafficRangeData["sources"],
  labels: TrafficExportLabels,
) {
  const body = rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.label)}</td><td>${formatNumber(row.sessions)}</td><td>${formatNumber(row.visitors)}</td></tr>`,
    )
    .join("");
  return `<table><thead><tr><th>${escapeHtml(labels.dimension)}</th><th>${escapeHtml(labels.sessions)}</th><th>${escapeHtml(labels.visitors)}</th></tr></thead><tbody>${body}</tbody></table>`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDuration(value: number) {
  const seconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
