<script setup lang="ts">
import {
  BadgePlus,
  Boxes,
  FileText,
  MapPinned,
  Plus,
  Trash2,
  Truck,
  X,
} from "@lucide/vue";
import { computed, onMounted, reactive, ref, useId } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useMarketStore } from "~/stores/market";
import MarketConditionResourcePicker from "./market/MarketConditionResourcePicker.vue";
import MarketShippingOptionBuilder from "./market/MarketShippingOptionBuilder.vue";
import type {
  ShopifyMarketConditionApplicationLevel,
  ShopifyMarketConditionsInput,
  ShopifyMarketRegionInput,
  ShopifyMarketShippingOptionInput,
} from "~~/types/shopify-market";

type CreateSection = "details" | "conditions" | "experience" | "shipping";
type ConditionMode = "NONE" | ShopifyMarketConditionApplicationLevel;

const emit = defineEmits<{ close: []; created: [id: string] }>();
const marketStore = useMarketStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const { handleTabKeydown } = useTabKeyboardNavigation("vertical");
const feedback = useStoreFeedback();
const modalRef = ref<HTMLFormElement | null>(null);
const titleId = `market-create-title-${useId()}`;
const localError = ref("");
const activeSection = ref<CreateSection>("details");
const companyMode = ref<ConditionMode>("NONE");
const companyIds = ref<string[]>([]);
const locationMode = ref<ConditionMode>("NONE");
const locationIds = ref<string[]>([]);
const channelMode = ref<ConditionMode>("NONE");
const channelIds = ref<string[]>([]);
const showShippingBuilder = ref(false);
const shippingOptions = ref<ShopifyMarketShippingOptionInput[]>([]);
const form = reactive({
  name: "",
  handle: "",
  status: "DRAFT" as "ACTIVE" | "DRAFT",
  baseCurrency: "",
  manualRate: "",
  localCurrencies: false,
  roundingEnabled: false,
  configurePriceInclusions: false,
  adaptivePricingEnabled: false,
  taxPricingStrategy: "INCLUDES_TAXES_IN_PRICE_BASED_ON_COUNTRY",
  dutiesPricingStrategy: "ADD_DUTIES_AT_CHECKOUT",
  makeDuplicateUniqueMarketsDraft: true,
  regions: [{ countryCode: "", subdivision: "" }] as ShopifyMarketRegionInput[],
  catalogIds: [] as string[],
  discountIds: [] as string[],
  webPresenceIds: [] as string[],
  shippingMode: "INHERIT" as "INHERIT" | "DISABLED" | "ENABLED",
});
const context = computed(() => marketStore.editorContext);
const sections = computed(() => [
  {
    id: "details" as const,
    label: t("markets.editor.createNavDetails"),
    icon: FileText,
  },
  {
    id: "conditions" as const,
    label: t("markets.editor.createNavConditions"),
    icon: MapPinned,
  },
  {
    id: "experience" as const,
    label: t("markets.editor.createNavExperience"),
    icon: Boxes,
  },
  {
    id: "shipping" as const,
    label: t("markets.editor.createNavShipping"),
    icon: Truck,
  },
]);
const statusOptions = computed(() => [
  { label: t("markets.draft"), value: "DRAFT" },
  { label: t("markets.active"), value: "ACTIVE" },
]);
const taxStrategyOptions = computed(() => [
  {
    label: t("markets.editor.taxCheckout"),
    value: "ADD_TAXES_AT_CHECKOUT",
  },
  {
    label: t("markets.editor.taxIncluded"),
    value: "INCLUDES_TAXES_IN_PRICE",
  },
  {
    label: t("markets.editor.taxCountry"),
    value: "INCLUDES_TAXES_IN_PRICE_BASED_ON_COUNTRY",
  },
]);
const dutyStrategyOptions = computed(() => [
  {
    label: t("markets.editor.dutyCheckout"),
    value: "ADD_DUTIES_AT_CHECKOUT",
  },
  {
    label: t("markets.editor.dutyIncluded"),
    value: "INCLUDE_DUTIES_IN_PRICE",
  },
]);
const { handleKeydown } = useFocusTrap(modalRef, {
  initialFocus: () => modalRef.value?.querySelector("input") || null,
  onEscape: () => !marketStore.isManaging && emit("close"),
});

