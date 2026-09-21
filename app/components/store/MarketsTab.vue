<script setup lang="ts">
import {
  ArrowUpRight,
  CircleDollarSign,
  Globe2,
  MapPinned,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Truck,
} from "@lucide/vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import ApiLoadingIcon from "~/components/ApiLoadingIcon.vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useMarketStore } from "~/stores/market";
import MarketCreateModal from "./MarketCreateModal.vue";
import MarketEditorModal from "./MarketEditorModal.vue";
import type {
  ShopifyMarketStatus,
  ShopifyMarketSummary,
  ShopifyMarketType,
} from "~~/types/shopify-market";
import { getSafeExternalUrl } from "~~/utils/safe-url";

type StatusFilter = "ALL" | ShopifyMarketStatus;
type TypeFilter = "ALL" | ShopifyMarketType;
type ConditionFilter = "ALL" | Exclude<ShopifyMarketType, "NONE">;

const marketStore = useMarketStore();
const { storeId, token } = useActiveShopAuth();
const { requestConfirmation } = useConfirmDialog();
const feedback = useStoreFeedback();
const { t } = useLocalization();
const searchQuery = ref("");
const statusFilter = ref<StatusFilter>("ALL");
const typeFilter = ref<TypeFilter>("ALL");
const conditionFilter = ref<ConditionFilter>("ALL");
const countryCode = ref("");
const showCreateModal = ref(false);
const editingMarketId = ref<string | null>(null);
let filterTimer: ReturnType<typeof setTimeout> | null = null;
const statusOptions = computed(() => [
  { label: t("markets.allStatuses"), value: "ALL" },
  { label: t("markets.active"), value: "ACTIVE" },
  { label: t("markets.draft"), value: "DRAFT" },
]);
const typeOptions = computed(() => [
  { label: t("markets.allTypes"), value: "ALL" },
  { label: t("markets.typeRegion"), value: "REGION" },
  { label: t("markets.typeCompanyLocation"), value: "COMPANY_LOCATION" },
  { label: t("markets.typeLocation"), value: "LOCATION" },
  { label: t("markets.typeChannel"), value: "CHANNEL" },
  { label: t("markets.typeNone"), value: "NONE" },
]);
const conditionOptions = computed(() => [
  { label: t("markets.allConditionTypes"), value: "ALL" },
  { label: t("markets.typeRegion"), value: "REGION" },
  { label: t("markets.typeCompanyLocation"), value: "COMPANY_LOCATION" },
  { label: t("markets.typeLocation"), value: "LOCATION" },
  { label: t("markets.typeChannel"), value: "CHANNEL" },
]);

const hasServerFilters = computed(
  () =>
    Boolean(searchQuery.value.trim()) ||
    statusFilter.value !== "ALL" ||
    typeFilter.value !== "ALL" ||
    conditionFilter.value !== "ALL",
);

const filteredMarkets = computed(() => {
  if (hasServerFilters.value && marketStore.filteredResults) {
    return marketStore.filteredResults;
  }
  const query = searchQuery.value.trim().toLowerCase();
  return marketStore.markets.filter((market) => {
    if (statusFilter.value !== "ALL" && market.status !== statusFilter.value) {
      return false;
    }
    if (typeFilter.value !== "ALL" && market.type !== typeFilter.value) {
      return false;
    }
    if (
      conditionFilter.value !== "ALL" &&
      !market.conditionTypes.includes(conditionFilter.value)
    ) {
      return false;
    }
    if (!query) return true;

    return market.name.toLowerCase().includes(query);
  });
});

watch(
  [searchQuery, statusFilter, typeFilter, conditionFilter, storeId, token],
  () => {
    if (filterTimer) clearTimeout(filterTimer);
    if (!hasServerFilters.value || !storeId.value || !token.value) {
      marketStore.clearFiltered();
      return;
    }
    marketStore.clearFiltered();
    filterTimer = setTimeout(() => {
      void marketStore.fetchFiltered(storeId.value, token.value, {
        ...(searchQuery.value.trim() ? { search: searchQuery.value.trim() } : {}),
        ...(statusFilter.value !== "ALL" ? { status: statusFilter.value } : {}),
        ...(typeFilter.value !== "ALL" ? { type: typeFilter.value } : {}),
        ...(conditionFilter.value !== "ALL"
          ? { conditionTypes: [conditionFilter.value] }
          : {}),
      });
    }, 350);
  },
  { flush: "post" },
);

onBeforeUnmount(() => {
  if (filterTimer) clearTimeout(filterTimer);
  marketStore.clearFiltered();
});

