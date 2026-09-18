<script setup lang="ts">
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  FlaskConical,
  KeyRound,
  RefreshCw,
  Radio,
  ShieldAlert,
  Trash2,
} from "@lucide/vue";
import { onMounted } from "vue";
import { SHOPIFY_WEBHOOK_TOPICS } from "~~/types/webhook";
import type { WebhookDeliveryHealth } from "~~/types/webhook";

const { locale, t } = useLocalization();
const {
  actionKey,
  configuration,
  configurationError,
  configuredStoreCount,
  isRefreshing,
  stores,
  refresh,
  removeSubscription,
  rotateStreamToken,
  synchronizeAndRefresh,
  testWebhook,
} = useWebhookSettings();

function formatDate(value: string | null | undefined) {
  if (!value) return t("webhook.never");
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat(locale.value, {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(timestamp)
    : t("webhook.never");
}

function topicLabel(topic: string) {
  return topic.toLowerCase().replaceAll("_", " ");
}

function deliveryLabel(delivery: WebhookDeliveryHealth | null) {
  if (!delivery) return t("webhook.noDelivery");
  return t(`webhook.delivery.${delivery.status}` as "webhook.delivery.succeeded");
}

onMounted(() => void refresh());
</script>

<template>
  <section class="webhook-card">
    <header class="webhook-heading">
      <span class="webhook-icon"><Radio /></span>
      <div>
        <h2>{{ t("webhook.title") }}</h2>
        <p>{{ t("webhook.description") }}</p>
      </div>
      <span class="store-count">
        {{ t("webhook.storeCount", { count: configuredStoreCount }) }}
      </span>
    </header>

    <div class="webhook-content">
      <div
        v-if="configurationError || configuration?.error"
        class="diagnostic is-danger"
        role="alert"
      >
        <ShieldAlert />
        <span>{{ configurationError || configuration?.error }}</span>
      </div>
      <div
        v-if="configuration?.explicitPublicUrlRecommended"
        class="diagnostic is-warning"
        role="status"
      >
        <AlertTriangle />
        <span>{{ t("webhook.publicUrlWarning") }}</span>
      </div>
      <div
        v-if="configuration && !configuration.encryptionKeyConfigured"
        class="diagnostic is-warning"
        role="status"
      >
        <AlertTriangle />
        <span>{{ t("webhook.encryptionMissing") }}</span>
      </div>
      <div
        v-else-if="configuration?.unreadableEncryptedShopCount"
        class="diagnostic is-danger"
        role="alert"
      >
        <ShieldAlert />
        <span>
          {{
            t("webhook.encryptionMismatch", {
              count: configuration.unreadableEncryptedShopCount,
            })
          }}
        </span>
      </div>
      <div class="webhook-toolbar">
        <div class="callback-summary">
          <span>{{ t("webhook.callbackUrl") }}</span>
          <code>{{ configuration?.webhookUrl || "—" }}</code>
          <small v-if="configuration">
            {{
              configuration.sharedStorageConfigured
                ? t("webhook.sharedStorage")
                : t("webhook.singleInstanceStorage")
            }}
          </small>
        </div>
        <div class="toolbar-actions">
          <BaseButton
            :loading="isRefreshing"
            :disabled="Boolean(actionKey)"
            @click="refresh"
          >
            <template #icon><RefreshCw /></template>
            {{ t("webhook.refresh") }}
          </BaseButton>
          <BaseButton
            variant="primary"
            :loading="actionKey === 'synchronize'"
            :disabled="Boolean(actionKey)"
            @click="synchronizeAndRefresh"
          >
            <template #icon><Activity /></template>
            {{ t("webhook.synchronize") }}
          </BaseButton>
        </div>
      </div>

      <div v-if="!stores.length && !isRefreshing" class="webhook-empty">
        <CircleOff />
        <strong>{{ t("webhook.emptyTitle") }}</strong>
        <span>{{ t("webhook.emptyDescription") }}</span>
      </div>

      <article v-for="store in stores" :key="store.storeId" class="store-webhooks">
        <header>
          <div>
            <strong>{{ store.storeId }}</strong>
            <small>{{ store.status?.shopDomain || t("webhook.loading") }}</small>
          </div>
          <div class="store-actions">
            <BaseButton
              :loading="actionKey === `rotate:${store.storeId}`"
              :disabled="
                Boolean(actionKey) || !store.status || !store.status.streamTokenVersion
              "
              @click="rotateStreamToken(store.storeId)"
            >
              <template #icon><KeyRound /></template>
              {{ t("webhook.rotate") }}
            </BaseButton>
            <BaseButton
              :loading="actionKey === `test:${store.storeId}`"
              :disabled="
                Boolean(actionKey) || !store.status || Boolean(store.status.error)
              "
              @click="testWebhook(store.storeId)"
            >
              <template #icon><FlaskConical /></template>
              {{ t("webhook.test") }}
            </BaseButton>
          </div>
        </header>

        <p v-if="store.error || store.status?.error" class="store-error" role="alert">
          {{ store.error || store.status?.error }}
        </p>
        <template v-if="store.status">
          <div class="delivery-health">
            <CheckCircle2
              v-if="store.status.delivery?.status === 'succeeded'"
              class="is-success"
            />
            <AlertTriangle
              v-else-if="store.status.delivery?.status === 'failed'"
              class="is-failure"
            />
            <Activity v-else />
            <div>
              <strong>{{ deliveryLabel(store.status.delivery) }}</strong>
              <small>
                {{
                  t("webhook.lastAttempt", {
                    date: formatDate(store.status.delivery?.attemptedAt),
                  })
                }}
              </small>
              <small v-if="store.status.delivery?.error" class="is-failure">
                {{ store.status.delivery.error }}
              </small>
              <small v-if="store.status.streamTokenVersion">
                {{
                  t("webhook.streamTokenMetadata", {
                    version: store.status.streamTokenVersion,
                    date: formatDate(store.status.streamTokenIssuedAt),
                  })
                }}
              </small>
            </div>
          </div>

          <div class="topic-coverage">
            <span
              v-for="topic in SHOPIFY_WEBHOOK_TOPICS"
              :key="topic"
              :class="{
                active: store.status.subscriptions.some(
                  (subscription) =>
                    subscription.topic === topic && subscription.isCurrentCallback,
                ),
              }"
            >
              {{ topicLabel(topic) }}
            </span>
          </div>

          <div class="subscription-list">
            <div
              v-for="subscription in store.status.subscriptions"
              :key="subscription.id"
              class="subscription-row"
            >
              <div>
                <strong>{{ topicLabel(subscription.topic) }}</strong>
                <code>{{ subscription.uri }}</code>
                <small>
                  {{
                    t("webhook.updatedAt", { date: formatDate(subscription.updatedAt) })
                  }}
                </small>
              </div>
              <span
                class="callback-state"
                :class="{ active: subscription.isCurrentCallback }"
              >
                {{
                  subscription.isCurrentCallback
                    ? t("webhook.currentCallback")
                    : t("webhook.staleCallback")
                }}
              </span>
              <BaseButton
                variant="danger-ghost"
                icon-only
                :title="t('webhook.remove')"
                :aria-label="t('webhook.remove')"
                :loading="actionKey === `delete:${subscription.id}`"
                :disabled="Boolean(actionKey)"
                @click="removeSubscription(store.storeId, subscription)"
              >
                <template #icon><Trash2 /></template>
              </BaseButton>
            </div>
          </div>
        </template>
      </article>
    </div>
  </section>
</template>

<style scoped>
.webhook-card {
  grid-column: 1 / -1;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.webhook-heading {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}

.webhook-heading > div {
  min-width: 0;
  flex: 1;
}

.webhook-heading h2,
.webhook-heading p {
  margin: 0;
}

.webhook-heading h2 {
  font-size: 16px;
}

.webhook-heading p {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}

.webhook-icon {
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 9px;
  background: var(--green-soft);
  color: var(--green);
}

.webhook-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.store-count,
.callback-state {
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.webhook-content {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.diagnostic {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--amber) 35%, var(--border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--amber) 9%, var(--surface));
  color: var(--text);
  font-size: 11px;
  line-height: 1.5;
}

.diagnostic.is-danger {
  border-color: color-mix(in srgb, var(--red) 30%, var(--border));
  background: var(--red-soft);
  color: var(--red);
}

.diagnostic svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  margin-top: 1px;
}

.webhook-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.callback-summary {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.callback-summary > span,
.callback-summary > small {
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
}

.callback-summary code {
  color: var(--text-link);
  font-family: var(--font-mono);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
}

.store-webhooks {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-raised);
}

.store-webhooks > header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}

