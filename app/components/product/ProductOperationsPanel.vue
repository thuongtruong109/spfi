<script setup lang="ts">
import {
  Boxes,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "@lucide/vue";
import { computed, ref, watch } from "vue";
import LocalizedPriceInput from "./LocalizedPriceInput.vue";
import { useLocations } from "~/composables/useLocations";
import { useProductOperations } from "~/composables/useProductOperations";
import { useToastStore } from "~/stores/toast";
import type {
  ShopifyNumericId,
  ShopifyMetafield,
  ShopifyProduct,
  ShopifyProductImage,
  ShopifyInventoryQuantityStateName,
  ShopifyVariant,
} from "~~/types/shopify";
import type {
  ShopifyProductImageInput,
  ShopifyMetafieldInput,
  ShopifyVariantInput,
} from "~~/types/shopify-product";
import {
  isProductPriceChanged,
  isValidCompareAtPrice,
  normalizeProductPriceInput,
} from "~~/utils/product-options";

type ProductEditorSection = "all" | "variants" | "metafields" | "inventory";

const props = withDefaults(
  defineProps<{ product: ShopifyProduct; section?: ProductEditorSection }>(),
  { section: "all" },
);
const emit = defineEmits<{ refreshed: [] }>();
const toast = useToastStore();
const operations = useProductOperations();
const { t } = useLocalization();
const { requestConfirmation } = useConfirmDialog();
const {
  locations,
  inventoryLevels,
  isLoadingLocations,
  locationError,
  fetchLocations,
  fetchProductInventory,
} = useLocations();

const editingVariantId = ref<ShopifyNumericId | null>(null);
const variantForm = ref<ShopifyVariantInput>(emptyVariantForm());
const selectedVariantIds = ref<Set<string>>(new Set());
const variantPriceDrafts = ref<Record<string, string>>({});
const variantCompareAtDrafts = ref<Record<string, string>>({});
const presentmentCurrencyInput = ref("");
const imageUrl = ref("");
const imageAlt = ref("");
const imageUpload = ref<{ attachment: string; filename: string } | null>(null);
const imageDrafts = ref<
  Record<
    ShopifyNumericId,
    { position: number; alt: string; variantIds: ShopifyNumericId[] }
  >
>({});
const inventoryVariantId = ref<ShopifyNumericId | null>(null);
const inventoryLocationId = ref<ShopifyNumericId | null>(null);
const inventoryMode = ref<"set" | "adjust" | "reserve" | "release">("set");
const inventoryQuantityName = ref<"available" | "on_hand">("available");
const inventoryReason = ref("correction");
const inventoryTargetMode = ref<"single" | "selected">("single");
const inventoryAmount = ref(0);
const metafieldForm = ref<ShopifyMetafieldInput>(emptyMetafieldForm());
const metafieldDrafts = ref<Record<string, { value: string; type: string }>>({});
const optionNameDrafts = ref<Record<string, string>>({});

const productOptionNames = computed(() => {
  const names = (props.product.options || [])
    .slice(0, 3)
    .map((option) => option.name.trim())
    .filter(Boolean);
  return names.length ? names : [t("product.defaultOptionName")];
});
const selectedVariantCount = computed(() => selectedVariantIds.value.size);
const dirtyPriceVariantIds = computed(
  () =>
    new Set(
      operations.variants.value
        .filter(isVariantPriceDirty)
        .map((variant) => String(variant.id)),
    ),
);
const dirtyPriceCount = computed(() => dirtyPriceVariantIds.value.size);
const showVariants = computed(
  () => props.section === "all" || props.section === "variants",
);
const showMetafields = computed(
  () => props.section === "all" || props.section === "metafields",
);
const showInventory = computed(
  () => props.section === "all" || props.section === "inventory",
);

const inventoryVariants = computed(() =>
  operations.variants.value.filter((variant) =>
    /^\d+$/.test(String(variant.inventory_item_id ?? "")),
  ),
);
const selectedInventoryVariant = computed(() =>
  inventoryVariants.value.find(
    (variant) => String(variant.id) === String(inventoryVariantId.value),
  ),
);
const selectedInventoryVariants = computed(() =>
  inventoryVariants.value.filter((variant) =>
    selectedVariantIds.value.has(String(variant.id)),
  ),
);
const inventoryTargets = computed(() =>
  inventoryTargetMode.value === "selected"
    ? selectedInventoryVariants.value
    : selectedInventoryVariant.value
      ? [selectedInventoryVariant.value]
      : [],
);
const selectedInventoryLevel = computed(() => {
  const itemId = selectedInventoryVariant.value?.inventory_item_id;
  if (!itemId || !inventoryLocationId.value) return null;
  return inventoryLevels.value.find(
    (level) =>
      String(level.inventory_item_id) === String(itemId) &&
      String(level.location_id) === String(inventoryLocationId.value),
  );
});
const variantImageOptions = computed(() => [
  { label: t("product.noImage"), value: null },
  ...operations.images.value.map((image) => ({
    label: t("product.imageNumber", { id: image.position || image.id || "" }),
    value: image.id || null,
  })),
]);
const inventoryPolicyOptions = computed(() => [
  { label: t("product.stopSellingAtZero"), value: "deny" },
  { label: t("product.continueSelling"), value: "continue" },
]);
const inventoryVariantOptions = computed(() =>
  inventoryVariants.value.map((variant) => ({
    label: variant.title || variant.sku || String(variant.id),
    value: variant.id,
    description: variant.sku || undefined,
  })),
);
const inventoryLocationOptions = computed(() =>
  locations.value.map((location) => {
    const connected = inventoryTargets.value.every((variant) =>
      hasActiveInventoryLevel(variant, location.id),
    );
    const unavailable = location.active === false || !connected;
    return {
      label: location.name || String(location.id),
      value: location.id,
      description: [
        [location.city, location.country_code].filter(Boolean).join(", "),
        unavailable ? t("product.inventoryLocationUnavailable") : "",
      ]
        .filter(Boolean)
        .join(" · "),
      disabled: unavailable,
    };
  }),
);
const inventoryModeOptions = computed(() => [
  { label: t("product.setQuantity"), value: "set" },
  { label: t("product.adjustQuantity"), value: "adjust" },
  { label: t("product.reserveQuantity"), value: "reserve" },
  { label: t("product.releaseQuantity"), value: "release" },
]);
const inventoryQuantityOptions = computed(() => [
  { label: t("product.available"), value: "available" },
  { label: t("product.onHand"), value: "on_hand" },
]);
const activeInventoryQuantityName = computed<ShopifyInventoryQuantityStateName>(() =>
  inventoryMode.value === "reserve"
    ? "available"
    : inventoryMode.value === "release"
      ? "reserved"
      : inventoryQuantityName.value,
);
const inventoryTargetsConnected = computed(
  () =>
    Boolean(inventoryLocationId.value) &&
    inventoryTargets.value.length > 0 &&
    inventoryTargets.value.every((variant) =>
      hasActiveInventoryLevel(variant, inventoryLocationId.value!),
    ),
);
const inventoryConnectionMessage = computed(() => {
  if (!inventoryTargets.value.length || isLoadingLocations.value) return "";
  if (locationError.value) {
    return t("product.inventoryLoadFailed", { error: locationError.value });
  }

  const visibleTargets = inventoryTargets.value.slice(0, 3);
  const targetNames = visibleTargets
    .map((variant) => variant.title || variant.sku || String(variant.id))
    .join(", ");
  const hiddenTargetCount = inventoryTargets.value.length - visibleTargets.length;
  const variants = hiddenTargetCount
    ? t("product.inventoryTargetNamesOverflow", {
        variants: targetNames,
        count: hiddenTargetCount,
      })
    : targetNames;
  const location = locations.value.find(
    (candidate) => String(candidate.id) === String(inventoryLocationId.value),
  );

  return location
    ? t("product.inventoryLevelRequiredAtLocation", {
        variants,
        location: location.name || String(location.id),
      })
    : t("product.inventoryLevelRequired", { variants });
});
const inventoryAmountIsValid = computed(() => {
  const amount = Number(inventoryAmount.value);
  return (
    Number.isSafeInteger(amount) &&
    (!isReservationMode() || amount > 0) &&
    /^[a-z][a-z0-9_]{0,63}$/.test(inventoryReason.value)
  );
});
const canUpdateInventory = computed(
  () => inventoryTargetsConnected.value && inventoryAmountIsValid.value,
);
const inventoryTargetOptions = computed(() => [
  { label: t("product.oneVariant"), value: "single" },
  {
    label: t("product.selectedVariants", {
      count: selectedInventoryVariants.value.length,
    }),
    value: "selected",
    disabled: selectedInventoryVariants.value.length === 0,
  },
]);

function formatVariantInventory(variant: ShopifyVariant) {
  if (typeof variant.inventory_quantity === "number") {
    return t("product.availableCount", {
      count: variant.inventory_quantity,
    });
  }

  return variant.inventory_management ? t("product.tracked") : t("product.notTracked");
}

function formatVariantFulfillment(variant: ShopifyVariant) {
  const source = (props.product.variants || []).find(
    (candidate) => String(candidate.id) === String(variant.id),
  );
  const service =
    source?.fulfillment_service || variant.fulfillment_service || "manual";
  return t("product.variantInventoryMeta", {
    management: variant.inventory_management ? "Shopify" : t("product.notTracked"),
    service,
  });
}

function isVariantPriceDirty(variant: ShopifyVariant) {
  const id = String(variant.id);
  return (
    isProductPriceChanged(variantPriceDrafts.value[id], variant.price) ||
    isProductPriceChanged(variantCompareAtDrafts.value[id], variant.compare_at_price)
  );
}

function isReservationMode() {
  return inventoryMode.value === "reserve" || inventoryMode.value === "release";
}

function findInventoryLevel(variant: ShopifyVariant, locationId: ShopifyNumericId) {
  return inventoryLevels.value.find(
    (level) =>
      String(level.inventory_item_id) === String(variant.inventory_item_id) &&
      String(level.location_id) === String(locationId),
  );
}

function hasActiveInventoryLevel(
  variant: ShopifyVariant,
  locationId: ShopifyNumericId,
) {
  if (!/^\d+$/.test(String(variant.inventory_item_id ?? ""))) return false;
  const level = findInventoryLevel(variant, locationId);
  const requiredNames: ShopifyInventoryQuantityStateName[] = isReservationMode()
    ? ["available", "reserved"]
    : [inventoryQuantityName.value];
  return requiredNames.every(
    (name) => typeof getInventoryQuantity(level, name) === "number",
  );
}

function selectFirstAvailableInventoryLocation() {
  const current = inventoryLocationOptions.value.find(
    (option) =>
      String(option.value) === String(inventoryLocationId.value) && !option.disabled,
  );
  if (current) return;
  inventoryLocationId.value =
    inventoryLocationOptions.value.find((option) => !option.disabled)?.value || null;
}

watch(
  () => props.product.id,
  () => {
    resetVariantForm();
    selectedVariantIds.value = new Set();
    variantPriceDrafts.value = {};
    variantCompareAtDrafts.value = {};
    imageUrl.value = "";
    imageAlt.value = "";
    imageUpload.value = null;
    imageDrafts.value = {};
    inventoryVariantId.value = null;
    inventoryLocationId.value = null;
    inventoryTargetMode.value = "single";
    inventoryQuantityName.value = "available";
    inventoryReason.value = "correction";
    inventoryAmount.value = 0;
    metafieldForm.value = emptyMetafieldForm();
    metafieldDrafts.value = {};
    void refreshAll();
  },
  { immediate: true },
);

watch(
  () => props.product.options,
  (options) => {
    optionNameDrafts.value = Object.fromEntries(
      (options || []).map((option, index) => [String(option.id || index), option.name]),
    );
  },
  { deep: true, immediate: true },
);

watch(
  [inventoryTargets, activeInventoryQuantityName, inventoryLocationOptions],
  selectFirstAvailableInventoryLocation,
  { immediate: true },
);

function emptyVariantForm(): ShopifyVariantInput {
  return {
    option1: "",
    price: "0.00",
    sku: "",
    barcode: "",
    taxable: true,
    requires_shipping: true,
    inventory_management: "shopify",
    inventory_policy: "deny",
  };
}

function emptyMetafieldForm(): ShopifyMetafieldInput {
  return {
    namespace: "custom",
    key: "",
    value: "",
    type: "single_line_text_field",
  };
}

async function refreshAll() {
  const productId = props.product.id;
  const currencies = Array.from(
    new Set(
      presentmentCurrencyInput.value
        .split(",")
        .map((currency) => currency.trim().toUpperCase())
        .filter((currency) => /^[A-Z]{3}$/.test(currency)),
    ),
  );
  await Promise.all([operations.load(productId, currencies), fetchLocations()]);
  if (props.product.id !== productId) return;

  await fetchProductInventory(
    { ...props.product, variants: operations.variants.value },
    true,
  );
  if (props.product.id !== productId) return;

  initializeDrafts();
}

function initializeDrafts() {
  variantPriceDrafts.value = Object.fromEntries(
    operations.variants.value.map((variant) => [
      String(variant.id),
      variant.price || "0.00",
    ]),
  );
  variantCompareAtDrafts.value = Object.fromEntries(
    operations.variants.value.map((variant) => [
      String(variant.id),
      variant.compare_at_price || "",
    ]),
  );
  selectedVariantIds.value = new Set(
    [...selectedVariantIds.value].filter((id) =>
      operations.variants.value.some((variant) => String(variant.id) === id),
    ),
  );
  imageDrafts.value = Object.fromEntries(
    operations.images.value
      .filter((image): image is ShopifyProductImage & { id: ShopifyNumericId } =>
        Boolean(image.id),
      )
      .map((image) => [
        image.id,
        {
          position: image.position || 1,
          alt: image.alt || "",
          variantIds: [...(image.variant_ids || [])],
        },
      ]),
  );
  metafieldDrafts.value = Object.fromEntries(
    operations.metafields.value.map((metafield) => [
      String(metafield.id),
      { value: metafield.value, type: metafield.type },
    ]),
  );
  if (
    !inventoryVariantId.value ||
    !inventoryVariants.value.some(
      (variant) => String(variant.id) === String(inventoryVariantId.value),
    )
  ) {
    inventoryVariantId.value = inventoryVariants.value[0]?.id || null;
  }
  selectFirstAvailableInventoryLocation();
}

function editVariant(variant: ShopifyVariant) {
  editingVariantId.value = variant.id;
  variantForm.value = {
    option1: variant.option1 || variant.title || "",
    option2: variant.option2 || null,
    option3: variant.option3 || null,
    price: variant.price || "0.00",
    compare_at_price: variant.compare_at_price || null,
    sku: variant.sku || "",
    barcode: variant.barcode || "",
    taxable: variant.taxable !== false,
    requires_shipping: variant.requires_shipping !== false,
    inventory_management: variant.inventory_management === "shopify" ? "shopify" : null,
    inventory_policy: variant.inventory_policy === "continue" ? "continue" : "deny",
    image_id: variant.image_id || null,
  };
}

function resetVariantForm() {
  editingVariantId.value = null;
  variantForm.value = emptyVariantForm();
}

async function saveVariant() {
  const price = normalizeProductPriceInput(variantForm.value.price);
  const rawCompareAtPrice = String(variantForm.value.compare_at_price || "").trim();
  const compareAtPrice = rawCompareAtPrice
    ? normalizeProductPriceInput(rawCompareAtPrice)
    : null;
  const optionValues = [
    variantForm.value.option1,
    variantForm.value.option2,
    variantForm.value.option3,
  ].slice(0, productOptionNames.value.length);
  if (
    optionValues.some((value) => !String(value || "").trim()) ||
    price === null ||
    (rawCompareAtPrice &&
      (compareAtPrice === null || !isValidCompareAtPrice(price, compareAtPrice)))
  ) {
    toast.error(t("product.variantRequired"));
    return;
  }
  const input = {
    ...variantForm.value,
    option1: String(optionValues[0] || "").trim(),
    option2: optionValues[1] ? String(optionValues[1]).trim() : null,
    option3: optionValues[2] ? String(optionValues[2]).trim() : null,
    price,
    compare_at_price: compareAtPrice,
  };
  const response = editingVariantId.value
    ? await operations.updateVariantsBulk(
        props.product.id,
        [{ ...input, id: editingVariantId.value }],
        productOptionNames.value,
      )
    : await operations.createVariantsBulk(
        props.product.id,
        [input],
        productOptionNames.value,
      );
  if (!response) return;

  toast.success(
    editingVariantId.value ? t("product.variantUpdated") : t("product.variantCreated"),
  );
  resetVariantForm();
  await afterMutation();
}

function getVariantOption(index: number) {
  const key = `option${index + 1}` as "option1" | "option2" | "option3";
  return String(variantForm.value[key] || "");
}

function setVariantOption(index: number, event: Event) {
  const key = `option${index + 1}` as "option1" | "option2" | "option3";
  variantForm.value[key] = (event.target as HTMLInputElement).value;
}

function toggleVariantSelection(variant: ShopifyVariant) {
  const next = new Set(selectedVariantIds.value);
  const id = String(variant.id);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedVariantIds.value = next;
}

function toggleAllVariants() {
  selectedVariantIds.value =
    selectedVariantIds.value.size === operations.variants.value.length
      ? new Set()
      : new Set(operations.variants.value.map((variant) => String(variant.id)));
}

function buildPriceUpdates(variants: ShopifyVariant[]) {
  return variants.map((variant) => {
    const rawPrice = String(variantPriceDrafts.value[String(variant.id)] || "").trim();
    const rawCompareAtPrice = String(
      variantCompareAtDrafts.value[String(variant.id)] || "",
    ).trim();
    return {
      id: variant.id,
      price: normalizeProductPriceInput(rawPrice) ?? rawPrice,
      compare_at_price: rawCompareAtPrice
        ? (normalizeProductPriceInput(rawCompareAtPrice) ?? rawCompareAtPrice)
        : null,
    };
  });
}

async function savePriceVariants(targets: ShopifyVariant[]) {
  const variants = buildPriceUpdates(targets);
  if (
    !variants.length ||
    variants.some(
      (variant) =>
        normalizeProductPriceInput(variant.price) === null ||
        (variant.compare_at_price !== null &&
          !isValidCompareAtPrice(variant.price, variant.compare_at_price)),
    )
  ) {
    toast.error(t("product.validPricesRequired"));
    return;
  }

  let updatedCount = 0;
  for (let offset = 0; offset < variants.length; offset += 250) {
    const batch = variants.slice(offset, offset + 250);
    if (
      !(await operations.updateVariantsBulk(
        props.product.id,
        batch,
        productOptionNames.value,
      ))
    ) {
      if (updatedCount) {
        toast.warning(
          t("product.priceUpdatePartial", {
            updated: updatedCount,
            total: variants.length,
          }),
        );
      }
      return;
    }
    updatedCount += batch.length;
  }
  toast.success(t("product.bulkPricesUpdated", { count: updatedCount }));
  await afterMutation();
}

async function saveChangedPrices() {
  await savePriceVariants(
    operations.variants.value.filter((variant) =>
      dirtyPriceVariantIds.value.has(String(variant.id)),
    ),
  );
}

async function saveVariantPrice(variant: ShopifyVariant) {
  if (!isVariantPriceDirty(variant)) return;
  await savePriceVariants([variant]);
}

async function saveOptionNames() {
  const options = (props.product.options || []).map((option, index) => ({
    ...option,
    name: String(optionNameDrafts.value[String(option.id || index)] || "").trim(),
    position: index + 1,
  }));
  const uniqueNames = new Set(options.map((option) => option.name.toLowerCase()));
  if (
    !options.length ||
    options.some((option) => !option.id || !option.name) ||
    uniqueNames.size !== options.length
  ) {
    toast.error(t("product.optionNamesInvalid"));
    return;
  }
  if (!(await operations.updateOptions(props.product.id, options))) return;
  toast.success(t("product.optionNamesUpdated"));
  await afterMutation();
}

async function removeSelectedVariants() {
  const variants = operations.variants.value.filter((variant) =>
    selectedVariantIds.value.has(String(variant.id)),
  );
  if (!variants.length) return;
  if (variants.length >= operations.variants.value.length) {
    toast.error(t("product.keepOneVariant"));
    return;
  }
  if (
    !(await requestConfirmation({
      title: t("confirm.deleteTitle"),
      message: t("product.deleteVariantsConfirm", { count: variants.length }),
      confirmLabel: t("common.delete"),
    })) ||
    !(await operations.deleteVariantsBulk(
      props.product.id,
      variants.map((variant) => variant.id),
    ))
  ) {
    return;
  }
  toast.success(t("product.variantsDeleted", { count: variants.length }));
  selectedVariantIds.value = new Set();
  await afterMutation();
}

async function removeVariant(variant: ShopifyVariant) {
  if (
    !(await requestConfirmation({
      title: t("confirm.deleteTitle"),
      message: t("product.deleteVariantConfirm", {
        title: variant.title || variant.id,
      }),
      confirmLabel: t("common.delete"),
    })) ||
    !(await operations.deleteVariantsBulk(props.product.id, [variant.id]))
  ) {
    return;
  }
  toast.success(t("product.variantDeleted"));
  await afterMutation();
}

async function addImage() {
  const src = imageUrl.value.trim();
  if (!imageUpload.value && !/^https?:\/\//i.test(src)) {
    toast.error(t("product.validImageUrl"));
    return;
  }
  const image: ShopifyProductImageInput = {
    ...(imageUpload.value || { src }),
    ...(imageAlt.value.trim() ? { alt: imageAlt.value.trim() } : {}),
  };
  if (!(await operations.createImage(props.product.id, image))) return;

  imageUrl.value = "";
  imageAlt.value = "";
  imageUpload.value = null;
  toast.success(t("product.productImageAdded"));
  await afterMutation();
}

async function selectImageFile(file: File | null) {
  if (!file) {
    imageUpload.value = null;
    return;
  }
  if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
    imageUpload.value = null;
    toast.error(t("product.imageFileInvalid"));
    return;
  }
  try {
    const dataUrl = await readFileAsDataUrl(file);
    imageUpload.value = {
      attachment: dataUrl.slice(dataUrl.indexOf(",") + 1),
      filename: file.name,
    };
  } catch {
    imageUpload.value = null;
    toast.error(t("product.imageFileInvalid"));
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });
}

