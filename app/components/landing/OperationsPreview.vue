<template>
  <div class="operations-preview" :aria-label="t('home.previewAria')">
    <div class="preview-chrome" aria-hidden="true">
      <span />
      <span />
      <span />
      <div class="preview-address">
        <span class="address-lock">●</span>
        console.spfi.local
      </div>
      <span class="live-indicator">{{ t("home.previewLive") }}</span>
    </div>

    <div class="preview-body">
      <header class="preview-heading">
        <div>
          <p>{{ t("home.previewDashboardEyebrow") }}</p>
          <h2>{{ t("home.previewDashboardTitle") }}</h2>
        </div>
        <span class="health-pill">
          <span />
          {{ t("home.previewHealthy") }}
        </span>
      </header>

      <div class="preview-stats">
        <article>
          <span class="stat-icon is-green"><IconsHero /></span>
          <div>
            <small>{{ t("home.previewStores") }}</small>
            <strong>12</strong>
          </div>
          <em>+2</em>
        </article>
        <article>
          <span class="stat-icon is-blue"><IconsRefresh /></span>
          <div>
            <small>{{ t("home.previewTasks") }}</small>
            <strong>08</strong>
          </div>
          <em>Live</em>
        </article>
        <article>
          <span class="stat-icon is-amber"><IconsCheck /></span>
          <div>
            <small>{{ t("home.previewCapacity") }}</small>
            <strong>78%</strong>
          </div>
          <em>Good</em>
        </article>
      </div>

      <div class="preview-content">
        <section class="chart-panel">
          <div class="panel-heading">
            <div>
              <span>{{ t("home.previewActivity") }}</span>
              <strong>2,480</strong>
            </div>
            <span class="trend">↗ 18.4%</span>
          </div>
          <svg
            class="activity-chart"
            viewBox="0 0 420 148"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
                <stop stop-color="#22a06b" stop-opacity="0.28" />
                <stop offset="1" stop-color="#22a06b" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path class="chart-grid" d="M0 24H420M0 66H420M0 108H420" />
            <path
              class="chart-area"
              d="M0 126C40 122 47 89 84 96C122 103 133 61 172 71C210 81 221 43 256 51C294 60 305 24 340 37C374 49 389 21 420 16V148H0V126Z"
            />
            <path
              class="chart-line"
              d="M0 126C40 122 47 89 84 96C122 103 133 61 172 71C210 81 221 43 256 51C294 60 305 24 340 37C374 49 389 21 420 16"
            />
            <circle cx="420" cy="16" r="5" />
          </svg>
          <div class="chart-labels" aria-hidden="true">
            <span>09:00</span>
            <span>12:00</span>
            <span>15:00</span>
            <span>Now</span>
          </div>
        </section>

        <aside class="activity-panel">
          <div class="panel-heading">
            <span>{{ t("home.previewRecent") }}</span>
            <span class="activity-count">3</span>
          </div>
          <ul>
            <li>
              <span class="activity-dot is-green" />
              <div>
                <strong>{{ t("home.previewProducts") }}</strong>
                <small>store-alpha · 2m</small>
              </div>
              <em>200</em>
            </li>
            <li>
              <span class="activity-dot is-blue" />
              <div>
                <strong>{{ t("home.previewToken") }}</strong>
                <small>north-studio · 6m</small>
              </div>
              <em>{{ t("home.previewReady") }}</em>
            </li>
            <li>
              <span class="activity-dot is-amber" />
              <div>
                <strong>{{ t("home.previewSheet") }}</strong>
                <small>orders-2026 · 11m</small>
              </div>
              <em>{{ t("home.previewTabs") }}</em>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useLocalization();
</script>

<style scoped>
.operations-preview {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
  border-radius: 22px;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  box-shadow:
    0 30px 80px rgba(14, 41, 29, 0.14),
    0 8px 24px rgba(14, 41, 29, 0.08);
  transform: perspective(1200px) rotateY(-1.8deg) rotateX(0.7deg);
  animation: preview-enter 0.86s cubic-bezier(0.2, 0.72, 0.24, 1) 0.08s both;
}

.preview-chrome {
  display: flex;
  height: 46px;
  align-items: center;
  gap: 7px;
  border-bottom: 1px solid var(--line);
  padding: 0 15px;
  background: color-mix(in srgb, var(--surface-soft) 86%, transparent);
}

.preview-chrome > span:not(.live-indicator) {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #ff625a;
}

.preview-chrome > span:nth-child(2) {
  background: #ffbd2e;
}

