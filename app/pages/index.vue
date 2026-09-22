<template>
  <main class="landing-page">
    <section class="landing-hero">
      <div class="hero-copy">
        <p class="eyebrow is-ok">{{ t("home.eyebrow") }}</p>
        <h1>{{ t("home.heroTitle") }}</h1>
        <p class="hero-sub">
          {{ t("home.heroSub") }}
        </p>
        <div class="hero-actions">
          <NuxtLink class="hero-btn hero-btn-primary" to="/dashboard">
            <IconsHero />
            {{ t("nav.dashboard") }}
          </NuxtLink>
          <NuxtLink class="hero-btn hero-btn-secondary" to="/manager">
            <IconsBulking />
            {{ t("home.openManager") }}
          </NuxtLink>
          <NuxtLink class="hero-btn hero-btn-secondary" to="/status">
            <IconsCheck />
            {{ t("home.checkStatus") }}
          </NuxtLink>
        </div>
      </div>

      <LandingOperationsPreview />
    </section>

    <section class="workflow-section" :aria-label="t('home.workflowsAria')">
      <div class="workflow-heading">
        <div>
          <p class="eyebrow is-blue">{{ t("home.workflowsEyebrow") }}</p>
          <h2>{{ t("home.workflowsTitle") }}</h2>
        </div>
        <p>{{ t("home.workflowsBody") }}</p>
      </div>

      <div class="quick-links">
        <NuxtLink
          v-for="(item, index) in quickLinks"
          :key="item.to"
          class="workflow-card"
          :class="{ 'is-featured': index === 0 }"
          :to="item.to"
        >
          <span class="workflow-icon-wrap" :class="`is-${item.tone}`">
            <component :is="item.icon" class="workflow-icon" aria-hidden="true" />
          </span>
          <div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </div>
          <IconsArrowRight class="workflow-arrow" aria-hidden="true" />
        </NuxtLink>
      </div>
    </section>

    <section class="motivation-section landing-section">
      <div class="section-heading">
        <p class="eyebrow">{{ t("home.motivationEyebrow") }}</p>
        <h2>{{ t("home.motivationTitle") }}</h2>
        <p>
          {{ t("home.motivationBody") }}
        </p>
      </div>

      <div class="motivation-grid">
        <article
          v-for="item in motivationItems"
          :key="item.title"
          class="motivation-card"
        >
          <div class="motivation-icon">
            <component :is="item.icon" />
          </div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
        </article>
      </div>
    </section>

    <section class="assurance-section landing-section">
      <div class="section-heading">
        <p class="eyebrow is-blue">{{ t("home.assuranceEyebrow") }}</p>
        <h2>{{ t("home.assuranceTitle") }}</h2>
        <p>
          {{ t("home.assuranceBody") }}
        </p>
      </div>

      <div class="assurance-grid">
        <article
          v-for="item in assuranceItems"
          :key="item.title"
          class="assurance-item"
        >
          <div class="assurance-icon">
            <component :is="item.icon" aria-hidden="true" />
          </div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
        </article>
      </div>
    </section>

    <section class="metrics-strip" :aria-label="t('home.metricsEyebrow')">
      <p class="eyebrow is-amber">{{ t("home.metricsEyebrow") }}</p>
      <div class="metrics-grid">
        <article v-for="item in metricItems" :key="item.label" class="metric-card">
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </article>
      </div>
    </section>

    <section class="runbook-section landing-section">
      <div class="section-heading section-heading-narrow">
        <p class="eyebrow is-blue">{{ t("home.flowEyebrow") }}</p>
        <h2>{{ t("home.flowTitle") }}</h2>
      </div>

      <div class="runbook-list">
        <article v-for="step in runbookSteps" :key="step.title" class="runbook-item">
          <div class="runbook-item-head">
            <span>{{ step.step }}</span>
            <h3>{{ step.title }}</h3>
          </div>
          <p>{{ step.description }}</p>
        </article>
      </div>
    </section>

    <section class="faq-section landing-section">
      <div class="section-heading">
        <p class="eyebrow is-amber">{{ t("home.faqEyebrow") }}</p>
        <h2>{{ t("home.faqTitle") }}</h2>
      </div>

      <div class="faq-list">
        <details v-for="item in faqItems" :key="item.question" class="faq-item">
          <summary>
            <span>{{ item.question }}</span>
            <IconsAdd />
          </summary>
          <p>{{ item.answer }}</p>
        </details>
      </div>
    </section>

    <section class="landing-cta" :aria-label="t('home.ctaAria')">
      <div>
        <p class="eyebrow">{{ t("home.ctaEyebrow") }}</p>
        <h2>{{ t("home.ctaTitle") }}</h2>
      </div>
      <NuxtLink class="hero-btn hero-btn-primary" to="/manager">
        <IconsArrowRight />
        {{ t("home.openManager") }}
      </NuxtLink>
    </section>

    <AppFooter />
  </main>