const conditionsValid = computed(
  () =>
    form.regions.every((region) => /^[A-Za-z]{2}$/.test(region.countryCode.trim())) &&
    (companyMode.value !== "SPECIFIED" || companyIds.value.length > 0) &&
    (locationMode.value !== "SPECIFIED" || locationIds.value.length > 0) &&
    (channelMode.value !== "SPECIFIED" || channelIds.value.length > 0),
);
const pricingValid = computed(
  () =>
    (!form.baseCurrency.trim() || /^[A-Za-z]{3}$/.test(form.baseCurrency.trim())) &&
    !(form.localCurrencies && form.manualRate.trim()),
);
const canSubmit = computed(
  () => Boolean(form.name.trim()) && conditionsValid.value && pricingValid.value,
);

onMounted(() => marketStore.fetchEditorContext(storeId.value, token.value));

function addRegion() {
  form.regions.push({ countryCode: "", subdivision: "" });
}

function removeRegion(index: number) {
  form.regions.splice(index, 1);
}

function generateHandle() {
  if (form.handle.trim()) return;
  form.handle = form.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 255);
}

function toggle(list: string[], id: string) {
  const index = list.indexOf(id);
  if (index >= 0) list.splice(index, 1);
  else list.push(id);
}

function updateStatus(value: unknown) {
  if (value === "ACTIVE" || value === "DRAFT") form.status = value;
}

function updateTaxStrategy(value: unknown) {
  if (typeof value === "string") form.taxPricingStrategy = value;
}

function updateDutyStrategy(value: unknown) {
  if (typeof value === "string") form.dutiesPricingStrategy = value;
}

function queueShippingOption(option: ShopifyMarketShippingOptionInput) {
  shippingOptions.value.push(option);
  showShippingBuilder.value = false;
}

function buildConditions(): ShopifyMarketConditionsInput {
  const conditions: ShopifyMarketConditionsInput = {};
  if (form.regions.length) {
    conditions.regions = form.regions.map((region) => ({
      countryCode: region.countryCode.trim().toUpperCase(),
      subdivision: region.subdivision?.trim().toUpperCase() || undefined,
    }));
  }
  if (companyMode.value !== "NONE") {
    conditions.companyLocations = {
      applicationLevel: companyMode.value,
      ids: companyMode.value === "SPECIFIED" ? companyIds.value : [],
    };
  }
  if (locationMode.value !== "NONE") {
    conditions.locations = {
      applicationLevel: locationMode.value,
      ids: locationMode.value === "SPECIFIED" ? locationIds.value : [],
    };
  }
  if (channelMode.value !== "NONE") {
    conditions.channels = { ids: channelIds.value };
  }
  return conditions;
}

async function submit() {
  localError.value = "";
  if (!canSubmit.value) {
    localError.value = t("markets.editor.createValidationExpanded");
    return;
  }
  const market = await marketStore.createMarket(storeId.value, token.value, {
    name: form.name.trim(),
    handle: form.handle.trim(),
    status: form.status,
    makeDuplicateUniqueMarketsDraft: form.makeDuplicateUniqueMarketsDraft,
    conditions: buildConditions(),
    catalogIds: form.catalogIds,
    discountIds: form.discountIds,
    webPresenceIds: form.webPresenceIds,
    currency: form.baseCurrency.trim()
      ? {
          baseCurrency: form.baseCurrency.trim().toUpperCase(),
          manualRate: form.manualRate.trim() || null,
          localCurrencies: form.localCurrencies,
          roundingEnabled: form.roundingEnabled,
        }
      : null,
    priceInclusions: form.configurePriceInclusions
      ? {
          adaptivePricingEnabled: form.adaptivePricingEnabled,
          taxPricingStrategy: form.taxPricingStrategy,
          dutiesPricingStrategy: form.dutiesPricingStrategy,
        }
      : null,
    delivery: {
      mode: form.shippingMode,
      options: form.shippingMode === "ENABLED" ? shippingOptions.value : [],
    },
  });
  if (!market) {
    localError.value = marketStore.managerError || t("markets.editor.createFailed");
    return;
  }
  feedback.success(t("markets.editor.createdConfigured"));
  emit("created", market.id);
}
</script>

