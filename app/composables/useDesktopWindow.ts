import { readonly, ref } from "vue";

type Unlisten = () => void;

const isDesktopApp = ref(false);
const isMaximized = ref(false);

async function getDesktopWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

async function refreshMaximizedState() {
  if (!isDesktopApp.value) return;
  isMaximized.value = await (await getDesktopWindow()).isMaximized();
}

export function useDesktopWindow() {
  async function initialize(): Promise<Unlisten | undefined> {
    if (!import.meta.client || !("__TAURI_INTERNALS__" in window)) return;

    isDesktopApp.value = true;

    try {
      const appWindow = await getDesktopWindow();
      await refreshMaximizedState();

      return await appWindow.onResized(() => {
        void refreshMaximizedState();
      });
    } catch {
      isDesktopApp.value = false;
      return undefined;
    }
  }

  async function minimize() {
    await (await getDesktopWindow()).minimize();
  }

  async function toggleMaximize() {
    await (await getDesktopWindow()).toggleMaximize();
    await refreshMaximizedState();
  }

  async function close() {
    await (await getDesktopWindow()).close();
  }

  async function openWebviewUrl(url: string) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_webview_url", { url });
  }

  return {
    isDesktopApp: readonly(isDesktopApp),
    isMaximized: readonly(isMaximized),
    initialize,
    minimize,
    toggleMaximize,
    close,
    openWebviewUrl,
  };
}