</template>

<script setup lang="ts">
import {
  Activity,
  Boxes,
  Gauge,
  GitBranch,
  LayoutDashboard,
  PlugZap,
  Settings2,
  Sheet,
  ShieldCheck,
  Store,
} from "@lucide/vue";
import IconsLandingClean from "~/components/icons/landing/Clean.vue";
import IconsLandingFlash from "~/components/icons/landing/Flash.vue";
import IconsLandingUsefull from "~/components/icons/landing/Usefull.vue";

const { t } = useLocalization();

const quickLinks = computed(() => [
  {
    to: "/dashboard",
    title: t("nav.dashboard"),
    description: t("home.quickDashboardDescription"),
    icon: LayoutDashboard,
    tone: "green",
  },
  {
    to: "/setup",
    title: t("home.quickSetupTitle"),
    description: t("home.quickSetupDescription"),
    icon: PlugZap,
    tone: "blue",
  },
  {
    to: "/manager",
    title: t("home.quickManagerTitle"),
    description: t("home.quickManagerDescription"),
    icon: Boxes,
    tone: "violet",
  },
  {
    to: "/store",
    title: t("nav.store"),
    description: t("home.quickStoreDescription"),
    icon: Store,
    tone: "amber",
  },
  {
    to: "/settings#sheets",
    title: t("home.quickSheetTitle"),
    description: t("home.quickSheetDescription"),
    icon: Sheet,
    tone: "green",
  },
  {
    to: "/status",
    title: t("home.quickStatusTitle"),
    description: t("home.quickStatusDescription"),
    icon: Activity,
    tone: "blue",
  },
  {
    to: "/settings",
    title: t("nav.settings"),
    description: t("home.quickSettingsDescription"),
    icon: Settings2,
    tone: "violet",
  },
]);

const motivationItems = computed(() => [
  {
    title: t("home.motivationTabsTitle"),
    description: t("home.motivationTabsDescription"),
    icon: IconsLandingFlash,
  },
  {
    title: t("home.motivationChecksTitle"),
    description: t("home.motivationChecksDescription"),
    icon: IconsLandingClean,
  },
  {
    title: t("home.motivationCopyTitle"),
    description: t("home.motivationCopyDescription"),
    icon: IconsLandingUsefull,
  },
]);

const assuranceItems = computed(() => [
  {
    title: t("home.assuranceVaultTitle"),
    description: t("home.assuranceVaultDescription"),
    icon: ShieldCheck,
  },
  {
    title: t("home.assuranceRateTitle"),
    description: t("home.assuranceRateDescription"),
    icon: Gauge,
  },
  {
    title: t("home.assuranceFlowTitle"),
    description: t("home.assuranceFlowDescription"),
    icon: GitBranch,
  },
]);

