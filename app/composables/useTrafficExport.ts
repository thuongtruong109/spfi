import type {
  DashboardTrafficPoint,
  DashboardTrafficRange,
  DashboardTrafficRangeData,
} from "~~/types/dashboard";
import {
  buildTrafficExportPayload,
  buildTrafficHtmlReport,
  type TrafficExportInput,
  type TrafficExportLabels,
} from "~~/utils/traffic-export";
import { DASHBOARD_TRAFFIC_DIMENSION_LABEL_KEYS } from "~~/utils/dashboard-traffic-dimensions";
import { DASHBOARD_TRAFFIC_DIMENSION_KEYS } from "~~/types/dashboard";
import { useLocalization } from "~/composables/useLocalization";
import { useToastStore } from "~/stores/toast";

export type TrafficExportFormat = "png" | "html" | "json";

export function useTrafficExport() {
  const { locale, t } = useLocalization();
  const toast = useToastStore();

  async function exportTraffic(
    format: TrafficExportFormat,
    range: DashboardTrafficRange,
    data: DashboardTrafficRangeData,
    points: DashboardTrafficPoint[] | null,
    rangeLabel: string,
  ) {
    const exportedAt = new Date();
    const labels = createLabels();
    const input: TrafficExportInput = {
      data,
      points,
      range,
      rangeLabel,
      exportedAt,
      locale: locale.value,
      labels,
    };
    const stamp = exportedAt.toISOString().replace(/[:.]/g, "-");
    const baseName = `spfi-traffic-${range}-${stamp}`;

    try {
      if (format === "png") {
        const blob = await renderTrafficPng(input);
        downloadBlob(blob, `${baseName}.png`);
      } else if (format === "html") {
        downloadText(
          buildTrafficHtmlReport(input),
          `${baseName}.html`,
          "text/html;charset=utf-8",
        );
      } else {
        downloadText(
          JSON.stringify(buildTrafficExportPayload(input), null, 2),
          `${baseName}.json`,
          "application/json;charset=utf-8",
        );
      }
      toast.success(
        t("dashboard.trafficExportSuccess", { format: format.toUpperCase() }),
      );
      return true;
    } catch {
      toast.error(t("dashboard.trafficExportFailed"));
      return false;
    }
  }

  function createLabels(): TrafficExportLabels {
    return {
      title: t("dashboard.trafficExportTitle"),
      range: t("dashboard.trafficRange"),
      exportedAt: t("dashboard.trafficExportedAt"),
      sessions: t("dashboard.trafficMetricSessions"),
      visitors: t("dashboard.trafficMetricVisitors"),
      pageviews: t("dashboard.trafficMetricPageviews"),
      bounceRate: t("dashboard.trafficMetricBounce"),
      conversionRate: t("dashboard.trafficMetricConversion"),
      averageDuration: t("dashboard.trafficMetricDuration"),
      trend: t("dashboard.trafficTrend"),
      sources: t("dashboard.trafficSources"),
      countries: t("dashboard.trafficCountries"),
      devices: t("dashboard.trafficDevices"),
      details: t("dashboard.trafficAnalysisTitle"),
      dimension: t("dashboard.trafficDimension"),
      viewsPerSession: t("dashboard.trafficDetailViewsPerSession"),
      purchases: t("dashboard.trafficFunnelPurchase"),
      dimensionLabels: Object.fromEntries(
        DASHBOARD_TRAFFIC_DIMENSION_KEYS.map((dimension) => [
          dimension,
          t(DASHBOARD_TRAFFIC_DIMENSION_LABEL_KEYS[dimension]),
        ]),
      ),
    };
  }

  return { exportTraffic };
}

async function renderTrafficPng(input: TrafficExportInput) {
  const { locale } = input;
  const width = 1600;
  const height = 1120;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");

  context.fillStyle = "#f4f7f5";
  context.fillRect(0, 0, width, height);
  drawRoundedRect(context, 48, 42, 1504, 112, 24, "#dff5e8");
  context.fillStyle = "#16221b";
  context.font = "700 34px Arial, sans-serif";
  context.fillText(input.labels.title, 78, 92);
  context.fillStyle = "#607068";
  context.font = "16px Arial, sans-serif";
  context.fillText(
    `${input.rangeLabel} · ${input.labels.exportedAt} ${input.exportedAt.toLocaleString(locale)}`,
    78,
    125,
  );

  drawMetricCards(context, input, locale);
  drawTrend(context, input, locale);
  drawBreakdowns(context, input, locale);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed."))),
      "image/png",
    );
  });
}

