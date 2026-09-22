<script setup lang="ts">
import {
  Bell,
  Boxes,
  CheckCheck,
  CircleDollarSign,
  PackageCheck,
  PackageOpen,
  ShoppingBag,
  Trash2,
  UserRound,
  Wifi,
  WifiOff,
} from "@lucide/vue";
import { storeToRefs } from "pinia";
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from "vue";
import { useNotificationStore } from "~/stores/notifications";
import type { ClientWebhookNotification } from "~~/types/webhook";
import type { MessageKey } from "~/locales/messages";

const { locale, t } = useLocalization();
const notificationStore = useNotificationStore();
const {
  notifications,
  unreadCount,
  connectionState,
  connectionError,
  connectedStores,
} = storeToRefs(notificationStore);
const isOpen = ref(false);
const centerRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const menuId = `${useId()}-notification-menu`;

function toggleMenu() {
  isOpen.value = !isOpen.value;
}

function closeMenu({ restoreFocus = false } = {}) {
  isOpen.value = false;
  if (restoreFocus) void nextTick(() => triggerRef.value?.focus());
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!centerRef.value?.contains(event.target as Node)) closeMenu();
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && isOpen.value) {
    event.preventDefault();
    closeMenu({ restoreFocus: true });
  }
}

function notificationTitle(notification: ClientWebhookNotification) {
  const key = {
    APP_UNINSTALLED: "notification.appUninstalled",
    SHOP_UPDATE: "notification.shopUpdated",
    ORDERS_CREATE: "notification.orderCreated",
    ORDERS_UPDATED: "notification.orderUpdated",
    ORDERS_DELETE: "notification.orderDeleted",
    FULFILLMENTS_CREATE: "notification.fulfillmentCreated",
    FULFILLMENTS_UPDATE: "notification.fulfillmentUpdated",
    REFUNDS_CREATE: "notification.refundCreated",
    DISPUTES_CREATE: "notification.disputeCreated",
    DISPUTES_UPDATE: "notification.disputeUpdated",
    PRODUCTS_CREATE: "notification.productCreated",
    PRODUCTS_UPDATE: "notification.productUpdated",
    PRODUCTS_DELETE: "notification.productDeleted",
    INVENTORY_LEVELS_UPDATE: "notification.inventoryUpdated",
    CUSTOMERS_CREATE: "notification.customerCreated",
    CUSTOMERS_DELETE: "notification.customerDeleted",
  }[notification.topic] as MessageKey;
  return t(key, { name: notification.orderName });
}

function notificationDetail(notification: ClientWebhookNotification) {
  return t("notification.detail", {
    shop: notification.shopDomain.replace(/\.myshopify\.com$/i, ""),
    status: humanizeStatus(notification.status),
  });
}

function humanizeStatus(value: string) {
  return String(value || "updated")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function notificationLink(notification: ClientWebhookNotification) {
  if (notification.orderId) {
    return {
      path: `/order/${notification.orderId}`,
      query: { shop: notification.storeId },
    };
  }
  if (notification.kind === "dispute") return { path: "/payment" };
  if (["product", "inventory"].includes(notification.kind)) {
    return { path: "/product" };
  }
  if (notification.kind === "customer") return { path: "/customer" };
  return { path: "/dashboard" };
}

function selectNotification(notification: ClientWebhookNotification) {
  notificationStore.markRead(notification.id);
  closeMenu();
}

function formatRelativeTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "—";
  const elapsedSeconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale.value, { numeric: "auto" });
  if (Math.abs(elapsedSeconds) < 60) return formatter.format(elapsedSeconds, "second");

  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (Math.abs(elapsedMinutes) < 60) return formatter.format(elapsedMinutes, "minute");

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) return formatter.format(elapsedHours, "hour");
  return formatter.format(Math.round(elapsedHours / 24), "day");
}