async function createMetafield() {
  const metafield = {
    ...metafieldForm.value,
    namespace: metafieldForm.value.namespace.trim(),
    key: metafieldForm.value.key.trim(),
    type: metafieldForm.value.type.trim(),
  };
  if (!metafield.namespace || !metafield.key || !metafield.type) {
    toast.error(t("product.metafieldRequired"));
    return;
  }
  if (!(await operations.createMetafield(props.product.id, metafield))) return;
  metafieldForm.value = emptyMetafieldForm();
  toast.success(t("product.metafieldCreated"));
  await afterMutation();
}

async function saveMetafield(metafield: ShopifyMetafield) {
  const draft = metafieldDrafts.value[String(metafield.id)];
  if (!draft?.type.trim()) {
    toast.error(t("product.metafieldRequired"));
    return;
  }
  if (
    !(await operations.updateMetafield(props.product.id, {
      id: metafield.id,
      namespace: metafield.namespace,
      key: metafield.key,
      value: draft.value,
      type: draft.type.trim(),
    }))
  ) {
    return;
  }
  toast.success(t("product.metafieldSaved"));
  await afterMutation();
}

async function removeMetafield(metafield: ShopifyMetafield) {
  if (
    !(await requestConfirmation({
      title: t("confirm.deleteTitle"),
      message: t("product.deleteMetafieldConfirm", {
        key: `${metafield.namespace}.${metafield.key}`,
      }),
      confirmLabel: t("common.delete"),
    })) ||
    !(await operations.deleteMetafield(props.product.id, metafield.id))
  ) {
    return;
  }
  toast.success(t("product.metafieldDeleted"));
  await afterMutation();
}

