<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from "vue";
import type { LocaleCode } from "~/locales/messages";

const { availableLocales, locale, setLocale, t } = useLocalization();
const isOpen = ref(false);
const switcherRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const menuId = `${useId()}-locale-menu`;

const currentLocale = computed(() => locale.value);
const currentOption = computed(
  () =>
    availableLocales.value.find((option) => option.code === currentLocale.value) ||
    availableLocales.value[0],
);

function getFlagUrl(flagCode?: string) {
  return `https://flagsapi.com/${flagCode || "US"}/flat/24.png`;
}

function focusOption(index: number) {
  const options =
    switcherRef.value?.querySelectorAll<HTMLButtonElement>(".locale-option");
  if (!options?.length) return;

  const normalizedIndex = (index + options.length) % options.length;
  options[normalizedIndex]?.focus();
}

async function openMenu(focusIndex?: number) {
  isOpen.value = true;
  await nextTick();

  if (focusIndex !== undefined) {
    focusOption(focusIndex);
  }
}

function closeMenu({ restoreFocus = false } = {}) {
  isOpen.value = false;
  if (restoreFocus) void nextTick(() => triggerRef.value?.focus());
}

function toggleMenu() {
  if (isOpen.value) closeMenu();
  else void openMenu();
}

async function selectLocale(code: LocaleCode) {
  closeMenu();
  await setLocale(code);
  await nextTick();
  triggerRef.value?.focus();
}

function handleTriggerKeydown(event: KeyboardEvent) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

  event.preventDefault();
  const selectedIndex = availableLocales.value.findIndex(
    (option) => option.code === currentLocale.value,
  );
  const direction = event.key === "ArrowDown" ? 1 : -1;
  void openMenu(selectedIndex + direction);
}

function handleOptionKeydown(event: KeyboardEvent, index: number) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    focusOption(index + (event.key === "ArrowDown" ? 1 : -1));
    return;
  }

  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    focusOption(event.key === "Home" ? 0 : availableLocales.value.length - 1);
  }
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!switcherRef.value?.contains(event.target as Node)) closeMenu();
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && isOpen.value) {
    event.preventDefault();
    closeMenu({ restoreFocus: true });
  }
}

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  document.addEventListener("keydown", handleDocumentKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  document.removeEventListener("keydown", handleDocumentKeydown);
});
</script>

<template>
  <div ref="switcherRef" class="locale-switcher">
    <button
      ref="triggerRef"
      class="locale-trigger"
      type="button"
      :aria-label="t('nav.language')"
      :aria-controls="menuId"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      @click.stop="toggleMenu"
      @keydown="handleTriggerKeydown"
    >
      <span class="locale-code" aria-hidden="true">
        <img :src="getFlagUrl(currentOption?.flagCode)" alt="" width="24" height="24" />
      </span>
      <span class="locale-name">{{ currentOption?.nativeLabel }}</span>
      <span class="locale-caret" aria-hidden="true" />
    </button>

    <Transition name="locale-menu">
      <div
        v-if="isOpen"
        :id="menuId"
        class="locale-menu"
        role="listbox"
        :aria-label="t('nav.language')"
        @pointerdown.stop
        @click.stop
      >
        <button
          v-for="(option, index) in availableLocales"
          :key="option.code"
          class="locale-option"
          :class="{ active: option.code === currentLocale }"
          type="button"
          role="option"
          :data-locale="option.code"
          :aria-selected="option.code === currentLocale"
          @keydown="handleOptionKeydown($event, index)"
          @click="selectLocale(option.code)"
        >
          <span class="locale-option-code" aria-hidden="true">
            <img :src="getFlagUrl(option.flagCode)" alt="" width="24" height="24" />
          </span>
          <span class="locale-option-copy">
            <strong>{{ option.nativeLabel }}</strong>
            <small>
              {{ option.label }}
              <em v-if="option.coverage === 'partial'">
                {{ t("locale.partialCoverage") }}
              </em>
            </small>
          </span>
          <span
            v-if="option.code === currentLocale"
            class="locale-check"
            aria-hidden="true"
          />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.locale-switcher {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.locale-trigger {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 0 10px 0 4px;
  box-shadow: var(--shadow-soft);
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease;
}

.locale-trigger[aria-expanded="true"] {
  border-color: rgba(31, 122, 77, 0.38);
}

.locale-code,
.locale-option-code {
  display: inline-grid;
  width: 28px;
  height: 24px;
  place-items: center;
  overflow: hidden;
  border-radius: 5px;
}

.locale-code img,
.locale-option-code img {
  display: block;
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.locale-name {
  max-width: 82px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.locale-caret {
  width: 7px;
  height: 7px;
  border-right: 1.8px solid currentColor;
  border-bottom: 1.8px solid currentColor;
  opacity: 0.72;
  transform: translateY(-2px) rotate(45deg);
}

.locale-menu {
  position: absolute;
  top: calc(100% + 8px);
  inset-inline-end: 0;
  z-index: 1000;
  display: grid;
  width: 200px;
  gap: 3px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 18px 50px rgba(20, 34, 27, 0.16);
  padding: 6px;
}

.locale-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 12px;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  padding: 5px 9px;
  text-align: start;
}

.locale-option:hover,
.locale-option:focus-visible,
.locale-option.active {
  background: var(--surface-soft);
}

.locale-option-copy {
  display: grid;
  min-width: 0;
  line-height: 1.25;
}

.locale-option-copy strong,
.locale-option-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.locale-option-copy em {
  margin-inline-start: 4px;
  color: var(--amber);
  font-style: normal;
}

.locale-option-copy strong {
  font-size: 13px;
  font-weight: 600;
}

.locale-option-copy small {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
}

.locale-check {
  width: 9px;
  height: 14px;
  border-right: 2px solid var(--green);
  border-bottom: 2px solid var(--green);
  transform: rotate(45deg);
}

.locale-menu-enter-active,
.locale-menu-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.locale-menu-enter-from,
.locale-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.locale-trigger:focus-visible,
.locale-option:focus-visible {
  outline: 2px solid rgba(31, 122, 77, 0.45);
  outline-offset: 2px;
}

:global(html[data-theme="dark"]) .locale-menu {
  box-shadow: 0 18px 52px rgba(0, 0, 0, 0.38);
}

@media (max-width: 700px) {
  .locale-menu {
    inset-inline-end: auto;
    inset-inline-start: 50%;
    transform: translateX(-50%);
  }

  :global(html[data-locale-direction="rtl"]) .locale-menu {
    transform: translateX(50%);
  }

  .locale-menu-enter-from,
  .locale-menu-leave-to {
    transform: translateX(-50%) translateY(-4px);
  }

  :global(html[data-locale-direction="rtl"]) .locale-menu-enter-from,
  :global(html[data-locale-direction="rtl"]) .locale-menu-leave-to {
    transform: translateX(50%) translateY(-4px);
  }
}
</style>
