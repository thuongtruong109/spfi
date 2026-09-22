<script setup lang="ts">
import {
  Boxes,
  CircleDollarSign,
  FileText,
  Globe2,
  Languages,
  MapPinned,
  Truck,
  X,
} from "@lucide/vue";
import { computed, onMounted, ref, useId } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useMarketStore } from "~/stores/market";
import MarketAssignmentsEditor from "./market/MarketAssignmentsEditor.vue";
import MarketDetailsEditor from "./market/MarketDetailsEditor.vue";
import MarketLocalizationEditor from "./market/MarketLocalizationEditor.vue";
import MarketPricingEditor from "./market/MarketPricingEditor.vue";
import MarketRegionsEditor from "./market/MarketRegionsEditor.vue";
import MarketShippingEditor from "./market/MarketShippingEditor.vue";

const props = defineProps<{ marketId: string }>();
const emit = defineEmits<{ close: [] }>();
const marketStore = useMarketStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const { handleTabKeydown } = useTabKeyboardNavigation("vertical");
const modalRef = ref<HTMLElement | null>(null);
const titleId = `market-editor-title-${useId()}`;
const activeSection = ref("details");
const market = computed(
  () => marketStore.markets.find((item) => item.id === props.marketId) || null,
);
const context = computed(() => marketStore.editorContext);
const isSubdivisionMarket = computed(() =>
  market.value?.regions.some((region) => region.kind === "subdivision"),
);
const { handleKeydown } = useFocusTrap(modalRef, {
  initialFocus: () =>
    modalRef.value?.querySelector<HTMLElement>(".market-editor-nav button") || null,
  onEscape: () => !marketStore.isManaging && emit("close"),
});
const sections = computed(() => [
  { id: "details", label: t("markets.editor.navDetails"), icon: FileText },
  { id: "regions", label: t("markets.editor.navRegions"), icon: MapPinned },
  { id: "pricing", label: t("markets.editor.navPricing"), icon: CircleDollarSign },
  { id: "assignments", label: t("markets.editor.navAssignments"), icon: Boxes },
  { id: "shipping", label: t("markets.editor.navShipping"), icon: Truck },
  { id: "localization", label: t("markets.editor.navLocalization"), icon: Languages },
]);

async function loadEditorData(force = false) {
  await Promise.all([
    marketStore.fetchMarketDetail(storeId.value, token.value, props.marketId, force),
    marketStore.fetchEditorContext(storeId.value, token.value, force),
  ]);
}

onMounted(() => {
  marketStore.clearLocalization();
  void loadEditorData();
});
</script>

<template>
  <Teleport to="body">
    <div
      class="market-modal-backdrop"
      @click.self="!marketStore.isManaging && emit('close')"
    >
      <section
        ref="modalRef"
        class="market-modal market-editor-modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @keydown="handleKeydown"
      >
        <header class="market-modal-header">
          <div class="market-editor-title">
            <span><Globe2 aria-hidden="true" /></span>
            <div>
              <p>{{ t("markets.editor.workspace") }}</p>
              <h2 :id="titleId">{{ market?.name || t("markets.title") }}</h2>
            </div>
          </div>
          <BaseButton
            variant="ghost"
            icon-only
            :aria-label="t('common.close')"
            :disabled="marketStore.isManaging"
            @click="emit('close')"
            ><template #icon><X /></template
          ></BaseButton>
        </header>

        <div v-if="!market" class="market-editor-loading">
          {{ t("markets.editor.marketUnavailable") }}
        </div>
        <div v-else-if="market.detailsLoaded === false" class="market-editor-loading">
          <template v-if="marketStore.marketDetailErrors[marketId]">
            <span role="alert">{{ marketStore.marketDetailErrors[marketId] }}</span>
            <BaseButton @click="loadEditorData(true)">{{
              t("common.retry")
            }}</BaseButton>
          </template>
          <template v-else>
            <ApiLoadingIcon variant="section" aria-hidden="true" />
            {{ t("markets.editor.loadingWorkspace") }}
          </template>
        </div>
        <div v-else class="market-editor-layout">
          <nav
            class="market-editor-nav"
            role="tablist"
            :aria-label="t('markets.editor.sections')"
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
              <component :is="section.icon" aria-hidden="true" /><span>{{
                section.label
              }}</span>
            </button>
          </nav>
          <main class="market-editor-content">
            <div
              v-if="marketStore.managerError && !context"
              class="market-callout is-danger"
              role="alert"
            >
              <strong>{{ t("markets.editor.contextFailedTitle") }}</strong
              ><span>{{ marketStore.managerError }}</span>
              <BaseButton
                :loading="marketStore.isManaging"
                @click="marketStore.fetchEditorContext(storeId, token, true)"
                >{{ t("common.retry") }}</BaseButton
              >
            </div>
            <div v-else-if="!context" class="market-editor-loading">
              <ApiLoadingIcon variant="section" aria-hidden="true" />
              {{ t("markets.editor.loadingWorkspace") }}
            </div>
            <template v-else>
              <div v-if="isSubdivisionMarket" class="market-callout is-warning">
                <strong>{{ t("markets.editor.subdivisionPreviewTitle") }}</strong>
                <span>{{ t("markets.editor.subdivisionPreviewDescription") }}</span>
              </div>
              <div
                v-for="warning in context.warnings"
                :key="warning"
                class="market-callout is-warning"
              >
                <strong>{{ t("markets.editor.contextWarningTitle") }}</strong
                ><span>{{ t(`markets.editor.warning.${warning}` as never) }}</span>
              </div>
              <MarketDetailsEditor
                v-if="activeSection === 'details'"
                :market="market"
              />
              <MarketRegionsEditor
                v-else-if="activeSection === 'regions'"
                :market="market"
                :context="context"
              />
              <MarketPricingEditor
                v-else-if="activeSection === 'pricing'"
                :market="market"
              />
              <MarketAssignmentsEditor
                v-else-if="activeSection === 'assignments'"
                :market="market"
                :context="context"
              />
              <MarketShippingEditor
                v-else-if="activeSection === 'shipping'"
                :market="market"
                :context="context"
              />
              <MarketLocalizationEditor v-else :market="market" :context="context" />
            </template>
          </main>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style src="../../assets/styles/components/market-editor.css"></style>
