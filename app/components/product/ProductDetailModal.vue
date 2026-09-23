<script setup lang="ts">
import { X } from "@lucide/vue";
import { computed, onMounted, onUnmounted, watch } from "vue";
import { useLocations } from "~/composables/useLocations";
import type {
  ShopifyLocation,
  ShopifyNumericId,
  ShopifyProduct,
  ShopifyProductStatus,
} from "~~/types/shopify";

const props = defineProps<{ product: ShopifyProduct }>();
const emit = defineEmits<{
  close: [];
}>();

const { t, locale } = useLocalization();
const {
  locations,
  inventoryLevels,
  isLoadingLocations,
  locationError,
  fetchProductInventory,
} = useLocations();

const productTags = computed(() =>
  (props.product.tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean),
);

const selectedInventoryItemIds = computed(() =>
  Array.from(
    new Set(
      (props.product.variants || [])
        .map((variant) => variant.inventory_item_id)
        .filter((id): id is ShopifyNumericId => id !== undefined),
    ),
  ),
);

const selectedInventoryItemIdSet = computed(
  () => new Set(selectedInventoryItemIds.value.map(String)),
);

const selectedInventoryLevels = computed(() =>
  inventoryLevels.value.filter((level) =>
    selectedInventoryItemIdSet.value.has(String(level.inventory_item_id)),
  ),
);

const inventoryByLocation = computed(() => {
  const summaries = new Map<
    string,
    { available: number; levelCount: number; hasUntracked: boolean }
  >();

  selectedInventoryLevels.value.forEach((level) => {
    const locationKey = String(level.location_id);
    const current = summaries.get(locationKey) || {
      available: 0,
      levelCount: 0,
      hasUntracked: false,
    };

    current.levelCount += 1;
    if (level.available === null) {
      current.hasUntracked = true;
    } else {
      current.available += level.available;
    }

    summaries.set(locationKey, current);
  });

  return summaries;
});

const visibleLocations = computed(() => {
  if (!selectedInventoryLevels.value.length) return locations.value;

  const locationIds = new Set(
    selectedInventoryLevels.value.map((level) => String(level.location_id)),
  );

  return locations.value.filter((location) => locationIds.has(String(location.id)));
});

const totalVariantInventory = computed(() =>
  (props.product.variants || []).reduce(
    (sum, variant) => sum + (variant.inventory_quantity || 0),
    0,
  ),
);

const trackedVariantCount = computed(
  () =>
    (props.product.variants || []).filter((variant) => !!variant.inventory_management)
      .length,
);

function isProductPublished(product: ShopifyProduct) {
  return product.status === "active" && Boolean(product.published_at);
}

function formatProductStatus(status?: ShopifyProductStatus) {
  if (status === "active") return t("product.statusActive");
  if (status === "draft") return t("product.statusDraft");
  if (status === "archived") return t("product.statusArchived");
  if (status === "unlisted") return t("product.statusUnlisted");
  return t("product.statusUnknown");
}