function connectionLabel() {
  if (connectionState.value === "connected") {
    return t("notification.liveStores", { count: connectedStores.value });
  }
  if (["registering", "connecting"].includes(connectionState.value)) {
    return t("notification.connecting");
  }
  if (connectionState.value === "error") return t("notification.unavailable");
  return t("notification.waitingForStore");
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
  <div ref="centerRef" class="notification-center">
    <button
      ref="triggerRef"
      class="notification-trigger"
      type="button"
      :aria-label="t('notification.title')"
      :aria-controls="menuId"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
      @click.stop="toggleMenu"
    >
      <Bell aria-hidden="true" />
      <span v-if="unreadCount" class="notification-badge" aria-hidden="true">
        {{ unreadCount > 99 ? "99+" : unreadCount }}
      </span>
      <span class="sr-only">{{
        t("notification.unread", { count: unreadCount })
      }}</span>
    </button>

    <Transition name="notification-menu">
      <section
        v-if="isOpen"
        :id="menuId"
        class="notification-menu"
        role="menu"
        :aria-label="t('notification.title')"
        @pointerdown.stop
        @click.stop
      >
        <header class="notification-header">
          <div>
            <strong>{{ t("notification.title") }}</strong>
            <small>{{ t("notification.unread", { count: unreadCount }) }}</small>
          </div>
          <button
            v-if="unreadCount"
            type="button"
            :title="t('notification.markAllRead')"
            @click="notificationStore.markAllRead()"
          >
            <CheckCheck />
            <span>{{ t("notification.markAllRead") }}</span>
          </button>
        </header>

        <div
          class="notification-connection"
          :class="`is-${connectionState}`"
          :title="connectionError || connectionLabel()"
        >
          <Wifi v-if="connectionState === 'connected'" />
          <WifiOff v-else />
          <span>{{ connectionLabel() }}</span>
        </div>

        <div v-if="notifications.length" class="notification-list">
          <NuxtLink
            v-for="notification in notifications"
            :key="notification.id"
            :to="notificationLink(notification)"
            class="notification-item"
            :class="{ unread: !notification.read }"
            role="menuitem"
            @click="selectNotification(notification)"
          >
            <span class="notification-icon" :class="notification.kind">
              <PackageCheck v-if="notification.kind === 'fulfillment'" />
              <CircleDollarSign
                v-else-if="['refund', 'dispute'].includes(notification.kind)"
              />
              <Boxes v-else-if="notification.kind === 'inventory'" />
              <PackageOpen v-else-if="notification.kind === 'product'" />
              <UserRound v-else-if="notification.kind === 'customer'" />
              <Bell v-else-if="['app', 'shop'].includes(notification.kind)" />
              <ShoppingBag v-else />
            </span>
            <span class="notification-copy">
              <strong>{{ notificationTitle(notification) }}</strong>
              <small>{{ notificationDetail(notification) }}</small>
              <time :datetime="notification.occurredAt">
                {{ formatRelativeTime(notification.occurredAt) }}
              </time>
            </span>
            <span v-if="!notification.read" class="notification-unread-dot" />
          </NuxtLink>
        </div>

        <div v-else class="notification-empty">
          <Bell />
          <strong>{{ t("notification.emptyTitle") }}</strong>
          <span>{{ t("notification.emptyDescription") }}</span>
        </div>

        <footer v-if="notifications.length" class="notification-footer">
          <button type="button" @click="notificationStore.clearNotifications()">
            <Trash2 />
            {{ t("notification.clear") }}
          </button>
        </footer>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.notification-center {
  position: relative;
  display: inline-flex;
}

.notification-trigger {
  position: relative;
  display: inline-grid;
  width: 34px;
  height: 32px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  box-shadow: var(--shadow-soft);
}

.notification-trigger:hover,
.notification-trigger[aria-expanded="true"] {
  border-color: rgba(31, 122, 77, 0.42);
  color: var(--green);
}

.notification-trigger svg {
  width: 16px;
  height: 16px;
}

.notification-badge {
  position: absolute;
  inset-block-start: -6px;
  inset-inline-end: -7px;
  display: inline-grid;
  min-width: 17px;
  height: 17px;
  place-items: center;
  border: 2px solid var(--surface);
  border-radius: 999px;
  background: var(--red);
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
  padding: 0 3px;
}

.notification-menu {
  position: absolute;
  top: calc(100% + 8px);
  inset-inline-end: 0;
  z-index: 1000;
  width: min(380px, calc(100vw - 24px));
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 20px 56px rgba(20, 34, 27, 0.18);
}

.notification-header,
.notification-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
}