const metricItems = computed(() => [
  {
    value: t("home.metricStoresValue"),
    label: t("home.metricStoresLabel"),
  },
  {
    value: t("home.metricTokensValue"),
    label: t("home.metricTokensLabel"),
  },
  {
    value: t("home.metricOrdersValue"),
    label: t("home.metricOrdersLabel"),
  },
]);

const runbookSteps = computed(() => [
  {
    step: "01",
    title: t("home.flowConnectTitle"),
    description: t("home.flowConnectDescription"),
  },
  {
    step: "02",
    title: t("home.flowCheckTitle"),
    description: t("home.flowCheckDescription"),
  },
  {
    step: "03",
    title: t("home.flowDataTitle"),
    description: t("home.flowDataDescription"),
  },
]);

const faqItems = computed(() => [
  {
    question: t("home.faqFirstQuestion"),
    answer: t("home.faqFirstAnswer"),
  },
  {
    question: t("home.faqAdminQuestion"),
    answer: t("home.faqAdminAnswer"),
  },
  {
    question: t("home.faqSheetQuestion"),
    answer: t("home.faqSheetAnswer"),
  },
  {
    question: t("home.faqBatchQuestion"),
    answer: t("home.faqBatchAnswer"),
  },
]);
</script>

<style scoped>
.landing-page {
  position: relative;
  width: min(1240px, calc(100% - 40px));
  margin: 0 auto;
}

.landing-page::before {
  position: absolute;
  z-index: -1;
  top: -80px;
  right: 0;
  width: min(720px, 60%);
  height: 560px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(44, 178, 119, 0.1), transparent 68%);
  content: "";
  filter: blur(10px);
  pointer-events: none;
}

.landing-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(440px, 0.98fr);
  min-height: min(740px, calc(100vh - 92px));
  align-items: center;
  gap: clamp(42px, 6vw, 78px);
  padding: 54px 0 62px;
  animation: rise-in 0.72s ease both;
}

.hero-copy {
  display: grid;
  gap: 22px;
  min-width: 0;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  border: 1px solid color-mix(in srgb, var(--green) 18%, transparent);
  font-size: 0.7rem;
  font-weight: 750;
  letter-spacing: 0.065em;
  background: var(--green-soft);
  color: var(--green);
  border-radius: 999px;
  padding: 6px 10px;
  text-transform: uppercase;
  width: fit-content;
}

.eyebrow::before {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  content: "";
}

.hero-copy h1 {
  max-width: 760px;
  margin: 0;
  background: linear-gradient(128deg, var(--text) 12%, var(--green) 72%, var(--blue));
  color: transparent;
  font-size: clamp(3rem, 6vw, 5.35rem);
  line-height: 0.94;
  letter-spacing: -0.065em;
  background-clip: text;
}

.hero-sub {
  max-width: 640px;
  margin: 0;
  color: var(--muted);
  font-size: clamp(1rem, 1.5vw, 1.12rem);
  line-height: 1.72;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 11px;
  margin-top: 6px;
}

.hero-btn {
  display: inline-flex;
  min-height: 46px;
  align-items: center;
  gap: 8px;
  border-radius: 12px;
  padding: 0 17px;
  font-size: 0.88rem;
  font-weight: 700;
  text-decoration: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.hero-btn :deep(svg) {
  width: 16px;
  height: 16px;
}

.hero-btn-primary {
  background: linear-gradient(
    135deg,
    var(--green),
    color-mix(in srgb, var(--green) 76%, #0a7c74)
  );
  color: var(--on-accent);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--green) 24%, transparent);
}

.hero-btn-secondary {
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  color: var(--text);
}

.hero-btn:hover {
  transform: translateY(-2px);
}

.hero-btn-primary:hover {
  box-shadow: 0 14px 30px color-mix(in srgb, var(--green) 30%, transparent);
}

.hero-btn-secondary:hover {
  border-color: color-mix(in srgb, var(--green) 34%, var(--line));
}

