<script setup lang="ts">
import { Maximize2, Minus, Square, X } from "@lucide/vue";
import { useToastStore } from "~/stores/toast";

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const { t } = useLocalization();
const toast = useToastStore();
const {
  isDesktopApp,
  isMaximized,
  initialize,
  minimize,
  toggleMaximize,
  close,
  openWebviewUrl,
} = useDesktopWindow();

const webviewOptions = parseDesktopWebviewOptions(
  runtimeConfig.public.desktopWebviewUrls,
);
const selectedWebviewUrl = ref(webviewOptions[0]?.value || "");
const isCheckingWebviewUrl = ref(false);

function withActiveShop(path: string) {
  const shop = Array.isArray(route.query.shop) ? route.query.shop[0] : route.query.shop;
  return path === "/store" && shop ? { path, query: { shop } } : path;
}

async function selectWebviewUrl(value: unknown) {
  if (typeof value !== "string" || value === window.location.origin) return;

  isCheckingWebviewUrl.value = true;
  try {
    await openWebviewUrl(value);
  } catch {
    toast.error(t("desktop.webviewUnavailable", { url: value }), 6000);
  } finally {
    isCheckingWebviewUrl.value = false;
  }
}

let stopResizeListener: (() => void) | undefined;

onMounted(async () => {
  const currentOption = webviewOptions.find(
    ({ value }) => new URL(value).origin === window.location.origin,
  );
  selectedWebviewUrl.value = currentOption?.value || window.location.origin;
  stopResizeListener = await initialize();
});

onBeforeUnmount(() => stopResizeListener?.());
</script>

<template>
  <header v-if="isDesktopApp" class="desktop-titlebar">
    <div
      class="desktop-titlebar-brand"
      data-tauri-drag-region
      @dblclick="toggleMaximize"
    >
      <img src="/favicon.svg" alt="" data-tauri-drag-region />
      <span data-tauri-drag-region>Spfi</span>
    </div>

    <div
      class="desktop-titlebar-center"
      data-tauri-drag-region
      @dblclick.self="toggleMaximize"
    >
      <nav class="desktop-nav" :aria-label="t('common.appName')">
        <NuxtLink to="/setup">{{ t("nav.setup") }}</NuxtLink>
        <NuxtLink to="/manager">{{ t("nav.manager") }}</NuxtLink>
        <NuxtLink to="/dashboard">{{ t("nav.dashboard") }}</NuxtLink>
        <NuxtLink :to="withActiveShop('/store')">{{ t("nav.store") }}</NuxtLink>
        <NuxtLink to="/status">{{ t("nav.status") }}</NuxtLink>
        <NuxtLink to="/sheet">{{ t("nav.sheet") }}</NuxtLink>
        <NuxtLink to="/settings">{{ t("nav.settings") }}</NuxtLink>
      </nav>
    </div>

    <div class="desktop-app-controls">
      <LocaleSwitcher />
      <ThemeToggle />
      <BaseSelect
        class-name="desktop-titlebar-select"
        size="small"
        :model-value="selectedWebviewUrl"
        :options="webviewOptions"
        :disabled="isCheckingWebviewUrl"
        aria-label="WebView URL"
        @update:model-value="selectWebviewUrl"
      />
    </div>

    <div class="desktop-window-controls" aria-label="Window controls">
      <button type="button" aria-label="Minimize" title="Minimize" @click="minimize">
        <Minus :size="16" aria-hidden="true" />
      </button>
      <button
        type="button"
        :aria-label="isMaximized ? 'Restore' : 'Maximize'"
        :title="isMaximized ? 'Restore' : 'Maximize'"
        @click="toggleMaximize"
      >
        <Square v-if="!isMaximized" :size="12" aria-hidden="true" />
        <Maximize2 v-else :size="13" aria-hidden="true" />
      </button>
      <button
        class="desktop-window-close"
        type="button"
        aria-label="Close"
        title="Close"
        @click="close"
      >
        <X :size="16" aria-hidden="true" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.desktop-titlebar {
  position: fixed;
  inset: 0 0 auto;
  z-index: 1000;
  height: var(--desktop-titlebar-height);
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface-raised) 94%, transparent);
  color: var(--text);
  box-shadow: 0 1px 0 rgba(20, 34, 27, 0.03);
  user-select: none;
  backdrop-filter: blur(14px);
}