async function saveImage(image: ShopifyProductImage) {
  if (!image.id) return;
  const draft = imageDrafts.value[image.id];
  if (!draft || !Number.isSafeInteger(Number(draft.position)) || draft.position < 1) {
    toast.error(t("product.imagePositionRequired"));
    return;
  }
  if (
    !(await operations.updateImage(props.product.id, image.id, {
      position: Number(draft.position),
      alt: draft.alt.trim() || null,
      variant_ids: draft.variantIds,
    }))
  ) {
    return;
  }
  toast.success(t("product.imageSaved"));
  await afterMutation();
}

async function removeImage(image: ShopifyProductImage) {
  if (
    !image.id ||
    !(await requestConfirmation({
      title: t("confirm.deleteTitle"),
      message: t("product.deleteImageConfirm"),
      confirmLabel: t("common.delete"),
    })) ||
    !(await operations.deleteImage(props.product.id, image.id))
  ) {
    return;
  }
  toast.success(t("product.imageDeleted"));
  await afterMutation();
}

function toggleImageVariant(imageId: ShopifyNumericId, variantId: ShopifyNumericId) {
  const draft = imageDrafts.value[imageId];
  if (!draft) return;
  const index = draft.variantIds.findIndex(
    (candidate) => String(candidate) === String(variantId),
  );
  if (index === -1) draft.variantIds.push(variantId);
  else draft.variantIds.splice(index, 1);
}