.notification-header {
  border-bottom: 1px solid var(--line);
}

.notification-header > div {
  display: grid;
  line-height: 1.3;
}

.notification-header strong {
  font-size: 14px;
}

.notification-header small {
  color: var(--muted);
  font-size: 11px;
}

.notification-header button,
.notification-footer button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  background: transparent;
  color: var(--green);
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
}

.notification-header button svg,
.notification-footer button svg {
  width: 14px;
  height: 14px;
}

.notification-connection {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  padding: 5px 14px;
}

.notification-connection.is-connected {
  color: var(--green);
}

.notification-connection.is-error {
  color: var(--red);
}

.notification-connection svg {
  width: 12px;
  height: 12px;
}

.notification-list {
  max-height: min(440px, 65vh);
  overflow-y: auto;
}

.notification-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 8px;
  align-items: start;
  gap: 10px;
  border-bottom: 1px solid var(--line);
  color: var(--text);
  padding: 12px 14px;
  text-decoration: none;
}

.notification-item:hover,
.notification-item:focus-visible,
.notification-item.unread {
  background: var(--surface-soft);
}

.notification-icon {
  display: inline-grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 8px;
  background: var(--blue-soft);
  color: var(--blue);
}

.notification-icon.fulfillment {
  background: var(--green-soft);
  color: var(--green);
}

.notification-icon.refund,
.notification-icon.dispute {
  background: var(--amber-soft);
  color: var(--amber);
}

.notification-icon.product,
.notification-icon.inventory {
  background: var(--violet-soft);
  color: var(--violet);
}

.notification-icon.customer {
  background: var(--green-soft);
  color: var(--green);
}

.notification-icon svg {
  width: 16px;
  height: 16px;
}

.notification-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.notification-copy strong,
.notification-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-copy strong {
  font-size: 12px;
}

.notification-copy small,
.notification-copy time {
  color: var(--muted);
  font-size: 10px;
}

.notification-unread-dot {
  width: 7px;
  height: 7px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--green);
}

.notification-empty {
  display: grid;
  justify-items: center;
  gap: 5px;
  color: var(--muted);
  padding: 32px 18px;
  text-align: center;
}

.notification-empty > svg {
  width: 24px;
  height: 24px;
  margin-bottom: 4px;
  opacity: 0.65;
}

.notification-empty strong {
  color: var(--text);
  font-size: 13px;
}

.notification-empty span {
  font-size: 11px;
}

.notification-footer {
  justify-content: center;
  border-top: 1px solid var(--line);
}

.notification-footer button {
  color: var(--muted);
}

.notification-menu-enter-active,
.notification-menu-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.notification-menu-enter-from,
.notification-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.notification-trigger:focus-visible,
.notification-header button:focus-visible,
.notification-footer button:focus-visible,
.notification-item:focus-visible {
  outline: 2px solid rgba(31, 122, 77, 0.45);
  outline-offset: 2px;
}

:global(html[data-theme="dark"]) .notification-menu {
  box-shadow: 0 20px 58px rgba(0, 0, 0, 0.44);
}

@media (max-width: 700px) {
  .notification-center {
    position: static;
  }

  .notification-menu {
    top: calc(100% + 8px);
    inset-inline-start: 12px;
    inset-inline-end: 12px;
    width: auto;
    transform: none;
  }

  .notification-menu-enter-from,
  .notification-menu-leave-to {
    transform: translateY(-4px);
  }
}
</style>