<template>
  <Teleport to="body">
    <div
      class="market-modal-backdrop"
      @click.self="!marketStore.isManaging && emit('close')"
    >
      <form
        ref="modalRef"
        class="market-modal market-create-modal market-create-workspace"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @keydown="handleKeydown"
        @submit.prevent="submit"
      >
        <header class="market-modal-header">
          <div>
            <p>{{ t("markets.editor.workspace") }}</p>
            <h2 :id="titleId">{{ t("markets.editor.createTitleExpanded") }}</h2>
          </div>
          <BaseButton
            variant="ghost"
            icon-only
            :aria-label="t('common.close')"
            :disabled="marketStore.isManaging"
            @click="emit('close')"
          >
            <template #icon><X /></template>
          </BaseButton>
        </header>

        <div class="market-create-layout">
          <nav
            class="market-editor-nav"
            role="tablist"
            :aria-label="t('markets.editor.createSections')"
            @keydown="handleTabKeydown"
          >
            <button
              v-for="section in sections"
              :key="section.id"
              type="button"
              role="tab"
              :aria-selected="activeSection === section.id"
              :class="{ 'is-active': activeSection === section.id }"
              @click="activeSection = section.id"
            >
              <component :is="section.icon" aria-hidden="true" />
              <span>{{ section.label }}</span>
            </button>
          </nav>

          <div class="market-modal-scroll">
            <div
              v-if="marketStore.managerError && !context"
              class="market-callout is-danger"
            >
              <strong>{{ t("markets.editor.contextFailedTitle") }}</strong>
              <span>{{ marketStore.managerError }}</span>
              <BaseButton @click="marketStore.fetchEditorContext(storeId, token, true)">
                {{ t("common.retry") }}
              </BaseButton>
            </div>
            <div v-else-if="!context" class="market-editor-loading">
              <ApiLoadingIcon variant="section" aria-hidden="true" />
              {{ t("markets.editor.loadingWorkspace") }}
            </div>
            <template v-if="context">
              <div
                v-if="context.warnings.length"
                class="market-context-warnings"
                aria-live="polite"
              >
                <div
                  v-for="warning in context.warnings"
                  :key="warning"
                  class="market-callout is-warning"
                >
                  <span>{{ t(`markets.editor.warning.${warning}` as never) }}</span>
                </div>
              </div>

              <template v-if="activeSection === 'details'">
                <div class="market-callout is-info">
                  <strong>{{ t("markets.editor.safeCreateTitle") }}</strong>
                  <span>{{ t("markets.editor.safeCreateDescription") }}</span>
                </div>
                <div class="market-form-grid">
                  <label class="market-field">
                    <span>{{ t("markets.editor.name") }}</span>
                    <input
                      v-model="form.name"
                      required
                      maxlength="255"
                      :placeholder="t('markets.editor.namePlaceholder')"
                      @blur="generateHandle"
                    />
                  </label>
                  <label class="market-field">
                    <span>{{ t("markets.editor.handle") }}</span>
                    <input
                      v-model="form.handle"
                      maxlength="255"
                      pattern="[A-Za-z0-9-]+"
                      :placeholder="t('markets.editor.handlePlaceholder')"
                    />
                  </label>
                  <label class="market-field">
                    <span>{{ t("markets.editor.initialStatus") }}</span>
                    <BaseSelect
                      :model-value="form.status"
                      :options="statusOptions"
                      @update:model-value="updateStatus"
                    />
                  </label>
                </div>
                <BaseCheckbox
                  v-model="form.makeDuplicateUniqueMarketsDraft"
                  :label="t('markets.editor.duplicateDraftLabel')"
                  :description="t('markets.editor.duplicateDraftDescription')"
                />
              </template>

              <template v-else-if="activeSection === 'conditions'">
                <div class="market-section-heading">
                  <div>
                    <h3>{{ t("markets.editor.conditionsTitle") }}</h3>
                    <p>{{ t("markets.editor.createConditionsDescription") }}</p>
                  </div>
                </div>
                <fieldset class="market-fieldset">
                  <div class="market-legend-row">
                    <div>
                      <legend>{{ t("markets.editor.buyerRegions") }}</legend>
                      <p>{{ t("markets.editor.regionFormatHintOptional") }}</p>
                    </div>
                    <BaseButton @click="addRegion">
                      <template #icon><Plus /></template
                      >{{ t("markets.editor.addRegion") }}
                    </BaseButton>
                  </div>
                  <div v-if="!form.regions.length" class="market-empty-small">
                    {{ t("markets.editor.noRegionCondition") }}
                  </div>
                  <div v-else class="market-region-list">
                    <div
                      v-for="(region, index) in form.regions"
                      :key="index"
                      class="market-region-row"
                    >
                      <label class="market-field">
                        <span>{{ t("markets.editor.countryCode") }}</span>
                        <input
                          v-model="region.countryCode"
                          required
                          maxlength="2"
                          placeholder="US"
                        />
                      </label>
                      <label class="market-field">
                        <span>{{ t("markets.editor.subdivisionOptional") }}</span>
                        <input
                          v-model="region.subdivision"
                          maxlength="32"
                          placeholder="CA"
                        />
                      </label>
                      <BaseButton
                        variant="danger-ghost"
                        icon-only
                        :aria-label="t('markets.editor.removeRegion')"
                        @click="removeRegion(index)"
                      >
                        <template #icon><Trash2 /></template>
                      </BaseButton>
                    </div>
                  </div>
                </fieldset>
                <MarketConditionResourcePicker
                  :title="t('markets.editor.companyLocationsCondition')"
                  :description="t('markets.editor.companyLocationsConditionHint')"
                  :options="context.conditionOptions.companyLocations"
                  :mode="companyMode"
                  :selected="companyIds"
                  allow-all
                  @update:mode="companyMode = $event"
                  @update:selected="companyIds = $event"
                />
                <MarketConditionResourcePicker
                  :title="t('markets.editor.locationsCondition')"
                  :description="t('markets.editor.locationsConditionHint')"
                  :options="context.conditionOptions.locations"
                  :mode="locationMode"
                  :selected="locationIds"
                  allow-all
                  @update:mode="locationMode = $event"
                  @update:selected="locationIds = $event"
                />
                <MarketConditionResourcePicker
                  :title="t('markets.editor.channelsCondition')"
                  :description="t('markets.editor.channelsConditionHint')"
                  :options="context.conditionOptions.channels"
                  :mode="channelMode"
                  :selected="channelIds"
                  @update:mode="channelMode = $event"
                  @update:selected="channelIds = $event"
                />
              </template>

              <template v-else-if="activeSection === 'experience'">
                <div class="market-section-heading">
                  <div>
                    <h3>{{ t("markets.editor.createExperienceTitle") }}</h3>
                    <p>{{ t("markets.editor.createExperienceDescription") }}</p>
                  </div>
                </div>
                <fieldset class="market-fieldset">
                  <legend>{{ t("markets.editor.currencySettings") }}</legend>
                  <div class="market-form-grid">
                    <label class="market-field">
                      <span>{{ t("markets.editor.baseCurrencyOptional") }}</span>
                      <input
                        v-model="form.baseCurrency"
                        maxlength="3"
                        placeholder="USD"
                      />
                    </label>
                    <label class="market-field">
                      <span>{{ t("markets.editor.manualRate") }}</span>
                      <input
                        v-model="form.manualRate"
                        type="number"
                        min="0"
                        step="any"
                        :disabled="!form.baseCurrency || form.localCurrencies"
                      />
                    </label>
                  </div>
                  <div class="market-choice-grid">
                    <BaseCheckbox
                      v-model="form.localCurrencies"
                      :label="t('markets.editor.localCurrenciesLabel')"
                      :disabled="!form.baseCurrency.trim()"
                    />
                    <BaseCheckbox
                      v-model="form.roundingEnabled"
                      :label="t('markets.editor.roundingLabel')"
                      :disabled="!form.baseCurrency.trim()"
                    />
                  </div>
                </fieldset>
                <fieldset class="market-fieldset">
                  <legend>{{ t("markets.editor.priceInclusions") }}</legend>
                  <BaseCheckbox
                    v-model="form.configurePriceInclusions"
                    :label="t('markets.editor.configureAtCreation')"
                    :description="t('markets.editor.configureAtCreationHint')"
                  />
                  <div v-if="form.configurePriceInclusions" class="market-form-grid">
                    <label class="market-field">
                      <span>{{ t("markets.taxStrategy") }}</span>
                      <BaseSelect
                        :model-value="form.taxPricingStrategy"
                        :options="taxStrategyOptions"
                        @update:model-value="updateTaxStrategy"
                      />
                    </label>
                    <label class="market-field">
                      <span>{{ t("markets.dutyStrategy") }}</span>
                      <BaseSelect
                        :model-value="form.dutiesPricingStrategy"
                        :options="dutyStrategyOptions"
                        @update:model-value="updateDutyStrategy"
                      />
                    </label>
                    <BaseCheckbox
                      v-model="form.adaptivePricingEnabled"
                      :label="t('markets.editor.adaptivePricing')"
                      :description="t('markets.editor.adaptivePricingDescription')"
                    />
                  </div>
                </fieldset>
                <fieldset class="market-fieldset">
                  <legend>{{ t("markets.editor.createAssignments") }}</legend>
                  <div class="market-assignment-columns">
                    <section>
                      <strong>{{ t("markets.catalogs") }}</strong>
                      <div v-if="!context.catalogs.length" class="market-empty-small">
                        {{ t("markets.editor.noAvailableCatalogs") }}
                      </div>
                      <div class="market-selection-list is-single-column">
                        <BaseCheckbox
                          v-for="catalog in context.catalogs"
                          :key="catalog.id"
                          :model-value="form.catalogIds.includes(catalog.id)"
                          :label="catalog.title"
                          :description="catalog.priceList?.name || catalog.status"
                          @change="toggle(form.catalogIds, catalog.id)"
                        />
                      </div>
                    </section>
                    <section>
                      <strong>{{ t("markets.discounts") }}</strong>
                      <div v-if="!context.discounts.length" class="market-empty-small">
                        {{ t("markets.editor.noAvailableDiscounts") }}
                      </div>
                      <div class="market-selection-list is-single-column">
                        <BaseCheckbox
                          v-for="discount in context.discounts"
                          :key="discount.id"
                          :model-value="form.discountIds.includes(discount.id)"
                          :label="discount.title"
                          :description="discount.code || discount.status"
                          @change="toggle(form.discountIds, discount.id)"
                        />
                      </div>
                    </section>
                    <section>
                      <strong>{{ t("markets.webPresence") }}</strong>
                      <div
                        v-if="!context.webPresences.length"
                        class="market-empty-small"
                      >
                        {{ t("markets.editor.noAvailableWebPresences") }}
                      </div>
                      <div class="market-selection-list is-single-column">
                        <BaseCheckbox
                          v-for="presence in context.webPresences"
                          :key="presence.id"
                          :model-value="form.webPresenceIds.includes(presence.id)"
                          :label="
                            presence.domain?.host || `/${presence.subfolderSuffix}`
                          "
                          :description="presence.defaultLocale"
                          @change="toggle(form.webPresenceIds, presence.id)"
                        />
                      </div>
                    </section>
                  </div>
                </fieldset>
              </template>

              <template v-else>
                <div class="market-section-heading">
                  <div>
                    <h3>{{ t("markets.editor.shippingTitle") }}</h3>
                    <p>{{ t("markets.editor.createShippingDescription") }}</p>
                  </div>
                </div>
                <div class="market-mode-grid">
                  <button
                    type="button"
                    :class="{ 'is-selected': form.shippingMode === 'INHERIT' }"
                    @click="form.shippingMode = 'INHERIT'"
                  >
                    <strong>{{ t("markets.editor.shippingInherit") }}</strong>
                    <span>{{ t("markets.editor.shippingInheritDescription") }}</span>
                  </button>
                  <button
                    type="button"
                    :class="{ 'is-selected': form.shippingMode === 'ENABLED' }"
                    @click="form.shippingMode = 'ENABLED'"
                  >
                    <strong>{{ t("markets.editor.shippingCustom") }}</strong>
                    <span>{{ t("markets.editor.shippingCustomDescription") }}</span>
                  </button>
                  <button
                    type="button"
                    class="is-danger"
                    :class="{ 'is-selected': form.shippingMode === 'DISABLED' }"
                    @click="form.shippingMode = 'DISABLED'"
                  >
                    <strong>{{ t("markets.editor.shippingOff") }}</strong>
                    <span>{{ t("markets.editor.shippingOffDescription") }}</span>
                  </button>
                </div>
                <template v-if="form.shippingMode === 'ENABLED'">
                  <div class="market-legend-row">
                    <strong>{{ t("markets.editor.queuedShippingOptions") }}</strong>
                    <BaseButton @click="showShippingBuilder = true">
                      <template #icon><Plus /></template
                      >{{ t("markets.editor.addShippingOption") }}
                    </BaseButton>
                  </div>
                  <div v-if="!shippingOptions.length" class="market-empty-small">
                    {{ t("markets.editor.noQueuedShippingOptions") }}
                  </div>
                  <div v-else class="market-queued-list">
                    <div v-for="(option, index) in shippingOptions" :key="index">
                      <span
                        >{{ option.name || option.type }} · {{ option.currency }}</span
                      >
                      <BaseButton
                        variant="danger-ghost"
                        icon-only
                        :aria-label="t('common.remove')"
                        @click="shippingOptions.splice(index, 1)"
                      >
                        <template #icon><Trash2 /></template>
                      </BaseButton>
                    </div>
                  </div>
                  <MarketShippingOptionBuilder
                    v-if="showShippingBuilder"
                    :context="context"
                    :default-currency="form.baseCurrency || 'USD'"
                    @cancel="showShippingBuilder = false"
                    @add="queueShippingOption"
                  />
                </template>
              </template>
            </template>

            <p v-if="localError" class="market-form-error" role="alert">
              {{ localError }}
            </p>
          </div>
        </div>

        <footer class="market-modal-footer">
          <span class="market-create-readiness">
            {{
              canSubmit
                ? t("markets.editor.readyToCreate")
                : t("markets.editor.completeRequiredFields")
            }}
          </span>
          <BaseButton
            size="medium"
            :disabled="marketStore.isManaging"
            @click="emit('close')"
          >
            {{ t("common.cancel") }}
          </BaseButton>
          <BaseButton
            type="submit"
            variant="primary"
            size="medium"
            :loading="marketStore.isManaging"
            :disabled="!canSubmit || !context"
          >
            <template #icon><BadgePlus /></template>{{ t("markets.editor.create") }}
          </BaseButton>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style src="../../assets/styles/components/market-editor.css"></style>