function formatLocationAddress(location: ShopifyLocation) {
  const parts = [
    location.address1,
    location.address2,
    location.city,
    location.province_code || location.province,
    location.zip,
    location.country_code || location.country,
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : t("product.noAddress");
}

function getLocationInventoryLabel(locationId: ShopifyNumericId) {
  if (selectedInventoryItemIds.value.length === 0) {
    return t("product.noInventoryItemId");
  }

  const summary = inventoryByLocation.value.get(String(locationId));
  if (!summary) {
    return t("product.noInventoryLevel");
  }

  if (summary.hasUntracked && summary.available === 0) {
    return t("product.notTracked");
  }

  if (summary.hasUntracked) {
    return t("product.availableWithUntracked", {
      count: summary.available,
    });
  }

  return t("product.availableCount", { count: summary.available });
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(locale.value);
}

async function loadLocations(force = false) {
  await fetchProductInventory(props.product, force);
}

function refreshProductLocations() {
  void loadLocations(true);
}

function close() {
  emit("close");
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") close();
}

watch(
  () => [props.product.id, selectedInventoryItemIds.value.join(",")],
  () => {
    void loadLocations();
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="modal-backdrop product-detail-backdrop" @click.self="close">
    <section
      class="modal-card product-detail-modal"
      role="dialog"
      aria-modal="true"
      :aria-label="t('product.detailTitle')"
    >
      <header class="modal-head">
        <div class="detail-product">
          <img
            v-if="product.image"
            :src="product.image.src"
            class="detail-thumb"
            :alt="product.image.alt || t('product.productImage')"
          />
          <div v-else class="detail-thumb empty-thumb">
            {{ t("product.noImage") }}
          </div>
          <div class="detail-product-main">
            <h3 class="modal-title">{{ product.title }}</h3>
            <div class="detail-sub">
              {{ t("product.productId", { id: product.id }) }}
            </div>
          </div>
        </div>
        <BaseButton
          variant="ghost"
          icon-only
          :aria-label="t('common.close')"
          @click="close"
        >
          <template #icon><X aria-hidden="true" /></template>
        </BaseButton>
      </header>

      <div class="modal-body detail-body">
        <div class="detail-meta-grid">
          <div class="detail-meta-item">
            <span>{{ t("product.columnStatus") }}</span>
            <strong>{{ formatProductStatus(product.status) }}</strong>
          </div>
          <div class="detail-meta-item">
            <span>{{ t("product.onlineStore") }}</span>
            <strong>
              {{
                isProductPublished(product)
                  ? t("product.published")
                  : t("product.unpublished")
              }}
            </strong>
          </div>
          <div class="detail-meta-item">
            <span>{{ t("product.columnVariants") }}</span>
            <strong>{{ product.variants?.length || 0 }}</strong>
          </div>
          <div class="detail-meta-item">
            <span>{{ t("product.totalInventory") }}</span>
            <strong>{{ totalVariantInventory }}</strong>
          </div>
          <div class="detail-meta-item">
            <span>{{ t("product.trackedVariants") }}</span>
            <strong>{{ trackedVariantCount }}</strong>
          </div>
          <div class="detail-meta-item">
            <span>{{ t("product.columnUpdated") }}</span>
            <strong>{{ formatDate(product.updated_at) }}</strong>
          </div>
          <div class="detail-meta-item">
            <span>{{ t("product.media") }}</span>
            <strong>{{ product.media_count || 0 }}</strong>
          </div>
          <div class="detail-meta-item">
            <span>{{ t("product.productKind") }}</span>
            <strong>{{
              product.is_gift_card
                ? t("product.giftCardProduct")
                : t("product.standardProduct")
            }}</strong>
          </div>
        </div>

        <div class="detail-section detail-info-grid">
          <div>
            <div class="detail-section-title">{{ t("product.productType") }}</div>
            <div class="detail-value">{{ product.product_type || "-" }}</div>
          </div>
          <div>
            <div class="detail-section-title">{{ t("product.shopifyCategory") }}</div>
            <div class="detail-value">
              {{ product.category?.full_name || product.category?.name || "-" }}
            </div>
          </div>
          <div>
            <div class="detail-section-title">{{ t("product.subscriptionOnly") }}</div>
            <div class="detail-value">
              {{
                product.requires_selling_plan
                  ? t("product.required")
                  : t("product.notRequired")
              }}
            </div>
          </div>
          <div>
            <div class="detail-section-title">{{ t("product.tags") }}</div>
            <div v-if="productTags.length" class="tags-cell">
              <span v-for="tag in productTags" :key="tag" class="tag-item">
                {{ tag }}
              </span>
            </div>
            <div v-else class="detail-value">{{ t("product.noTags") }}</div>
          </div>
          <div class="detail-description">
            <div class="detail-section-title">{{ t("product.description") }}</div>
            <ProductDescriptionPreview
              v-if="product.body_html"
              :content="product.body_html"
            />
            <div v-else class="detail-value">{{ t("product.noDescription") }}</div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-head">
            <div>
              <div class="detail-section-title">
                {{ t("product.inventoryLocations") }}
              </div>
              <div class="detail-section-sub">
                {{ t("product.locationCount", { count: visibleLocations.length }) }}
              </div>
            </div>
            <button
              class="btn-ghost-sm btn-icon"
              type="button"
              :disabled="isLoadingLocations"
              :title="t('product.refreshLocations')"
              @click="refreshProductLocations"
            >
              <IconsRefresh />
            </button>
          </div>

          <div v-if="isLoadingLocations" class="detail-loading">
            {{ t("product.loadingLocations") }}
          </div>
          <div v-else-if="locationError" class="detail-error">
            {{ locationError }}
          </div>
          <div v-else-if="!visibleLocations.length" class="detail-empty">
            {{ t("product.noLocations") }}
          </div>
          <div v-else class="location-list">
            <div
              v-for="location in visibleLocations"
              :key="location.id"
              class="location-row"
            >
              <div class="location-main">
                <div class="location-name">
                  {{
                    location.name || t("product.locationFallback", { id: location.id })
                  }}
                </div>
                <div class="location-address">
                  {{ formatLocationAddress(location) }}
                </div>
              </div>
              <div class="location-side">
                <span class="inventory-count">
                  {{ getLocationInventoryLabel(location.id) }}
                </span>
                <span
                  class="location-status"
                  :class="{
                    active: location.active,
                    inactive: location.active === false,
                  }"
                >
                  {{
                    location.active === false
                      ? t("product.inactive")
                      : t("product.statusActive")
                  }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <ProductVariantMediaOverview :product="product" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--dialog-backdrop);
  backdrop-filter: blur(2px);
}

.modal-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--dialog-radius);
  background: var(--surface);
  box-shadow: var(--dialog-shadow);
}