.workflow-section {
  display: grid;
  gap: 24px;
  padding-top: 36px;
  animation: rise-in 0.62s ease 0.18s both;
}

.workflow-heading {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.7fr);
  align-items: end;
  gap: 48px;
}

.workflow-heading > div {
  display: grid;
  gap: 12px;
}

.workflow-heading h2 {
  max-width: 720px;
  margin: 0;
  color: var(--text);
  font-size: clamp(1.75rem, 4vw, 2.7rem);
  line-height: 1.05;
  letter-spacing: -0.045em;
}

.workflow-heading > p {
  margin: 0;
  color: var(--muted);
  font-size: 0.94rem;
  line-height: 1.65;
}

.quick-links {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.workflow-card {
  display: grid;
  min-height: 180px;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto 1fr;
  gap: 18px;
  align-items: start;
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 20px;
  background: var(--surface);
  color: inherit;
  text-decoration: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.workflow-card.is-featured {
  grid-column: span 2;
  background:
    radial-gradient(circle at 90% 10%, rgba(39, 169, 112, 0.16), transparent 40%),
    linear-gradient(145deg, var(--surface), var(--surface-soft));
}

.workflow-card:hover {
  border-color: rgba(31, 122, 77, 0.35);
  box-shadow: 0 22px 48px rgba(20, 52, 37, 0.1);
  transform: translateY(-4px);
}

.workflow-icon-wrap {
  display: inline-flex;
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--green) 18%, transparent);
  border-radius: 12px;
  background: var(--green-soft);
}

.workflow-icon-wrap.is-blue {
  border-color: color-mix(in srgb, var(--blue) 18%, transparent);
  background: var(--blue-soft);
}

.workflow-icon-wrap.is-blue .workflow-icon {
  color: var(--blue);
}

.workflow-icon-wrap.is-amber {
  border-color: color-mix(in srgb, var(--amber) 18%, transparent);
  background: var(--amber-soft);
}

.workflow-icon-wrap.is-amber .workflow-icon {
  color: var(--amber);
}

.workflow-icon-wrap.is-violet {
  border-color: color-mix(in srgb, var(--violet) 18%, transparent);
  background: var(--violet-soft);
}

.workflow-icon-wrap.is-violet .workflow-icon {
  color: var(--violet);
}

.workflow-icon {
  width: 20px;
  height: 20px;
  color: var(--green);
}

.workflow-card > div {
  grid-column: 1 / -1;
}

.workflow-card h3 {
  margin: 0 0 7px;
  color: var(--text);
  font-size: 1rem;
  letter-spacing: -0.02em;
}

.workflow-card p {
  margin: 0;
  color: var(--muted);
  font-size: 0.84rem;
  line-height: 1.58;
}

.workflow-arrow {
  width: 18px;
  height: 18px;
  color: var(--muted);
  transition: transform 0.18s ease;
}

.workflow-card:hover .workflow-arrow {
  transform: translateX(3px);
}

.workflow-card:focus-visible {
  border-color: color-mix(in srgb, var(--green) 46%, var(--line));
  box-shadow: var(--focus-ring);
  outline: none;
}

.landing-section {
  display: grid;
  gap: 26px;
  justify-items: center;
  padding: 112px 0 0;
  text-align: center;
  animation: section-rise 0.68s ease both;
  animation-timeline: view();
  animation-range: entry 12% cover 34%;
}

.section-heading {
  display: grid;
  gap: 14px;
  justify-items: center;
  max-width: 730px;
  margin-bottom: 0;
  text-align: center;
}

.section-heading-narrow {
  max-width: 680px;
}

.section-heading h2,
.landing-cta h2 {
  margin: 0;
  color: var(--text);
  font-size: clamp(1.9rem, 4vw, 3rem);
  line-height: 1.03;
  letter-spacing: -0.045em;
}

.section-heading p:not(.eyebrow) {
  margin: 0;
  color: var(--muted);
  font-size: 1rem;
  line-height: 1.7;
}