.desktop-titlebar-brand,
.desktop-titlebar-center {
  height: 100%;
  display: flex;
  align-items: center;
}

.desktop-titlebar-brand {
  flex: 0 0 auto;
  gap: 7px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
}

.desktop-titlebar-brand span {
  background: linear-gradient(90deg, #16a085 0%, #20c997 50%, #0ea5a8 100%);
  background-clip: text;
  color: transparent;
  font-size: 1rem;
  text-shadow: 1px 1px 2px rgba(31, 122, 77, 0.2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.desktop-titlebar-brand img {
  width: 16px;
  height: 16px;
}

.desktop-titlebar-center {
  min-width: 0;
  flex: 1 1 auto;
  justify-content: center;
  overflow: hidden;
}

.desktop-titlebar :deep(.desktop-titlebar-select) {
  width: 120px;
  flex: 0 0 120px;
}

.desktop-titlebar :deep(.desktop-titlebar-select .select-trigger) {
  min-height: 28px;
  height: 28px;
  padding-block: 3px;
  border-color: transparent;
  background: var(--surface-soft);
}

.desktop-titlebar :deep(.desktop-titlebar-select .select-dropdown) {
  top: calc(100% + 5px);
  min-width: 220px;
}

.desktop-nav,
.desktop-app-controls {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
}

.desktop-nav {
  min-width: max-content;
  gap: 4px;
}

.desktop-nav a {
  position: relative;
  padding: 5px 6px;
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.desktop-nav a::after {
  content: "";
  position: absolute;
  right: 6px;
  bottom: 2px;
  left: 6px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0;
  transform: scaleX(0.35);
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.desktop-nav a:hover,
.desktop-nav a.router-link-active {
  color: var(--green);
}

.desktop-nav a:hover::after,
.desktop-nav a.router-link-active::after {
  opacity: 1;
  transform: scaleX(1);
}

.desktop-nav a:focus-visible {
  outline: 2px solid var(--green);
  outline-offset: -1px;
}

.desktop-app-controls {
  gap: 5px;
  margin-left: 10px;
}

.desktop-titlebar :deep(.locale-trigger),
.desktop-titlebar :deep(.theme-toggle) {
  min-height: 28px;
  height: 28px;
  box-shadow: none;
}

.desktop-titlebar :deep(.theme-toggle) {
  width: 28px;
}

.desktop-window-controls {
  height: 100%;
  display: flex;
  flex: 0 0 auto;
}

.desktop-window-controls button {
  width: 46px;
  height: 100%;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text-sub);
  cursor: default;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.desktop-window-controls button:hover {
  background: var(--surface-soft);
  color: var(--text);
}

.desktop-window-controls button:focus-visible {
  position: relative;
  outline: 2px solid var(--green);
  outline-offset: -2px;
}

.desktop-window-controls .desktop-window-close:hover {
  background: #c42b1c;
  color: #fff;
}

@media (max-width: 720px) {
  .desktop-titlebar-brand span {
    display: none;
  }

  .desktop-titlebar :deep(.desktop-titlebar-select) {
    width: 160px;
    flex-basis: 160px;
  }
}

@media (max-width: 1100px) {
  .desktop-titlebar-brand {
    padding-inline: 9px;
  }

  .desktop-titlebar-brand span,
  .desktop-titlebar :deep(.locale-name),
  .desktop-titlebar :deep(.locale-caret) {
    display: none;
  }

  .desktop-titlebar :deep(.locale-trigger) {
    width: 32px;
    padding-inline: 1px;
  }

  .desktop-nav a {
    padding-inline: 4px;
    font-size: 10px;
  }

  .desktop-titlebar :deep(.desktop-titlebar-select) {
    width: 154px;
    flex-basis: 154px;
  }
}

@media (max-width: 980px) {
  .desktop-titlebar :deep(.desktop-titlebar-select) {
    width: 126px;
    flex-basis: 126px;
  }

  .desktop-nav a {
    padding-inline: 3px;
    font-size: 9px;
  }

  .desktop-window-controls button {
    width: 40px;
  }
}
</style>
