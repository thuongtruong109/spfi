import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useDashboardStore } from "~/stores/dashboard";
import { useFormStore } from "~/stores/form";
import type {
  ClientWebhookNotification,
  WebhookNotification,
  WebhookRegistrationResponse,
  WebhookStreamCredential,
} from "~~/types/webhook";
import { SHOPIFY_WEBHOOK_TOPICS } from "~~/types/webhook";
import { getAppErrorMessage } from "~~/utils/error";
import { mapSettledWithConcurrency } from "~~/utils/promise-concurrency";
import { getStoreTokenState, resolveStoreAccessToken } from "~~/utils/shop-auth";
import { extractServerSentEvents } from "~~/utils/sse";

const NOTIFICATION_STORAGE_KEY = "spf_webhook_notifications";
const MAX_CLIENT_NOTIFICATIONS = 100;
const WEBHOOK_REGISTRATION_CONCURRENCY = 3;

type ConnectionState = "idle" | "registering" | "connecting" | "connected" | "error";

export const useNotificationStore = defineStore("notifications", () => {
  const formStore = useFormStore();
  const credentialVault = useCredentialVaultStore();
  const dashboardStore = useDashboardStore();
  const notifications = ref<ClientWebhookNotification[]>([]);
  const connectionState = ref<ConnectionState>("idle");
  const connectionError = ref("");
  const connectedStores = ref(0);
  const registrationWarnings = ref<string[]>([]);
  const isInitialized = ref(false);
  const unreadCount = computed(
    () => notifications.value.filter((notification) => !notification.read).length,
  );

  let streamController: AbortController | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let synchronizeTimer: ReturnType<typeof setTimeout> | null = null;
  let registrationSequence = 0;
  let synchronizationSequence = 0;
  let reconnectAttempt = 0;
  let streamCredentials: WebhookStreamCredential[] = [];
  const registrationsByStore = new Map<
    string,
    { fingerprint: string; registration: WebhookRegistrationResponse }
  >();

  function initialize() {
    if (typeof window === "undefined" || isInitialized.value) return;
    isInitialized.value = true;
    loadStoredNotifications();
    formStore.loadKnownStores();
    credentialVault.initialize();

    watch(
      () => `${formStore.knownStores.join("|")}:${credentialVault.storeDataRevision}`,
      scheduleSynchronization,
    );
    void synchronize();
  }

  function scheduleSynchronization() {
    if (synchronizeTimer) clearTimeout(synchronizeTimer);
    synchronizeTimer = setTimeout(() => void synchronize(), 350);
  }

  async function synchronize() {
    if (typeof window === "undefined") return;
    const requestSequence = ++registrationSequence;
    const stateBeforeRegistration = connectionState.value;
    connectionError.value = "";
    const knownStores = new Set(formStore.knownStores);
    for (const storeId of registrationsByStore.keys()) {
      if (!knownStores.has(storeId)) registrationsByStore.delete(storeId);
    }

    const candidates = formStore.knownStores.flatMap((storeId) => {
      const data = credentialVault.getStoreData(storeId);
      const token = resolveStoreAccessToken(data);
      const clientSecret = String(data.clientSecret || "").trim();
      const fingerprint = getRegistrationFingerprint(
        storeId,
        data.domain,
        clientSecret,
      );
      const cached = registrationsByStore.get(storeId);
      if (
        cached?.fingerprint === fingerprint &&
        !cached.registration.synchronizationError
      ) {
        return [];
      }
      if (cached && cached.fingerprint !== fingerprint) {
        registrationsByStore.delete(storeId);
      }
      return getStoreTokenState(data) === "valid" && token && clientSecret
        ? [{ storeId, token, clientSecret, fingerprint }]
        : [];
    });
    if (candidates.length) connectionState.value = "registering";
    const results = await mapSettledWithConcurrency(
      candidates,
      WEBHOOK_REGISTRATION_CONCURRENCY,
      ({ storeId, token, clientSecret, fingerprint }) =>
        $fetch<WebhookRegistrationResponse>("/api/webhooks/register", {
          method: "POST",
          body: { storeId, token, clientSecret },
        }).then((registration) => ({ fingerprint, registration })),
    );
    if (requestSequence !== registrationSequence) return;

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      registrationsByStore.set(result.value.registration.storeId, result.value);
    }
    const registrations = [...registrationsByStore.values()].map(
      ({ registration }) => registration,
    );
    registrationWarnings.value = [
      ...registrations.flatMap((result) => result.warnings),
      ...results.flatMap((result) =>
        result.status === "rejected"
          ? [getAppErrorMessage(result.reason, "Webhook registration unavailable.")]
          : [],
      ),
    ];
    if (!registrations.length) {
      stopStream();
      streamCredentials = [];
      connectedStores.value = 0;
      synchronizationSequence += 1;
      connectionState.value = results.length ? "error" : "idle";
      connectionError.value = results.length ? getRegistrationError(results) : "";
      return;
    }

    const nextCredentials = registrations
      .map((registration) => ({
        storeId: registration.storeId,
        token: registration.streamToken,
      }))
      .sort((left, right) => left.storeId.localeCompare(right.storeId));
    connectedStores.value = registrations.length;
    if (sameStreamCredentials(streamCredentials, nextCredentials) && streamController) {
      connectionState.value = stateBeforeRegistration;
      return;
    }

    stopStream();
    streamCredentials = nextCredentials;
    reconnectAttempt = 0;
    const sequence = ++synchronizationSequence;
    void connectStream(sequence);
  }

  async function connectStream(sequence: number) {
    if (!streamCredentials.length || sequence !== synchronizationSequence) return;
    streamController = new AbortController();
    connectionState.value = "connecting";

    try {
      const response = await fetch("/api/webhooks/stream", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptions: streamCredentials }),
        signal: streamController.signal,
      });
      if (!response.ok || !response.body) {
        if (response.status === 401) {
          registrationsByStore.clear();
          scheduleSynchronization();
          return;
        }
        throw new Error(`Notification stream returned HTTP ${response.status}.`);
      }

      await consumeStream(response.body, sequence);
      if (sequence === synchronizationSequence && !streamController.signal.aborted) {
        throw new Error("Notification stream closed unexpectedly.");
      }
    } catch (error) {
      if (isAbortError(error) || sequence !== synchronizationSequence) return;
      connectionState.value = "error";
      connectionError.value =
        error instanceof Error ? error.message : "Notification stream unavailable.";
      scheduleStreamReconnect(sequence);
    }
  }

  async function consumeStream(stream: ReadableStream<Uint8Array>, sequence: number) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (sequence === synchronizationSequence) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const extracted = extractServerSentEvents(buffer);
        buffer = extracted.remainder;

        for (const event of extracted.events) {
          if (event.event === "connected") {
            reconnectAttempt = 0;
            connectionState.value = "connected";
            connectionError.value = "";
          } else if (event.event === "notification") {
            receiveNotification(event.data);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  function receiveNotification(serialized: string) {
    let notification: WebhookNotification;
    try {
      notification = JSON.parse(serialized) as WebhookNotification;
    } catch {
      return;
    }
    if (
      !notification?.id ||
      notifications.value.some((item) => item.id === notification.id)
    ) {
      return;
    }

    if (notification.topic === "APP_UNINSTALLED") {
      credentialVault.removeStoreData(notification.storeId);
      formStore.removeKnownStore(notification.storeId);
      registrationsByStore.delete(notification.storeId);
      notifications.value = notifications.value.filter(
        (item) => item.storeId !== notification.storeId,
      );
      scheduleSynchronization();
    }

    notifications.value = [
      { ...notification, read: false },
      ...notifications.value,
    ].slice(0, MAX_CLIENT_NOTIFICATIONS);
    persistNotifications();
    if (notification.topic !== "APP_UNINSTALLED") {
      dashboardStore.refreshFromWebhook();
    }
  }

  function invalidateRegistration(storeId: string) {
    registrationsByStore.delete(storeId);
  }

  function markRead(id: string) {
    const notification = notifications.value.find((item) => item.id === id);
    if (!notification || notification.read) return;
    notification.read = true;
    persistNotifications();
  }

  function markAllRead() {
    let changed = false;
    for (const notification of notifications.value) {
      if (!notification.read) {
        notification.read = true;
        changed = true;
      }
    }
    if (changed) persistNotifications();
  }

  function clearNotifications() {
    notifications.value = [];
    persistNotifications();
  }

  function scheduleStreamReconnect(sequence: number) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttempt++);
    reconnectTimer = setTimeout(() => void connectStream(sequence), delay);
  }

  function stopStream() {
    streamController?.abort();
    streamController = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function loadStoredNotifications() {
    try {
      const parsed = JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) || "[]");
      if (Array.isArray(parsed)) {
        notifications.value = parsed
          .filter(isStoredNotification)
          .slice(0, MAX_CLIENT_NOTIFICATIONS) as ClientWebhookNotification[];
      }
    } catch {
      notifications.value = [];
    }
  }

  function persistNotifications() {
    if (typeof window === "undefined") return;
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications.value));
  }

  return {
    notifications,
    unreadCount,
    connectionState,
    connectionError,
    connectedStores,
    registrationWarnings,
    isInitialized,
    initialize,
    invalidateRegistration,
    synchronize,
    markRead,
    markAllRead,
    clearNotifications,
  };
});