.product-detail-backdrop {
  padding: 24px;
}

.product-detail-modal {
  width: min(1120px, 100%);
  max-height: min(900px, calc(100vh - 48px));
  overflow: hidden;
}

.modal-head {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.modal-title {
  margin: 0;
  color: var(--text);
  font-size: 16px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.modal-body {
  overflow-y: auto;
}

.detail-body {
  padding: 16px 20px 20px;
}

.detail-product {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.detail-thumb {
  width: 54px;
  height: 54px;
  border: 1px solid var(--border);
  border-radius: 6px;
  object-fit: cover;
  flex: 0 0 auto;
}

.empty-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-soft);
  color: var(--text-muted);
  font-size: 10px;
  text-align: center;
}

.detail-product-main {
  min-width: 0;
}

.detail-sub {
  margin-top: 3px;
  color: var(--text-sub);
  font-size: 11px;
}

.detail-meta-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}

.detail-meta-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 10px;
  border-radius: 6px;
  background: var(--surface-soft);
}

.detail-meta-item span {
  color: var(--text-sub);
  font-size: 11px;
}

.detail-meta-item strong {
  color: var(--text);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.detail-section {
  padding-top: 14px;
}

.detail-info-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.detail-description {
  grid-column: 1 / -1;
}

.detail-value {
  color: var(--text-sub);
  font-size: 12px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.detail-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.detail-section-title {
  margin-bottom: 8px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.detail-section-sub {
  margin-top: -4px;
  color: var(--text-sub);
  font-size: 12px;
}

.tags-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-item {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--surface-soft);
  color: var(--text-sub);
  font-size: 11px;
}

.location-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.location-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
}

.location-name {
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.location-address {
  margin-top: 3px;
  color: var(--text-sub);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.inventory-count {
  color: var(--green);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.location-main {
  min-width: 0;
}

.location-side {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.location-status {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 8px;
  background: var(--surface-soft);
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
}

.location-status.active {
  background: var(--badge-paid);
  color: var(--badge-paid-text);
}

.location-status.inactive {
  background: var(--badge-cancelled);
  color: var(--badge-cancelled-text);
}

.detail-loading,
.detail-error,
.detail-empty {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-soft);
  color: var(--text-sub);
  font-size: 13px;
}

.detail-error {
  background: var(--badge-cancelled);
  color: var(--badge-cancelled-text);
}

.btn-ghost-sm {
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-link);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  padding: 4px 8px;
}

.btn-ghost-sm:hover {
  background: var(--blue-soft);
}

.btn-ghost-sm:disabled {
  cursor: wait;
  opacity: 0.6;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

@media (max-width: 720px) {
  .product-detail-backdrop {
    padding: 12px;
  }

  .product-detail-modal {
    max-height: calc(100vh - 24px);
  }

  .detail-meta-grid,
  .detail-info-grid {
    grid-template-columns: 1fr;
  }

  .location-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .location-side {
    align-items: flex-start;
  }
}
</style>