const summary = computed(() => ({
  total: marketStore.markets.length,
  active: marketStore.markets.filter((market) => market.status === "ACTIVE").length,
  draft: marketStore.markets.filter((market) => market.status === "DRAFT").length,
  regions: new Set(
    marketStore.markets.flatMap((market) => market.regions.map((region) => region.id)),
  ).size,
  shipping: marketStore.markets.filter((market) => !market.shipping.inherits).length,
}));

const suggestedCountryCodes = computed(() =>
  Array.from(
    new Set(
      marketStore.markets.flatMap((market) =>
        market.regions
          .map((region) => region.countryCode)
          .filter((code): code is string => Boolean(code)),
      ),
    ),
  ).sort(),
);
const countryCodeOptions = computed(() =>
  Array.from(
    new Set([
      ...(countryCode.value ? [countryCode.value.trim().toUpperCase()] : []),
      ...suggestedCountryCodes.value,
    ]),
  )
    .filter((code) => /^[A-Z]{2}$/.test(code))
    .map((code) => ({ label: code, value: code })),
);

async function changeStatus(market: ShopifyMarketSummary) {
  const nextStatus: ShopifyMarketStatus =
    market.status === "ACTIVE" ? "DRAFT" : "ACTIVE";
  const isActivation = nextStatus === "ACTIVE";
  const confirmed = await requestConfirmation({
    title: t(isActivation ? "markets.activateTitle" : "markets.draftTitle"),
    message: t(isActivation ? "markets.activateConfirm" : "markets.draftConfirm", {
      name: market.name,
    }),
    confirmLabel: t(isActivation ? "markets.makeActive" : "markets.makeDraft"),
    danger: false,
  });
  if (!confirmed) return;

  const succeeded = await marketStore.setStatus(
    storeId.value,
    token.value,
    market.id,
    nextStatus,
  );
  if (succeeded) feedback.success(t("markets.statusUpdated"));
  else {
    feedback.error(marketStore.mutationError, t("markets.statusUpdateFailed"));
  }
}

async function resolveBuyerExperience() {
  const normalized = countryCode.value.trim().toUpperCase();
  countryCode.value = normalized;
  if (!/^[A-Z]{2}$/.test(normalized)) {
    feedback.warning(t("markets.invalidCountry"));
    return;
  }

  const result = await marketStore.resolveCountry(
    storeId.value,
    token.value,
    normalized,
  );
  if (!result) {
    feedback.error(marketStore.resolutionError, t("markets.resolutionFailed"));
  }
}

