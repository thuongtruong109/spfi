<script setup lang="ts">
import type { DashboardTrafficPoint } from "~~/types/dashboard";
import { parseShopifyqlPeriod } from "~~/utils/shopifyql-period";

const props = defineProps<{
  points: DashboardTrafficPoint[];
  granularity: "hour" | "day";
}>();

const { locale, t } = useLocalization();
const canvas = ref<HTMLCanvasElement | null>(null);
const shell = ref<HTMLElement | null>(null);
const hoveredIndex = ref<number | null>(null);
const tooltipX = ref(0);
let resizeObserver: ResizeObserver | null = null;
let themeObserver: MutationObserver | null = null;
let geometry = { left: 42, width: 0 };

const tooltipPoint = computed(() =>
  hoveredIndex.value === null ? null : props.points[hoveredIndex.value] || null,
);

function draw() {
  const element = canvas.value;
  const container = shell.value;
  if (!element || !container || !props.points.length) return;

  const width = Math.max(300, container.clientWidth);
  const height = 245;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  element.width = Math.round(width * ratio);
  element.height = Math.round(height * ratio);
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;

  const context = element.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  const styles = getComputedStyle(document.documentElement);
  const gridColor = styles.getPropertyValue("--border").trim() || "#d9e4dd";
  const textColor = styles.getPropertyValue("--muted").trim() || "#65756c";
  const left = 42;
  const right = 12;
  const top = 28;
  const bottom = 34;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  geometry = { left, width: chartWidth };

  const maximum = niceCeiling(
    Math.max(1, ...props.points.flatMap((point) => [point.sessions, point.visitors])),
  );
  context.font = "10px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";

  for (let index = 0; index <= 4; index += 1) {
    const y = top + (chartHeight * index) / 4;
    context.strokeStyle = gridColor;
    context.globalAlpha = 0.52;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(width - right, y);
    context.stroke();
    context.globalAlpha = 1;
    context.fillStyle = textColor;
    context.textAlign = "right";
    context.fillText(formatNumber(maximum * (1 - index / 4)), left - 7, y);
  }

  const pointX = (index: number) =>
    left +
    (props.points.length <= 1
      ? chartWidth / 2
      : (chartWidth * index) / (props.points.length - 1));
  const pointY = (value: number) => top + chartHeight * (1 - value / maximum);

  drawSeries(context, pointX, pointY, "sessions", "#2b8a5b", true);
  drawSeries(context, pointX, pointY, "visitors", "#3e7db5", false);

  const labelIndexes = new Set([
    0,
    Math.floor((props.points.length - 1) / 2),
    props.points.length - 1,
  ]);
  context.fillStyle = textColor;
  context.textAlign = "center";
  for (const index of labelIndexes) {
    const point = props.points[index];
    if (!point) continue;
    context.fillText(formatPeriod(point.period, true), pointX(index), height - 13);
  }

  if (hoveredIndex.value !== null) {
    const point = props.points[hoveredIndex.value];
    if (!point) return;
    const x = pointX(hoveredIndex.value);
    context.strokeStyle = textColor;
    context.globalAlpha = 0.55;
    context.setLineDash([3, 4]);
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, top + chartHeight);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 1;
    drawMarker(context, x, pointY(point.sessions), "#2b8a5b");
    drawMarker(context, x, pointY(point.visitors), "#3e7db5");
  }
}