async function updateInventory() {
  const locationId = inventoryLocationId.value;
  const amount = Number(inventoryAmount.value);
  const targets = inventoryTargets.value;
  if (!targets.length || !locationId || !Number.isSafeInteger(amount)) {
    toast.error(t("product.selectVariantLocationWhole"));
    return;
  }
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(inventoryReason.value)) {
    toast.error(t("product.inventoryReasonInvalid"));
    return;
  }
  const isReservationMove = isReservationMode();
  if (isReservationMove && amount <= 0) {
    toast.error(t("product.reservationPositiveQuantity"));
    return;
  }
  const items = targets.map((variant) => ({
    variant,
    level: findInventoryLevel(variant, locationId),
  }));
  if (
    items.some(
      ({ variant, level }) =>
        !variant.inventory_item_id ||
        typeof getInventoryQuantity(level, activeInventoryQuantityName.value) !==
          "number" ||
        (isReservationMove &&
          typeof getInventoryQuantity(level, "reserved") !== "number"),
    )
  ) {
    toast.error(
      inventoryConnectionMessage.value || t("product.inventoryTargetsNotConnected"),
    );
    return;
  }
  if (isReservationMove) {
    const response = await operations.moveInventoryReservations(
      locationId,
      items.map(({ variant, level }) => ({
        inventory_item_id: variant.inventory_item_id!,
        current_available: getInventoryQuantity(level!, "available")!,
        current_reserved: getInventoryQuantity(level!, "reserved")!,
      })),
      inventoryMode.value === "reserve" ? "RESERVE" : "RELEASE",
      amount,
      inventoryReason.value,
    );
    if (!response) return;
    toast.success(
      t("product.inventoryReservationsUpdated", {
        count: response.updatedCount,
      }),
    );
    inventoryAmount.value = 0;
    emit("refreshed");
    await refreshAll();
    return;
  }
  const response = await operations.updateInventoryBulk(
    locationId,
    items.map(({ variant, level }) => ({
      inventory_item_id: variant.inventory_item_id!,
      change_from_quantity: getInventoryQuantity(level!, inventoryQuantityName.value)!,
    })),
    inventoryMode.value === "set" ? "SET" : "ADJUST",
    amount,
    {
      quantityName: inventoryQuantityName.value,
      reason: inventoryReason.value,
    },
  );
  if (!response) return;
  toast.success(t("product.inventoryBulkUpdated", { count: response.updatedCount }));
  inventoryAmount.value = 0;
  emit("refreshed");
  await refreshAll();
}