function getRegistrationError(results: PromiseSettledResult<unknown>[]) {
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (!rejected) return "Webhook registration unavailable.";

  return getAppErrorMessage(rejected.reason, "Webhook registration unavailable.");
}

function getRegistrationFingerprint(
  storeId: string,
  domain: string | undefined,
  clientSecret: string,
) {
  return [
    storeId,
    String(domain || "")
      .trim()
      .toLowerCase(),
    clientSecret,
  ].join("\u0000");
}

function sameStreamCredentials(
  current: WebhookStreamCredential[],
  next: WebhookStreamCredential[],
) {
  return (
    current.length === next.length &&
    current.every(
      (credential, index) =>
        credential.storeId === next[index]?.storeId &&
        credential.token === next[index]?.token,
    )
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isStoredNotification(value: unknown): value is ClientWebhookNotification {
  if (!value || typeof value !== "object") return false;
  const notification = value as Partial<ClientWebhookNotification>;
  return (
    typeof notification.id === "string" &&
    typeof notification.storeId === "string" &&
    typeof notification.shopDomain === "string" &&
    typeof notification.occurredAt === "string" &&
    typeof notification.read === "boolean" &&
    SHOPIFY_WEBHOOK_TOPICS.includes(
      notification.topic as (typeof SHOPIFY_WEBHOOK_TOPICS)[number],
    )
  );
}