.eyebrow.is-blue {
  border-color: color-mix(in srgb, var(--blue) 18%, transparent);
  background: var(--blue-soft);
  color: var(--blue);
}

.eyebrow.is-amber {
  border-color: color-mix(in srgb, var(--amber) 18%, transparent);
  background: var(--amber-soft);
  color: var(--amber);
}

.motivation-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  width: 100%;
}

.assurance-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  width: 100%;
}

.assurance-item {
  display: grid;
  gap: 15px;
  min-height: 224px;
  align-content: start;
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 24px;
  background: var(--surface);
  text-align: left;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.assurance-item:hover {
  border-color: rgba(31, 122, 77, 0.3);
  box-shadow: var(--shadow-soft);
  transform: translateY(-4px);
}

.assurance-icon {
  display: inline-flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  background: var(--green-soft);
  color: var(--green);
}

.assurance-item:nth-child(2) .assurance-icon {
  background: var(--blue-soft);
  color: var(--blue);
}

.assurance-item:nth-child(3) .assurance-icon {
  background: var(--amber-soft);
  color: var(--amber);
}

.assurance-icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.assurance-item h3 {
  margin: 0;
  color: var(--text);
  font-size: 1.06rem;
  letter-spacing: -0.02em;
}

.assurance-item p {
  margin: 0;
  color: var(--muted);
  font-size: 0.91rem;
  line-height: 1.68;
}

.metrics-strip {
  display: grid;
  gap: 24px;
  margin-top: 112px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 28px;
  background:
    radial-gradient(circle at 88% 12%, rgba(46, 188, 126, 0.22), transparent 32%),
    linear-gradient(135deg, #10271c, #17382a);
  box-shadow: 0 24px 60px rgba(10, 36, 24, 0.16);
  animation: section-rise 0.68s ease both;
  animation-timeline: view();
  animation-range: entry 12% cover 34%;
}

.metrics-strip .eyebrow {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: #f6bd61;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
}

.metric-card {
  display: grid;
  gap: 4px;
  border: 0;
  border-radius: 0;
  background: rgba(9, 28, 19, 0.48);
  padding: 22px;
}

.metric-card strong {
  color: #f5fff9;
  font-size: clamp(1.45rem, 3vw, 2.1rem);
  line-height: 1.1;
}

.metric-card span {
  color: rgba(228, 246, 235, 0.68);
  font-size: 0.85rem;
  font-weight: 600;
}

.motivation-card {
  display: grid;
  gap: 15px;
  align-content: start;
  justify-items: center;
  min-height: 232px;
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 26px 22px;
  background: var(--surface);
  text-align: center;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.motivation-card:hover {
  border-color: rgba(31, 122, 77, 0.3);
  box-shadow: 0 18px 42px rgba(20, 34, 27, 0.08);
  transform: translateY(-4px);
}

.motivation-icon {
  display: inline-flex;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border-radius: 15px;
  background: var(--green-soft);
  color: var(--green);
  animation: icon-breathe 2.8s ease-in-out infinite;
}

.motivation-card:nth-child(2) .motivation-icon {
  background: var(--blue-soft);
  color: var(--blue);
}

.motivation-card:nth-child(3) .motivation-icon {
  background: var(--amber-soft);
  color: var(--amber);
}

.motivation-icon :deep(svg) {
  width: 23px;
  height: 23px;
}

.motivation-card h3,
.runbook-item h3 {
  margin: 0;
  color: var(--text);
  font-size: 1.06rem;
  letter-spacing: -0.02em;
}

.motivation-card p,
.runbook-item p,
.faq-item p {
  margin: 0;
  color: var(--muted);
  font-size: 0.91rem;
  line-height: 1.68;
}

.runbook-section {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: start;
}

.runbook-list {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: 100%;
  margin: 0 auto;
}

.runbook-item {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: start;
  justify-content: flex-start;
  text-align: left;
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 24px;
  background: color-mix(in srgb, var(--surface-raised) 82%, transparent);
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}

.runbook-item:hover {
  border-color: color-mix(in srgb, var(--blue) 24%, var(--line));
  background: var(--surface);
  transform: translateY(-4px);
}

.runbook-item .runbook-item-head {
  display: flex;
  gap: 12px;
  align-items: center;
}

.runbook-item span {
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: var(--surface);
  color: var(--blue);
  font-family: var(--font-mono);
  font-size: 0.9rem;
  font-weight: 600;
  box-shadow: inset 0 0 0 1px var(--line);
}

.faq-section {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: start;
}

.faq-list {
  display: grid;
  gap: 12px;
  width: min(820px, 100%);
  margin: 0 auto;
}

.faq-item {
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.faq-item:hover,
.faq-item[open] {
  border-color: rgba(31, 122, 77, 0.28);
  box-shadow: 0 14px 34px rgba(20, 34, 27, 0.07);
  transform: translateY(-2px);
}

.faq-item summary {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  min-height: 66px;
  align-items: center;
  justify-items: start;
  cursor: pointer;
  list-style: none;
  padding: 0 50px 0 22px;
  color: var(--text);
  font-weight: 600;
  text-align: left;
}

.faq-item summary::-webkit-details-marker {
  display: none;
}

.faq-item summary :deep(svg) {
  position: absolute;
  right: 20px;
  width: 18px;
  height: 18px;
  color: var(--green);
  transition: transform 0.16s ease;
}

.faq-item[open] summary :deep(svg) {
  transform: rotate(45deg);
}

.faq-item p {
  border-top: 1px solid var(--line);
  padding: 18px 22px 20px;
}

.landing-cta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  margin: 112px 0 42px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--green) 18%, var(--line));
  border-radius: 24px;
  padding: 38px;
  background:
    radial-gradient(circle at 92% 10%, rgba(43, 168, 114, 0.2), transparent 34%),
    linear-gradient(135deg, var(--green-soft), var(--blue-soft)), var(--surface-soft);
  animation: section-rise 0.68s ease both;
  animation-timeline: view();
  animation-range: entry 12% cover 34%;
}

.landing-cta > div {
  display: grid;
  gap: 10px;
  max-width: 690px;
}

.landing-cta a {
  height: fit-content;
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(18px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes section-rise {
  from {
    opacity: 0;
    transform: translateY(22px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes icon-breathe {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-3px);
  }
}

@media (max-width: 980px) {
  .landing-hero,
  .workflow-heading,
  .motivation-grid,
  .assurance-grid,
  .metrics-grid,
  .runbook-list {
    grid-template-columns: 1fr;
  }

  .quick-links {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .landing-hero {
    min-height: auto;
    padding: 48px 0;
  }

  .workflow-card.is-featured {
    grid-column: auto;
  }

  .landing-section {
    padding-top: 58px;
  }

  .landing-cta {
    margin-top: 58px;
  }

  .metrics-strip {
    margin-top: 74px;
  }
}

@media (max-width: 680px) {
  .quick-links {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .landing-page {
    width: min(100% - 24px, 680px);
    padding-top: 24px;
  }

  .hero-btn,
  .workflow-card {
    width: 100%;
  }

  .workflow-section {
    padding-top: 20px;
  }

  .section-heading h2,
  .landing-cta h2 {
    font-size: 1.65rem;
  }

  .runbook-item {
    padding: 20px;
  }

  .faq-item summary {
    padding: 0 46px 0 18px;
  }

  .landing-cta {
    align-items: flex-start;
    padding: 24px;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-hero,
  .quick-links,
  .landing-section,
  .metrics-strip,
  .landing-cta,
  .motivation-icon {
    animation: none;
  }

  .workflow-card,
  .motivation-card,
  .runbook-item,
  .faq-item {
    transition: none;
  }
}
</style>