function getInventoryQuantity(
  level: (typeof inventoryLevels.value)[number] | null | undefined,
  name: ShopifyInventoryQuantityStateName,
) {
  if (!level) return undefined;
  if (name === "available" && typeof level.available === "number") {
    return level.available;
  }
  return level.quantities?.[name];
}

async function afterMutation() {
  emit("refreshed");
  await refreshAll();
}
</script>

<template>
  <section class="operations-panel">
    <header>
      <div>
        <strong>{{ t("product.operationsTitle") }}</strong>
        <span>{{ t("product.operationsDescription") }}</span>
      </div>
      <BaseButton
        icon-only
        :title="t('product.refreshOperations')"
        :loading="operations.isLoading.value"
        @click="refreshAll"
      >
        <template #icon><RefreshCw /></template>
      </BaseButton>
    </header>

    <div v-if="operations.error.value" class="operation-error" role="alert">
      {{ operations.error.value }}
    </div>

    <div v-if="showVariants" class="operation-section">
      <div class="section-title">
        <div>
          <Boxes /><strong>{{ t("product.variants") }}</strong>
        </div>
        <span>{{
          t("product.totalCount", { count: operations.variants.value.length })
        }}</span>
      </div>

      <div v-if="operations.variants.value.length" class="variant-bulk-toolbar">
        <BaseCheckbox
          :model-value="selectedVariantCount === operations.variants.value.length"
          :label="t('product.selectAllVariants')"
          @change="toggleAllVariants"
        />
        <span>{{ t("product.bulkSelected", { count: selectedVariantCount }) }}</span>
        <div class="row-actions">
          <BaseButton
            variant="primary"
            :disabled="!dirtyPriceCount"
            :loading="operations.isLoading.value"
            @click="saveChangedPrices"
          >
            <template #icon><Save /></template>
            {{ t("product.savePriceChanges", { count: dirtyPriceCount }) }}
          </BaseButton>
          <BaseButton
            variant="danger-ghost"
            :disabled="!selectedVariantCount"
            :loading="operations.isLoading.value"
            @click="removeSelectedVariants"
          >
            <template #icon><Trash2 /></template>
            {{ t("product.deleteSelectedVariants") }}
          </BaseButton>
        </div>
      </div>

      <div class="compact-list">
        <article
          v-for="variant in operations.variants.value"
          :key="variant.id"
          :class="{ 'has-price-change': isVariantPriceDirty(variant) }"
        >
          <BaseCheckbox
            class="variant-select"
            compact
            :model-value="selectedVariantIds.has(String(variant.id))"
            :aria-label="
              t('product.selectVariant', { title: variant.title || variant.id })
            "
            @change="toggleVariantSelection(variant)"
          />
          <div>
            <strong>{{ variant.title || t("product.defaultVariant") }}</strong>
            <span class="variant-summary"
              >{{ variant.sku || t("product.noSku") }} -
              {{ formatVariantInventory(variant) }}</span
            >
            <span class="variant-summary">{{ formatVariantFulfillment(variant) }}</span>
            <span
              v-for="presentment in variant.presentment_prices || []"
              :key="presentment.price.currency_code"
              class="presentment-price"
            >
              {{ presentment.price.amount }} {{ presentment.price.currency_code }}
            </span>
          </div>
          <div class="variant-price-fields" @click.stop>
            <label class="inline-price">
              <span>{{ t("product.price") }}</span>
              <LocalizedPriceInput
                v-model="variantPriceDrafts[String(variant.id)]"
                :aria-label="t('product.price')"
                placeholder="0.00 / 0,00"
                :title="t('product.priceInputHint')"
                @keydown.enter.prevent="saveVariantPrice(variant)"
              />
            </label>
            <label class="inline-price">
              <span>{{ t("product.compareAtPrice") }}</span>
              <LocalizedPriceInput
                v-model="variantCompareAtDrafts[String(variant.id)]"
                :aria-label="t('product.compareAtPrice')"
                placeholder="0.00 / 0,00"
                :title="t('product.priceInputHint')"
                @keydown.enter.prevent="saveVariantPrice(variant)"
              />
            </label>
            <BaseButton
              class="price-save-action"
              variant="primary"
              :disabled="!isVariantPriceDirty(variant)"
              :loading="operations.isLoading.value && isVariantPriceDirty(variant)"
              @click="saveVariantPrice(variant)"
            >
              <template #icon><Save /></template>
              {{ t("product.savePrice") }}
            </BaseButton>
          </div>
          <div class="row-actions">
            <BaseButton
              icon-only
              variant="ghost"
              :title="t('product.editVariant')"
              @click="editVariant(variant)"
            >
              <template #icon><Pencil /></template>
            </BaseButton>
            <BaseButton
              icon-only
              variant="danger-ghost"
              :title="t('product.deleteVariant')"
              @click="removeVariant(variant)"
            >
              <template #icon><Trash2 /></template>
            </BaseButton>
          </div>
        </article>
      </div>
    </div>

    <div v-if="showVariants" class="operation-section">
      <div class="section-title">
        <div>
          <ImagePlus /><strong>{{ t("product.images") }}</strong>
        </div>
        <span>{{ t("product.imagesDescription") }}</span>
      </div>
      <div class="image-create">
        <input
          v-model="imageUrl"
          type="url"
          :placeholder="t('product.imageUrlPlaceholder')"
        />
        <input v-model="imageAlt" :placeholder="t('product.altText')" />
        <BaseFileInput
          :label="t('product.uploadImage')"
          accept="image/*"
          :file-name="imageUpload?.filename || ''"
          @select="selectImageFile"
        />
        <BaseButton
          variant="primary"
          :loading="operations.isLoading.value"
          @click="addImage"
        >
          <template #icon><ImagePlus /></template>
          {{ t("product.addImage") }}
        </BaseButton>
      </div>
      <div class="image-grid">
        <article
          v-for="image in operations.images.value"
          :key="image.id"
          class="image-card"
        >
          <img :src="image.src" :alt="image.alt || t('product.productImage')" />
          <div v-if="image.id && imageDrafts[image.id]" class="image-fields">
            <label
              ><span>{{ t("product.position") }}</span
              ><input
                v-model.number="imageDrafts[image.id]!.position"
                type="number"
                min="1"
                step="1"
            /></label>
            <label
              ><span>{{ t("product.altText") }}</span
              ><input v-model="imageDrafts[image.id]!.alt"
            /></label>
            <div class="image-assignment-row">
              <fieldset>
                <legend>{{ t("product.assignedVariants") }}</legend>
                <BaseCheckbox
                  v-for="variant in operations.variants.value"
                  :key="variant.id"
                  :model-value="imageDrafts[image.id]!.variantIds.includes(variant.id)"
                  :label="String(variant.title || variant.sku || variant.id)"
                  @change="toggleImageVariant(image.id!, variant.id)"
                />
              </fieldset>
              <div class="form-actions">
                <BaseButton variant="danger-ghost" @click="removeImage(image)">
                  <template #icon><Trash2 /></template>
                  {{ t("common.delete") }}
                </BaseButton>
                <BaseButton variant="primary" @click="saveImage(image)">
                  <template #icon><Save /></template>
                  {{ t("common.save") }}
                </BaseButton>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>

    <div v-if="showMetafields" class="operation-section">
      <div class="section-title">
        <div>
          <Boxes /><strong>{{ t("product.metafields") }}</strong>
        </div>
        <span>{{
          t("product.totalCount", { count: operations.metafields.value.length })
        }}</span>
      </div>
      <div class="metafield-create form-grid">
        <label>
          <span>{{ t("product.metafieldNamespace") }}</span>
          <input v-model="metafieldForm.namespace" placeholder="custom" />
        </label>
        <label>
          <span>{{ t("product.metafieldKey") }}</span>
          <input v-model="metafieldForm.key" placeholder="material" />
        </label>
        <label>
          <span>{{ t("product.metafieldType") }}</span>
          <input v-model="metafieldForm.type" placeholder="single_line_text_field" />
        </label>
        <label>
          <span>{{ t("product.metafieldValue") }}</span>
          <input v-model="metafieldForm.value" />
        </label>
        <div class="form-actions">
          <BaseButton
            variant="primary"
            :loading="operations.isLoading.value"
            @click="createMetafield"
          >
            <template #icon><Plus /></template>
            {{ t("product.addMetafield") }}
          </BaseButton>
        </div>
      </div>
      <div class="compact-list metafield-list">
        <article v-for="metafield in operations.metafields.value" :key="metafield.id">
          <div>
            <strong>{{ metafield.namespace }}.{{ metafield.key }}</strong>
            <span>{{ metafield.type }}</span>
          </div>
          <input
            v-if="metafieldDrafts[String(metafield.id)]"
            v-model="metafieldDrafts[String(metafield.id)]!.value"
            :aria-label="t('product.metafieldValue')"
          />
          <div class="row-actions">
            <BaseButton icon-only variant="ghost" @click="saveMetafield(metafield)">
              <template #icon><Save /></template>
            </BaseButton>
            <BaseButton
              icon-only
              variant="danger-ghost"
              @click="removeMetafield(metafield)"
            >
              <template #icon><Trash2 /></template>
            </BaseButton>
          </div>
        </article>
      </div>
    </div>

    <div v-if="showVariants && product.options?.length" class="operation-section">
      <div class="section-title">
        <div>
          <Boxes /><strong>{{ t("product.optionDefinitions") }}</strong>
        </div>
        <span>{{ t("product.optionValuesManagedByVariants") }}</span>
      </div>
      <div class="option-name-list">
        <label
          v-for="(option, index) in product.options"
          :key="String(option.id || index)"
          class="option-name-row"
        >
          <input
            v-model="optionNameDrafts[String(option.id || index)]"
            :aria-label="t('product.optionName')"
          />
          <span>{{ option.values.join(", ") }}</span>
        </label>
        <BaseButton
          variant="primary"
          :loading="operations.isLoading.value"
          @click="saveOptionNames"
        >
          <template #icon><Save /></template>
          {{ t("product.saveOptionNames") }}
        </BaseButton>
      </div>

      <div class="presentment-controls">
        <label>
          <span>{{ t("product.presentmentCurrencies") }}</span>
          <input
            v-model="presentmentCurrencyInput"
            :placeholder="t('product.presentmentCurrenciesPlaceholder')"
          />
        </label>
        <BaseButton :loading="operations.isLoading.value" @click="refreshAll">
          <template #icon><RefreshCw /></template>
          {{ t("product.loadMarketPrices") }}
        </BaseButton>
      </div>

      <div class="variant-form form-grid">
        <label
          v-for="(optionName, optionIndex) in productOptionNames"
          :key="`${optionName}-${optionIndex}`"
          ><span>{{ optionName }} *</span
          ><input
            :value="getVariantOption(optionIndex)"
            :placeholder="t('product.defaultTitle')"
            @input="setVariantOption(optionIndex, $event)"
        /></label>
        <label
          ><span>{{ t("product.price") }} *</span
          ><LocalizedPriceInput
            v-model="variantForm.price"
            :aria-label="t('product.price')"
            placeholder="0.00 / 0,00"
            :title="t('product.priceInputHint')"
        /></label>
        <label
          ><span>{{ t("product.compareAtPrice") }}</span
          ><LocalizedPriceInput
            v-model="variantForm.compare_at_price"
            :aria-label="t('product.compareAtPrice')"
            placeholder="0.00 / 0,00"
            :title="t('product.priceInputHint')"
        /></label>
        <label
          ><span>{{ t("product.sku") }}</span
          ><input v-model="variantForm.sku"
        /></label>
        <label
          ><span>{{ t("product.barcode") }}</span
          ><input v-model="variantForm.barcode"
        /></label>
        <label>
          <span>{{ t("product.image") }}</span>
          <BaseSelect
            :model-value="variantForm.image_id || null"
            :options="variantImageOptions"
            :aria-label="t('product.image')"
            @update:model-value="
              variantForm.image_id = ($event as ShopifyNumericId | null) || null
            "
          />
        </label>
        <label>
          <span>{{ t("product.inventoryPolicy") }}</span>
          <BaseSelect
            :model-value="variantForm.inventory_policy || 'deny'"
            :options="inventoryPolicyOptions"
            :aria-label="t('product.inventoryPolicy')"
            @update:model-value="
              variantForm.inventory_policy = String($event) as 'continue' | 'deny'
            "
          />
        </label>
        <BaseCheckbox v-model="variantForm.taxable" :label="t('product.taxable')" />
        <BaseCheckbox
          v-model="variantForm.requires_shipping"
          :label="t('product.requiresShipping')"
        />
        <div class="form-actions">
          <BaseButton v-if="editingVariantId" @click="resetVariantForm">
            <template #icon><X /></template>
            {{ t("common.cancel") }}
          </BaseButton>
          <BaseButton
            variant="primary"
            :loading="operations.isLoading.value"
            @click="saveVariant"
          >
            <template #icon><Save v-if="editingVariantId" /><Plus v-else /></template>
            {{ editingVariantId ? t("product.saveVariant") : t("product.addVariant") }}
          </BaseButton>
        </div>
      </div>
    </div>

    <div v-if="showInventory" class="operation-section">
      <div class="section-title">
        <div>
          <Boxes /><strong>{{ t("product.inventory") }}</strong>
        </div>
        <span>{{ t("product.inventoryDescription") }}</span>
      </div>
      <div class="inventory-form">
        <label>
          <span>{{ t("product.inventoryTargets") }}</span>
          <BaseSelect
            :model-value="inventoryTargetMode"
            :options="inventoryTargetOptions"
            :aria-label="t('product.inventoryTargets')"
            @update:model-value="
              inventoryTargetMode = String($event) as 'single' | 'selected'
            "
          />
        </label>
        <label>
          <span>{{ t("product.variant") }}</span>
          <BaseSelect
            :model-value="inventoryVariantId"
            :options="inventoryVariantOptions"
            :aria-label="t('product.variant')"
            :disabled="inventoryTargetMode === 'selected'"
            @update:model-value="inventoryVariantId = $event as ShopifyNumericId"
          />
        </label>
        <label>
          <span>{{ t("product.location") }}</span>
          <BaseSelect
            :model-value="inventoryLocationId"
            :options="inventoryLocationOptions"
            :aria-label="t('product.location')"
            :disabled="isLoadingLocations"
            @update:model-value="inventoryLocationId = $event as ShopifyNumericId"
          />
        </label>
        <label>
          <span>{{ t("product.operation") }}</span>
          <BaseSelect
            :model-value="inventoryMode"
            :options="inventoryModeOptions"
            :aria-label="t('product.operation')"
            @update:model-value="
              inventoryMode = String($event) as 'set' | 'adjust' | 'reserve' | 'release'
            "
          />
        </label>
        <label>
          <span>{{ t("product.quantityState") }}</span>
          <BaseSelect
            :model-value="inventoryQuantityName"
            :options="inventoryQuantityOptions"
            :aria-label="t('product.quantityState')"
            :disabled="['reserve', 'release'].includes(inventoryMode)"
            @update:model-value="
              inventoryQuantityName = String($event) as 'available' | 'on_hand'
            "
          />
        </label>
        <label>
          <span>{{ t("product.inventoryReason") }}</span>
          <input v-model.trim="inventoryReason" type="text" maxlength="64" />
        </label>
        <label>
          <span>{{
            inventoryMode === "set"
              ? t("product.available")
              : inventoryMode === "adjust"
                ? t("product.adjustment")
                : t("product.quantity")
          }}</span>
          <input v-model.number="inventoryAmount" type="number" step="1" />
        </label>
        <div class="inventory-current">
          {{
            inventoryTargetMode === "selected"
              ? t("product.inventoryTargetCount", {
                  count: selectedInventoryVariants.length,
                })
              : `${t("product.current")}:`
          }}
          <strong>{{
            inventoryTargetMode === "selected"
              ? selectedInventoryVariants.length
              : (getInventoryQuantity(
                  selectedInventoryLevel,
                  activeInventoryQuantityName,
                ) ??
                (isLoadingLocations ? t("common.loading") : t("product.notConnected")))
          }}</strong>
        </div>
        <BaseButton
          variant="primary"
          :disabled="!canUpdateInventory"
          :loading="operations.isLoading.value"
          @click="updateInventory"
        >
          <template #icon><Save /></template>
          {{ t("product.updateInventory") }}
        </BaseButton>
        <div
          v-if="
            inventoryTargets.length && !inventoryTargetsConnected && !isLoadingLocations
          "
          class="inventory-warning"
          :role="locationError ? 'alert' : 'status'"
        >
          {{ inventoryConnectionMessage }}
        </div>
      </div>
      <InventoryItemEditor
        :inventory-item-id="selectedInventoryVariant?.inventory_item_id || null"
        @saved="afterMutation"
      />
    </div>
  </section>