function drawSeries(
  context: CanvasRenderingContext2D,
  pointX: (index: number) => number,
  pointY: (value: number) => number,
  key: "sessions" | "visitors",
  color: string,
  fill: boolean,
) {
  context.beginPath();
  props.points.forEach((point, index) => {
    const x = pointX(index);
    const y = pointY(point[key]);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  if (fill) {
    const lastIndex = props.points.length - 1;
    const gradient = context.createLinearGradient(0, 20, 0, 220);
    gradient.addColorStop(0, `${color}30`);
    gradient.addColorStop(1, `${color}00`);
    context.lineTo(pointX(lastIndex), pointY(0));
    context.lineTo(pointX(0), pointY(0));
    context.closePath();
    context.fillStyle = gradient;
    context.fill();
    context.beginPath();
    props.points.forEach((point, index) => {
      if (index === 0) context.moveTo(pointX(index), pointY(point[key]));
      else context.lineTo(pointX(index), pointY(point[key]));
    });
  }
  context.strokeStyle = color;
  context.lineWidth = key === "sessions" ? 2.5 : 2;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.stroke();
}

function drawMarker(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  context.beginPath();
  context.arc(x, y, 3.5, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
}

function handlePointer(event: PointerEvent) {
  if (!canvas.value || !props.points.length || !geometry.width) return;
  const rect = canvas.value.getBoundingClientRect();
  const relativeX = event.clientX - rect.left;
  const normalized = Math.min(
    1,
    Math.max(0, (relativeX - geometry.left) / geometry.width),
  );
  hoveredIndex.value = Math.round(normalized * (props.points.length - 1));
  tooltipX.value = Math.min(rect.width - 76, Math.max(76, relativeX));
  draw();
}

function clearPointer() {
  hoveredIndex.value = null;
  draw();
}

function formatPeriod(value: string, short = false) {
  const date = parseShopifyqlPeriod(value);
  if (!date) return value;
  return new Intl.DateTimeFormat(locale.value, {
    timeZone: "UTC",
    ...(props.granularity === "hour"
      ? { hour: "2-digit", minute: "2-digit" }
      : { month: short ? "short" : "long", day: "numeric" }),
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(locale.value, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function niceCeiling(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

watch(
  () => [props.points, locale.value],
  () => nextTick(draw),
  { deep: true },
);

onMounted(() => {
  resizeObserver = new ResizeObserver(draw);
  if (shell.value) resizeObserver.observe(shell.value);
  themeObserver = new MutationObserver(draw);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  nextTick(draw);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  themeObserver?.disconnect();
});
</script>

<template>
  <div ref="shell" class="traffic-chart-shell">
    <div class="traffic-chart-legend" :aria-label="t('dashboard.trafficLegend')">
      <span><i class="sessions" />{{ t("dashboard.trafficSessions") }}</span>
      <span><i class="visitors" />{{ t("dashboard.trafficVisitors") }}</span>
    </div>
    <div v-if="!points.length" class="traffic-chart-empty">
      {{ t("dashboard.trafficNoData") }}
    </div>
    <canvas
      v-else
      ref="canvas"
      role="img"
      class="traffic-chart-canvas"
      :aria-label="t('dashboard.trafficChartLabel', { count: points.length })"
      @pointermove="handlePointer"
      @pointerleave="clearPointer"
    />
    <div
      v-if="tooltipPoint"
      class="traffic-chart-tooltip"
      :style="{ left: `${tooltipX}px` }"
      aria-live="polite"
    >
      <strong>{{ formatPeriod(tooltipPoint.period) }}</strong>
      <span>{{ t("dashboard.trafficSessions") }}: {{ tooltipPoint.sessions }}</span>
      <span>{{ t("dashboard.trafficVisitors") }}: {{ tooltipPoint.visitors }}</span>
      <span>{{ t("dashboard.trafficPageviews") }}: {{ tooltipPoint.pageviews }}</span>
    </div>
  </div>
</template>

<style scoped>
.traffic-chart-shell {
  position: relative;
  min-width: 0;
  min-height: 245px;
}

.traffic-chart-canvas {
  display: block;
  max-width: 100%;
  touch-action: pan-y;
}

.traffic-chart-legend {
  position: absolute;
  top: 2px;
  right: 8px;
  z-index: 1;
  display: flex;
  gap: 12px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
}

.traffic-chart-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.traffic-chart-legend i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.traffic-chart-legend .sessions {
  background: #2b8a5b;
}

.traffic-chart-legend .visitors {
  background: #3e7db5;
}

.traffic-chart-empty {
  display: grid;
  min-height: 230px;
  place-items: center;
  color: var(--muted);
  font-size: 12px;
}

.traffic-chart-tooltip {
  position: absolute;
  top: 28px;
  z-index: 2;
  display: grid;
  min-width: 135px;
  gap: 2px;
  padding: 9px 11px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-overlay);
  box-shadow: var(--shadow-soft);
  color: var(--muted);
  font-size: 10px;
  pointer-events: none;
  transform: translateX(-50%);
  backdrop-filter: blur(12px);
}

.traffic-chart-tooltip strong {
  margin-bottom: 2px;
  color: var(--text);
}
</style>