.store-webhooks > header > div,
.delivery-health > div,
.subscription-row > div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.store-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
}

.store-webhooks strong {
  font-size: 12px;
}

.store-webhooks small {
  color: var(--muted);
  font-size: 10px;
}

.delivery-health {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}

.delivery-health > svg {
  width: 17px;
  height: 17px;
  color: var(--muted);
}

.is-success {
  color: var(--green) !important;
}

.is-failure {
  color: var(--red) !important;
}

.topic-coverage {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
}

.topic-coverage span {
  padding: 4px 7px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted);
  font-size: 9px;
  text-transform: capitalize;
}

.topic-coverage span.active,
.callback-state.active {
  border-color: color-mix(in srgb, var(--green) 30%, var(--border));
  background: var(--green-soft);
  color: var(--green);
}

.subscription-list {
  display: grid;
}

.subscription-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
}

.subscription-row:last-child {
  border-bottom: 0;
}

.subscription-row code {
  color: var(--text-link);
  font-family: var(--font-mono);
  font-size: 10px;
  overflow-wrap: anywhere;
}

.store-error {
  margin: 0;
  padding: 12px 14px;
  color: var(--red);
  font-size: 11px;
}

.webhook-empty {
  display: grid;
  justify-items: center;
  gap: 5px;
  padding: 28px;
  color: var(--muted);
  text-align: center;
}

.webhook-empty svg {
  width: 22px;
}

.webhook-empty strong {
  color: var(--text);
  font-size: 12px;
}

.webhook-empty span {
  font-size: 11px;
}

@media (max-width: 700px) {
  .webhook-heading,
  .webhook-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .store-count {
    align-self: flex-start;
    margin-left: 48px;
  }

  .toolbar-actions {
    align-self: stretch;
  }

  .store-actions {
    justify-self: end;
  }

  .toolbar-actions :deep(.base-button) {
    flex: 1;
  }

  .subscription-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .callback-state {
    grid-column: 1;
    justify-self: start;
  }
}
</style>