.preview-chrome > span:nth-child(3) {
  background: #28c840;
}

.preview-address {
  display: flex;
  height: 26px;
  align-items: center;
  gap: 6px;
  margin-left: 7px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.66rem;
}

.address-lock {
  color: var(--green);
  font-size: 0.42rem;
}

.live-indicator {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  color: var(--green);
  font-size: 0.67rem;
  font-weight: 700;
}

.live-indicator::before {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--green) 15%, transparent);
  content: "";
}

.preview-body {
  display: grid;
  gap: 16px;
  padding: 22px;
  background:
    radial-gradient(circle at 100% 0%, rgba(52, 168, 119, 0.1), transparent 36%),
    var(--surface);
}

.preview-heading,
.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.preview-heading p {
  margin: 0 0 4px;
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.preview-heading h2 {
  margin: 0;
  color: var(--text);
  font-size: 1.08rem;
  letter-spacing: -0.025em;
}

.health-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--green) 20%, transparent);
  border-radius: 999px;
  padding: 6px 9px;
  background: var(--green-soft);
  color: var(--green);
  font-size: 0.64rem;
  font-weight: 700;
}

.health-pill span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.preview-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}

.preview-stats article {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 11px;
  background: color-mix(in srgb, var(--surface-raised) 90%, transparent);
}

.stat-icon {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
}

.stat-icon :deep(svg) {
  width: 15px;
  height: 15px;
}

.stat-icon.is-green {
  background: var(--green-soft);
  color: var(--green);
}

.stat-icon.is-blue {
  background: var(--blue-soft);
  color: var(--blue);
}

.stat-icon.is-amber {
  background: var(--amber-soft);
  color: var(--amber);
}

.preview-stats div {
  display: grid;
  gap: 2px;
}

.preview-stats small {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.62rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-stats strong {
  color: var(--text);
  font-size: 1rem;
}

.preview-stats em,
.activity-panel em {
  color: var(--green);
  font-size: 0.58rem;
  font-style: normal;
  font-weight: 700;
}

.preview-content {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(150px, 0.75fr);
  gap: 10px;
}

.chart-panel,
.activity-panel {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 13px;
  background: color-mix(in srgb, var(--surface-raised) 90%, transparent);
}

.panel-heading span {
  color: var(--muted);
  font-size: 0.66rem;
  font-weight: 700;
}

.panel-heading div {
  display: grid;
  gap: 3px;
}

.panel-heading strong {
  color: var(--text);
  font-size: 1.05rem;
}

.panel-heading .trend {
  border-radius: 999px;
  padding: 4px 7px;
  background: var(--green-soft);
  color: var(--green);
}

.activity-chart {
  width: 100%;
  height: 128px;
  margin-top: 7px;
  overflow: visible;
}

.chart-grid {
  stroke: color-mix(in srgb, var(--line) 76%, transparent);
  stroke-dasharray: 3 5;
}

.chart-area {
  fill: url(#activity-fill);
}

.chart-line {
  stroke: var(--green);
  stroke-width: 3;
  stroke-linecap: round;
}

.activity-chart circle {
  fill: var(--surface);
  stroke: var(--green);
  stroke-width: 3;
}

.chart-labels {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 0.55rem;
}

.activity-count {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--surface-soft);
  color: var(--text) !important;
}

.activity-panel ul {
  display: grid;
  gap: 0;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.activity-panel li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--line);
  padding: 11px 0;
}

.activity-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 0 4px var(--green-soft);
}

.activity-dot.is-blue {
  background: var(--blue);
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.activity-dot.is-amber {
  background: var(--amber);
  box-shadow: 0 0 0 4px var(--amber-soft);
}

.activity-panel div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.activity-panel strong,
.activity-panel small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-panel strong {
  color: var(--text);
  font-size: 0.63rem;
}

.activity-panel small {
  color: var(--muted);
  font-size: 0.56rem;
}

@keyframes preview-enter {
  from {
    opacity: 0;
    transform: perspective(1200px) translateY(24px) rotateY(-3deg) scale(0.97);
  }

  to {
    opacity: 1;
    transform: perspective(1200px) rotateY(-1.8deg) rotateX(0.7deg);
  }
}

@media (max-width: 560px) {
  .operations-preview {
    transform: none;
  }

  .preview-body {
    padding: 14px;
  }

  .preview-address {
    display: none;
  }

  .preview-stats,
  .preview-content {
    grid-template-columns: 1fr;
  }

  .activity-panel {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .operations-preview {
    animation: none;
  }
}
</style>