</template>

<style scoped>
.operations-panel {
  --product-editor-control-height: var(--control-height-md);
  border-top: 1px solid var(--border);
  background: var(--surface);
}
.operations-panel :deep(.base-button) {
  height: var(--product-editor-control-height);
  min-height: var(--product-editor-control-height);
}
.operations-panel :deep(.base-checkbox) {
  min-height: var(--product-editor-control-height);
}
.operations-panel :deep(.base-button.is-icon-only) {
  width: var(--product-editor-control-height);
}
.operations-panel :deep(.select-trigger) {
  height: var(--product-editor-control-height);
  min-height: var(--product-editor-control-height);
  padding-block: 0;
  font-size: 11px;
}
header,
.section-title,
.compact-list article,
.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
header {
  padding: 14px 16px;
}
header > div {
  display: grid;
  gap: 2px;
}
header strong,
.section-title strong {
  color: var(--text);
  font-size: 13px;
}
header span,
.section-title span,
.compact-list span {
  color: var(--text-sub);
  font-size: 11px;
}
.operation-error {
  padding: 10px 16px;
  border-top: 1px solid rgba(180, 49, 43, 0.2);
  background: var(--red-soft);
  color: var(--red);
  font-size: 12px;
}
.operation-section {
  padding: 14px 16px;
  border-top: 1px solid var(--border);
}
.section-title > div {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.section-title svg {
  width: 15px;
  color: var(--green);
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}
.presentment-controls,
.variant-bulk-toolbar {
  display: flex;
  align-items: end;
  gap: 8px;
  margin-top: 10px;
}
.option-name-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}
.option-name-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.option-name-list > :last-child {
  align-self: end;
  justify-self: end;
}
.presentment-controls label {
  flex: 1;
}
.variant-bulk-toolbar {
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 7px 8px;
  background: var(--surface-soft);
}
.variant-bulk-toolbar > span {
  margin-right: auto;
  color: var(--text-sub);
  font-size: 11px;
}
label {
  display: grid;
  gap: 4px;
}
label > span,
legend {
  color: var(--text-sub);
  font-size: 10px;
  font-weight: 600;
}
input,
select {
  width: 100%;
  height: var(--product-editor-control-height);
  min-height: var(--product-editor-control-height);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0 8px;
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  font-size: 11px;
}
.form-actions {
  grid-column: 1 / -1;
  justify-content: flex-end;
}
.compact-list {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}
.compact-list article {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
}
.compact-list article.has-price-change {
  border-color: color-mix(in srgb, var(--green) 52%, var(--border));
  background: color-mix(in srgb, var(--green) 4%, var(--surface));
}
.compact-list article > div:not(.row-actions) {
  display: grid;
  min-width: 0;
  flex: 1;
}
.compact-list strong {
  overflow: hidden;
  color: var(--text);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-actions {
  display: flex;
  gap: 4px;
}
.variant-select {
  width: var(--product-editor-control-height);
  flex: 0 0 auto;
}
.inline-price {
  width: 110px;
  flex: 0 0 auto;
}
.compact-list article > .variant-price-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(90px, 110px)) auto;
  gap: 7px;
  align-items: end;
  flex: 0 1 auto;
}
.price-save-action {
  max-width: 120px;
}
.presentment-price {
  color: var(--green) !important;
}
.image-create {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  gap: 7px;
  margin-top: 10px;
}
.metafield-list article > input {
  min-width: 160px;
  flex: 1;
}
.image-grid {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}
.image-card {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 8px;
}
.image-card > img {
  width: 74px;
  height: 74px;
  border-radius: 5px;
  object-fit: cover;
}
.image-fields {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 7px;
}
.image-fields fieldset {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  border: 0;
  margin: 0;
  padding: 0;
}
.image-assignment-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
}
.image-assignment-row .form-actions {
  grid-column: auto;
  align-self: end;
}
.inventory-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  align-items: end;
  margin-top: 10px;
}
.inventory-current {
  color: var(--text-sub);
  font-size: 11px;
}
.inventory-warning {
  grid-column: 1 / -1;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--red) 28%, var(--border));
  border-radius: 6px;
  background: var(--red-soft);
  color: var(--red);
  font-size: 11px;
  overflow-wrap: anywhere;
}
@media (max-width: 720px) {
  .form-grid,
  .inventory-form,
  .image-create {
    grid-template-columns: 1fr;
  }
  .presentment-controls,
  .variant-bulk-toolbar,
  .compact-list article {
    align-items: stretch;
    flex-direction: column;
  }
  .inline-price {
    width: 100%;
  }
  .compact-list article > .variant-price-fields {
    width: 100%;
    grid-template-columns: 1fr;
  }
  .price-save-action {
    width: 100%;
    max-width: none;
  }
  .form-actions {
    grid-column: auto;
  }
  .image-card {
    grid-template-columns: 1fr;
  }
  .image-assignment-row {
    grid-template-columns: 1fr;
  }
}
</style>
