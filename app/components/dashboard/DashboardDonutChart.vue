<script setup lang="ts">
const props = defineProps<{
  segments: Array<{ label: string; value: number }>;
  centerLabel?: string;
  ariaLabel: string;
  centerValue?: string;
  size?: number;
  strokeWidth?: number;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const colors = ["#2b8a5b", "#d38a2d", "#3e7db5", "#c8524a"];
let animationFrame = 0;
const total = computed(() =>
  props.segments.reduce((sum, segment) => sum + segment.value, 0),
);

function draw(progress: number) {
  const element = canvas.value;
  if (!element) return;
  const size = props.size || 196;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  element.width = size * ratio;
  element.height = size * ratio;
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
  const context = element.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, size, size);
  const center = size / 2;
  const radius = size * 0.367;
  const lineWidth = props.strokeWidth || Math.max(14, size * 0.102);
  const styles = getComputedStyle(document.documentElement);
  const track = styles.getPropertyValue("--surface-soft").trim() || "#eef4f0";
  const text = styles.getPropertyValue("--text").trim() || "#14221b";
  const muted = styles.getPropertyValue("--muted").trim() || "#65756c";

  context.lineWidth = lineWidth;
  context.lineCap = "round";
  context.strokeStyle = track;
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.stroke();

  let angle = -Math.PI / 2;
  for (const [index, segment] of props.segments.entries()) {
    if (!total.value || !segment.value) continue;
    const sweep = (segment.value / total.value) * Math.PI * 2 * progress;
    context.strokeStyle = colors[index] || "#2b8a5b";
    context.beginPath();
    context.arc(center, center, radius, angle, angle + Math.max(0, sweep - 0.035));
    context.stroke();
    angle += sweep;
  }

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = text;
  context.font = `700 ${Math.max(20, size * 0.138)}px Inter, system-ui, sans-serif`;
  const hasCenterLabel = Boolean(props.centerLabel?.trim());
  context.fillText(
    props.centerValue || String(total.value),
    center,
    hasCenterLabel ? center - 7 : center,
  );
  if (hasCenterLabel) {
    context.fillStyle = muted;
    context.font = `600 ${Math.max(9, size * 0.051)}px Inter, system-ui, sans-serif`;
    context.fillText(props.centerLabel || "", center, center + 17);
  }
}

function animate() {
  cancelAnimationFrame(animationFrame);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    draw(1);
    return;
  }
  const startedAt = performance.now();
  const tick = (now: number) => {
    const elapsed = Math.min(1, (now - startedAt) / 820);
    draw(1 - (1 - elapsed) ** 3);
    if (elapsed < 1) animationFrame = requestAnimationFrame(tick);
  };
  animationFrame = requestAnimationFrame(tick);
}

watch(
  () => [
    props.segments,
    props.centerLabel,
    props.centerValue,
    props.size,
    props.strokeWidth,
  ],
  () => nextTick(animate),
  { deep: true },
);
onMounted(animate);
onBeforeUnmount(() => cancelAnimationFrame(animationFrame));
</script>

<template>
  <div class="donut-layout">
    <canvas ref="canvas" role="img" :aria-label="ariaLabel" />
    <div class="donut-legend">
      <div v-for="(segment, index) in segments" :key="segment.label">
        <i :style="{ background: colors[index] }" />
        <span>{{ segment.label }}</span>
        <strong>{{ segment.value }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.donut-layout {
  display: grid;
  align-items: center;
  justify-items: center;
  gap: 12px;
}

.donut-layout canvas {
  display: block;
}

.donut-legend {
  display: grid;
  width: 100%;
  gap: 8px;
}

.donut-legend div {
  display: grid;
  grid-template-columns: 9px 1fr auto;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 12px;
}

.donut-legend i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.donut-legend strong {
  color: var(--text);
}
</style>
