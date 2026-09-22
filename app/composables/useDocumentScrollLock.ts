import { onActivated, onDeactivated, onMounted, onUnmounted } from "vue";

let activeLocks = 0;
let previousHtmlOverflow = "";
let previousBodyOverflow = "";

function lockDocumentScroll() {
  if (typeof document === "undefined") return () => {};

  if (activeLocks === 0) {
    previousHtmlOverflow = document.documentElement.style.overflow;
    previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  activeLocks += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    activeLocks = Math.max(0, activeLocks - 1);

    if (activeLocks === 0) {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    }
  };
}

export function useDocumentScrollLock() {
  let release: (() => void) | undefined;

  function acquire() {
    if (release) return;
    release = lockDocumentScroll();
  }

  function releaseLock() {
    release?.();
    release = undefined;
  }

  onMounted(acquire);
  onActivated(acquire);
  onDeactivated(releaseLock);
  onUnmounted(releaseLock);
}