function drawMetricCards(
  context: CanvasRenderingContext2D,
  input: TrafficExportInput,
  locale: string,
) {
  const { metrics } = input.data;
  const values = [
    [input.labels.sessions, metrics ? formatNumber(metrics.sessions, locale) : "—"],
    [input.labels.visitors, metrics ? formatNumber(metrics.visitors, locale) : "—"],
    [input.labels.pageviews, metrics ? formatNumber(metrics.pageviews, locale) : "—"],
    [
      input.labels.bounceRate,
      metrics ? formatPercent(metrics.bounceRate, locale) : "—",
    ],
    [
      input.labels.conversionRate,
      metrics ? formatPercent(metrics.conversionRate, locale) : "—",
    ],
    [
      input.labels.averageDuration,
      metrics ? formatDuration(metrics.averageSessionDuration) : "—",
    ],
  ];
  const gap = 14;
  const cardWidth = (1504 - gap * 5) / 6;

  values.forEach(([label, value], index) => {
    const x = 48 + index * (cardWidth + gap);
    drawRoundedRect(context, x, 174, cardWidth, 122, 16, "#ffffff", "#d9e4dd");
    context.fillStyle = "#607068";
    context.font = "700 13px Arial, sans-serif";
    context.fillText(String(label).toUpperCase(), x + 18, 210, cardWidth - 36);
    context.fillStyle = "#16221b";
    context.font = "700 29px Arial, sans-serif";
    context.fillText(String(value), x + 18, 258, cardWidth - 36);
  });
}

function drawTrend(
  context: CanvasRenderingContext2D,
  input: TrafficExportInput,
  locale: string,
) {
  const x = 48;
  const y = 316;
  const width = 1504;
  const height = 390;
  drawRoundedRect(context, x, y, width, height, 18, "#ffffff", "#d9e4dd");
  context.fillStyle = "#16221b";
  context.font = "700 20px Arial, sans-serif";
  context.fillText(input.labels.trend, x + 24, y + 38);
  context.fillStyle = "#607068";
  context.font = "14px Arial, sans-serif";
  context.fillText(input.rangeLabel, x + width - 170, y + 38, 146);

  const chart = { x: x + 58, y: y + 76, width: width - 92, height: height - 118 };
  const values = (input.points || []).map((point) => point.sessions);
  const maximum = Math.max(1, ...values);
  context.strokeStyle = "#e5ece8";
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const lineY = chart.y + (chart.height * index) / 4;
    context.beginPath();
    context.moveTo(chart.x, lineY);
    context.lineTo(chart.x + chart.width, lineY);
    context.stroke();
    context.fillStyle = "#718078";
    context.font = "12px Arial, sans-serif";
    context.fillText(
      formatNumber(maximum * (1 - index / 4), locale),
      x + 16,
      lineY + 4,
      38,
    );
  }

  if (values.length) {
    context.strokeStyle = "#278c54";
    context.lineWidth = 4;
    context.lineJoin = "round";
    context.beginPath();
    values.forEach((value, index) => {
      const pointX =
        chart.x +
        (values.length === 1
          ? chart.width / 2
          : (chart.width * index) / (values.length - 1));
      const pointY = chart.y + chart.height * (1 - value / maximum);
      if (index === 0) context.moveTo(pointX, pointY);
      else context.lineTo(pointX, pointY);
    });
    context.stroke();
  }

  const firstPeriod = input.points?.[0]?.period || "—";
  const lastPeriod = input.points?.at(-1)?.period || "—";
  context.fillStyle = "#718078";
  context.font = "12px Arial, sans-serif";
  context.fillText(firstPeriod, chart.x, y + height - 18, 260);
  context.textAlign = "right";
  context.fillText(lastPeriod, chart.x + chart.width, y + height - 18, 260);
  context.textAlign = "left";
}

function drawBreakdowns(
  context: CanvasRenderingContext2D,
  input: TrafficExportInput,
  locale: string,
) {
  const groups = [
    [input.labels.sources, input.data.sources],
    [input.labels.countries, input.data.countries],
    [input.labels.devices, input.data.devices],
  ] as const;
  const gap = 16;
  const width = (1504 - gap * 2) / 3;

  groups.forEach(([title, rows], groupIndex) => {
    const x = 48 + groupIndex * (width + gap);
    const y = 726;
    drawRoundedRect(context, x, y, width, 346, 18, "#ffffff", "#d9e4dd");
    context.fillStyle = "#16221b";
    context.font = "700 18px Arial, sans-serif";
    context.fillText(title, x + 22, y + 38, width - 44);
    if (!rows) {
      context.fillStyle = "#607068";
      context.font = "16px Arial, sans-serif";
      context.fillText("—", x + 22, y + 82);
      return;
    }
    rows.slice(0, 7).forEach((row, rowIndex) => {
      const rowY = y + 78 + rowIndex * 36;
      context.fillStyle = "#405047";
      context.font = "14px Arial, sans-serif";
      context.fillText(row.label, x + 22, rowY, width - 150);
      context.fillStyle = "#278c54";
      context.font = "700 14px Arial, sans-serif";
      context.textAlign = "right";
      context.fillText(formatNumber(row.sessions, locale), x + width - 22, rowY);
      context.textAlign = "left";
      context.strokeStyle = "#edf2ef";
      context.beginPath();
      context.moveTo(x + 22, rowY + 12);
      context.lineTo(x + width - 22, rowY + 12);
      context.stroke();
    });
  });
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 1;
    context.stroke();
  }
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
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

function downloadText(content: string, filename: string, type: string) {
  downloadBlob(new Blob([content], { type }), filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