function formatMarketType(type: ShopifyMarketType) {
  if (type === "REGION") return t("markets.typeRegion");
  if (type === "COMPANY_LOCATION") return t("markets.typeCompanyLocation");
  if (type === "LOCATION") return t("markets.typeLocation");
  if (type === "CHANNEL") return t("markets.typeChannel");
  return t("markets.typeNone");
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function safeExternalUrl(value: string) {
  return getSafeExternalUrl(value);
}

function openEditor(marketId: string) {
  editingMarketId.value = marketId;
}

function handleMarketDetailsToggle(event: Event, marketId: string) {
  const details = event.currentTarget as HTMLDetailsElement;
  if (!details.open) return;
  void marketStore.fetchMarketDetail(storeId.value, token.value, marketId);
}

function handleCreated(marketId: string) {
  showCreateModal.value = false;
  editingMarketId.value = marketId;
}

async function removeMarket(market: ShopifyMarketSummary) {
  const confirmed = await requestConfirmation({
    title: t("markets.deleteTitle"),
    message: t("markets.deleteConfirm", { name: market.name }),
    confirmLabel: t("markets.deleteAction"),
    danger: true,
  });
  if (!confirmed) return;
  const succeeded = await marketStore.deleteMarket(
    storeId.value,
    token.value,
    market.id,
  );
  if (succeeded) {
    if (editingMarketId.value === market.id) editingMarketId.value = null;
    feedback.success(t("markets.deleteSuccess"));
  } else {
    feedback.error(marketStore.managerError, t("markets.deleteFailed"));
  }
}
</script>

<template>
  <section class="markets-page" :aria-label="t('markets.title')">
    <header class="markets-hero">
      <div class="markets-summary" aria-label="Market summary">
        <article>
          <Globe2 />
          <span>{{ t("markets.total") }}</span>
          <strong>{{ summary.total }}</strong>
        </article>
        <article>
          <ShieldCheck />
          <span>{{ t("markets.active") }}</span>
          <strong>{{ summary.active }}</strong>
        </article>
        <article>
          <MapPinned />
          <span>{{ t("markets.regions") }}</span>
          <strong>{{ summary.regions }}</strong>
        </article>
        <article>
          <Truck />
          <span>{{ t("markets.shippingConfigured") }}</span>
          <strong>{{ summary.shipping }}</strong>
        </article>
      </div>
      <form class="buyer-preview-form" @submit.prevent="resolveBuyerExperience">
        <BaseSelect
          class-name="buyer-country-select"
          :model-value="countryCode"
          :options="countryCodeOptions"
          :placeholder="t('markets.countryPlaceholder')"
          :aria-label="t('markets.countryPlaceholder')"
          @update:model-value="countryCode = String($event || '')"
        />
        <BaseButton
          type="submit"
          variant="primary"
          size="medium"
          :loading="marketStore.isResolving"
        >
          {{ marketStore.isResolving ? t("markets.resolving") : t("markets.resolve") }}
        </BaseButton>
      </form>
      <BaseButton
        class="markets-create-button"
        variant="primary"
        size="medium"
        @click="showCreateModal = true"
      >
        <template #icon><Plus /></template>
        {{ t("markets.editor.createMarket") }}
      </BaseButton>
    </header>

    <div v-if="marketStore.error" class="markets-alert is-error" role="alert">
      {{ marketStore.error }}
    </div>
    <div v-if="marketStore.listTruncated" class="markets-alert is-warning">
      {{ t("markets.listTruncated") }}
    </div>

    <section
      v-if="marketStore.resolutionError || marketStore.resolution"
      class="buyer-preview"
      :aria-label="t('markets.buyerPreviewTitle')"
    >
      <div v-if="marketStore.resolutionError" class="markets-alert is-error">
        {{ marketStore.resolutionError }}
      </div>
      <div v-if="marketStore.resolution" class="resolution-result">
        <h3>
          {{
            t("markets.resolvedFor", {
              country: marketStore.resolution.countryCode,
            })
          }}
        </h3>
        <div class="resolution-facts">
          <span>
            <CircleDollarSign />
            {{ marketStore.resolution.currencyCode }}
          </span>
          <span>
            {{
              marketStore.resolution.taxesIncluded
                ? t("markets.taxesIncluded")
                : t("markets.taxesAtCheckout")
            }}
          </span>
          <span>
            {{
              marketStore.resolution.dutiesIncluded
                ? t("markets.dutiesIncluded")
                : t("markets.dutiesAtCheckout")
            }}
          </span>
        </div>
        <div class="resolution-columns">
          <div>
            <strong>{{ t("markets.catalogs") }}</strong>
            <p v-if="!marketStore.resolution.catalogs.length">
              {{ t("markets.noCatalogs") }}
            </p>
            <ul v-else>
              <li v-for="catalog in marketStore.resolution.catalogs" :key="catalog.id">
                {{ catalog.title }}
                <small v-if="catalog.priceList">
                  {{ catalog.priceList.currency }} · {{ catalog.priceList.name }}
                </small>
              </li>
            </ul>
          </div>
          <div>
            <strong>{{ t("markets.resolvedUrls") }}</strong>
            <p v-if="!marketStore.resolution.webPresences.length">
              {{ t("markets.noWebPresence") }}
            </p>
            <ul v-else>
              <template
                v-for="presence in marketStore.resolution.webPresences"
                :key="presence.id"
              >
                <li v-for="root in presence.rootUrls" :key="root.locale">
                  <a
                    v-if="safeExternalUrl(root.url)"
                    :href="safeExternalUrl(root.url) || undefined"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ root.locale }} · {{ root.url }} <ArrowUpRight />
                  </a>
                </li>
              </template>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <div class="markets-toolbar">
      <label class="markets-search">
        <Search aria-hidden="true" />
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="t('markets.searchPlaceholder')"
          :aria-label="t('markets.searchPlaceholder')"
        />
      </label>
      <BaseSelect
        class-name="market-toolbar-select"
        :model-value="statusFilter"
        :options="statusOptions"
        :aria-label="t('markets.allStatuses')"
        @update:model-value="statusFilter = $event as StatusFilter"
      />
      <BaseSelect
        class-name="market-toolbar-select"
        :model-value="typeFilter"
        :options="typeOptions"
        :aria-label="t('markets.allTypes')"
        @update:model-value="typeFilter = $event as TypeFilter"
      />
      <BaseSelect
        class-name="market-toolbar-select"
        :model-value="conditionFilter"
        :options="conditionOptions"
        :aria-label="t('markets.allConditionTypes')"
        @update:model-value="conditionFilter = $event as ConditionFilter"
      />
      <span v-if="marketStore.isFiltering" class="markets-filter-progress">
        <ApiLoadingIcon variant="section" aria-hidden="true" />
        {{ t("markets.filtering") }}
      </span>
    </div>

    <div v-if="marketStore.filterError" class="markets-alert is-error" role="alert">
      {{ marketStore.filterError }}
    </div>
    <div v-if="marketStore.filteredTruncated" class="markets-alert is-warning">
      {{ t("markets.filterTruncated") }}
    </div>

    <div
      v-if="marketStore.isLoading && !marketStore.markets.length"
      class="markets-empty"
      aria-live="polite"
    >
      <ApiLoadingIcon variant="section" aria-hidden="true" />
      {{ t("common.loading") }}
    </div>
    <div
      v-else-if="marketStore.hasFetchedAll && !marketStore.markets.length"
      class="markets-empty"
    >
      <Globe2 />
      <strong>{{ t("markets.noDataTitle") }}</strong>
      <p>{{ t("markets.noDataDescription") }}</p>
      <BaseButton variant="primary" @click="showCreateModal = true">
        <template #icon><Plus /></template>{{ t("markets.editor.createMarket") }}
      </BaseButton>
    </div>
    <div v-else-if="!filteredMarkets.length" class="markets-empty">
      {{ t("markets.noFilterResults") }}
    </div>

    <div v-else class="market-list">
      <article v-for="market in filteredMarkets" :key="market.id" class="market-card">
        <header>
          <div>
            <div class="market-title-row">
              <h2>{{ market.name }}</h2>
              <code>({{ market.handle }})</code>
              <span class="market-status" :class="`is-${market.status.toLowerCase()}`">
                {{
                  market.status === "ACTIVE" ? t("markets.active") : t("markets.draft")
                }}
              </span>
              <span class="market-type">{{ formatMarketType(market.type) }}</span>
            </div>
          </div>
          <div class="market-card-actions">
            <BaseButton @click="openEditor(market.id)">
              <template #icon><Settings2 /></template>{{ t("markets.editor.manage") }}
            </BaseButton>
            <BaseButton
              :variant="market.status === 'ACTIVE' ? 'secondary' : 'primary'"
              :loading="marketStore.isMutating"
              @click="changeStatus(market)"
            >
              {{
                market.status === "ACTIVE"
                  ? t("markets.makeDraft")
                  : t("markets.makeActive")
              }}
            </BaseButton>
            <BaseButton
              variant="danger-ghost"
              icon-only
              :aria-label="t('markets.deleteAction')"
              :disabled="marketStore.isMutating"
              @click="removeMarket(market)"
            >
              <template #icon><Trash2 /></template>
            </BaseButton>
          </div>
        </header>

        <div class="market-facts">
          <div>
            <MapPinned />
            <span>{{ t("markets.regions") }}</span>
            <strong>{{ market.regions.length }}</strong>
          </div>
          <div>
            <CircleDollarSign />
            <span>{{ t("markets.baseCurrency") }}</span>
            <strong>{{ market.currencySettings?.baseCurrencyCode || "—" }}</strong>
          </div>
          <div>
            <Globe2 />
            <span>{{ t("markets.webPresence") }}</span>
            <strong>{{ market.webPresences.length }}</strong>
          </div>
          <div>
            <Truck />
            <span>{{ t("markets.shipping") }}</span>
            <strong>
              {{
                market.shipping.inherits
                  ? t("markets.shippingInherited")
                  : market.shipping.enabled
                    ? t("markets.shippingEnabled", {
                        count: market.shipping.optionCount?.count || 0,
                      })
                    : t("markets.shippingDisabled")
              }}
            </strong>
          </div>
        </div>

        <details @toggle="handleMarketDetailsToggle($event, market.id)">
          <summary>
            {{ t("markets.details") }}
            <ApiLoadingIcon
              v-if="marketStore.loadingMarketDetails.includes(market.id)"
              variant="section"
              aria-hidden="true"
            />
          </summary>
          <div
            v-if="marketStore.marketDetailErrors[market.id]"
            class="market-detail-message is-error"
            role="alert"
          >
            <span>{{ marketStore.marketDetailErrors[market.id] }}</span>
            <BaseButton
              @click="marketStore.fetchMarketDetail(storeId, token, market.id, true)"
            >
              {{ t("common.retry") }}
            </BaseButton>
          </div>
          <div
            v-else-if="market.detailsLoaded === false"
            class="market-detail-message"
            role="status"
          >
            <ApiLoadingIcon variant="section" aria-hidden="true" />
            {{ t("common.loading") }}
          </div>
          <div v-else class="market-detail-grid">
            <section>
              <h3>{{ t("markets.editor.conditionsTitle") }}</h3>
              <div class="market-chips">
                <span v-for="region in market.regions" :key="region.id">
                  {{ region.code || region.countryCode }} · {{ region.name }}
                </span>
                <span
                  v-if="market.conditions.companyLocations?.applicationLevel === 'ALL'"
                >
                  {{ t("markets.editor.companyLocationsCondition") }} ·
                  {{ t("markets.editor.conditionAll") }}
                </span>
                <span
                  v-for="item in market.conditions.companyLocations?.items || []"
                  :key="`company-${item.id}`"
                >
                  {{ t("markets.editor.companyLocationsCondition") }} · {{ item.name }}
                </span>
                <span v-if="market.conditions.locations?.applicationLevel === 'ALL'">
                  {{ t("markets.editor.locationsCondition") }} ·
                  {{ t("markets.editor.conditionAll") }}
                </span>
                <span
                  v-for="item in market.conditions.locations?.items || []"
                  :key="`location-${item.id}`"
                >
                  {{ t("markets.editor.locationsCondition") }} · {{ item.name }}
                </span>
                <span v-if="market.conditions.channels?.applicationLevel === 'ALL'">
                  {{ t("markets.editor.channelsCondition") }} ·
                  {{ t("markets.editor.conditionAll") }}
                </span>
                <span
                  v-for="item in market.conditions.channels?.items || []"
                  :key="`channel-${item.id}`"
                >
                  {{ t("markets.editor.channelsCondition") }} · {{ item.name }}
                </span>
                <span v-if="!market.conditionTypes.length">
                  {{ t("markets.editor.noBuyerConditions") }}
                </span>
              </div>
              <small
                v-if="
                  market.regionsTruncated ||
                  market.conditions.companyLocations?.truncated ||
                  market.conditions.locations?.truncated ||
                  market.conditions.channels?.truncated
                "
                class="market-warning"
              >
                {{ t("markets.editor.conditionsListTruncated") }}
              </small>
            </section>

            <section>
              <h3>
                {{ t("markets.catalogs") }}
                <span>{{ market.catalogCount?.count ?? market.catalogs.length }}</span>
              </h3>
              <p v-if="!market.catalogs.length">{{ t("markets.noCatalogs") }}</p>
              <ul v-else>
                <li v-for="catalog in market.catalogs" :key="catalog.id">
                  <strong>{{ catalog.title }}</strong>
                  <small>
                    {{ formatEnum(catalog.status) }}
                    <template v-if="catalog.priceList">
                      · {{ t("markets.priceList") }}: {{ catalog.priceList.name }} ({{
                        catalog.priceList.currency
                      }})
                    </template>
                  </small>
                </li>
              </ul>
              <small v-if="market.catalogsTruncated" class="market-warning">
                {{ t("markets.catalogsTruncated") }}
              </small>
            </section>

            <section>
              <h3>
                {{ t("markets.discounts") }}
                <span>{{
                  market.discountCount?.count ?? market.discounts.length
                }}</span>
              </h3>
              <p v-if="!market.discounts.length">
                {{ t("markets.editor.noAssignedDiscounts") }}
              </p>
              <ul v-else>
                <li v-for="discount in market.discounts" :key="discount.id">
                  <strong>{{ discount.title }}</strong>
                  <small>
                    {{ formatEnum(discount.status) }}
                    <template v-if="discount.code"> · {{ discount.code }}</template>
                  </small>
                </li>
              </ul>
              <small v-if="market.discountsTruncated" class="market-warning">
                {{ t("markets.discountsTruncated") }}
              </small>
            </section>

            <section>
              <h3>{{ t("markets.webPresence") }}</h3>
              <p v-if="!market.webPresences.length">
                {{ t("markets.noWebPresence") }}
              </p>
              <ul v-else>
                <template v-for="presence in market.webPresences" :key="presence.id">
                  <li v-for="root in presence.rootUrls" :key="root.locale">
                    <a
                      v-if="safeExternalUrl(root.url)"
                      :href="safeExternalUrl(root.url) || undefined"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {{ root.locale }} · {{ root.url }} <ArrowUpRight />
                    </a>
                  </li>
                </template>
              </ul>
              <small v-if="market.webPresencesTruncated" class="market-warning">
                {{ t("markets.webPresencesTruncated") }}
              </small>
            </section>
          </div>
        </details>
      </article>
    </div>

    <MarketCreateModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @created="handleCreated"
    />
    <MarketEditorModal
      v-if="editingMarketId"
      :market-id="editingMarketId"
      @close="editingMarketId = null"
    />
  </section>
</template>

<style scoped src="../../assets/styles/components/markets-tab.css"></style>
