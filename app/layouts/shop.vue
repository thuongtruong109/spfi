<script lang="ts" setup>
import { ArrowLeftToLine, ArrowRightToLine, Search, X } from "@lucide/vue";
import { useStoreTabData } from "~/composables/useStoreTabData";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useMarketStore } from "~/stores/market";
import { resolveStoreTab } from "~~/types/store";
import { resolveStoreAccessToken } from "~~/utils/shop-auth";
import { useLoading } from "../composables/useLoading";
import { useCommerceOpsStore } from "../stores/commerceOps";
import { useCustomerStore } from "../stores/customers";
import { useFormStore } from "../stores/form";
import { useOrderStore } from "../stores/order";
import { usePaymentStore } from "../stores/payment";
import { useProductStore } from "../stores/product";
import { useShopProfileStore } from "../stores/shopProfile";
import { useTrafficStore } from "../stores/traffic";

const formStore = useFormStore();
const { t } = useLocalization();
const { requestConfirmation } = useConfirmDialog();
const credentialVault = useCredentialVaultStore();
const customerStore = useCustomerStore();
const marketStore = useMarketStore();
const commerceOpsStore = useCommerceOpsStore();
const paymentStore = usePaymentStore(); // Moved up and ensured it's available
const orderStore = useOrderStore();
const productStore = useProductStore();
const shopProfileStore = useShopProfileStore();
const trafficStore = useTrafficStore();
const route = useRoute();
const router = useRouter();
const { hydrateStoreData, loadStoreTabData } = useStoreTabData();

const { loading: globalLoading } = useLoading();
const isLayoutActive = ref(true);
const hasSkippedInitialActivation = ref(false);
const isSidebarCollapsed = ref(false);

onMounted(() => {
  isSidebarCollapsed.value = localStorage.getItem("spf-sidebar-collapsed") === "true";
  formStore.loadKnownStores();
  syncShopFromRoute(true);
});

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
  localStorage.setItem("spf-sidebar-collapsed", String(isSidebarCollapsed.value));
}

onActivated(() => {
  isLayoutActive.value = true;

  if (!hasSkippedInitialActivation.value) {
    hasSkippedInitialActivation.value = true;
    return;
  }

  syncShopFromRoute(true);
});

onDeactivated(() => {
  isLayoutActive.value = false;
  globalLoading.value = false;
});

const isFetching = computed(() => {
  const path = route.path;
  if (path === "/order" || path.startsWith("/order/")) return orderStore.isLoading;
  if (path.startsWith("/store")) {
    if (route.query.tab === "customers") {
      return customerStore.isLoading || customerStore.isLoadingDetail;
    }
    if (route.query.tab === "operations") return commerceOpsStore.isLoading;
    if (route.query.tab === "markets") {
      return marketStore.isLoading || marketStore.isMutating || marketStore.isResolving;
    }
    if (route.query.tab === "traffic") return trafficStore.isLoading;
    if (route.query.tab === "profile") {
      return (
        shopProfileStore.isLoading || paymentStore.isLoading || orderStore.isLoading
      );
    }
    if (route.query.tab === "products") return productStore.isLoading;
    if (route.query.tab === "orders") return orderStore.isLoading;
    return paymentStore.isLoading || orderStore.isLoading;
  }
  if (path === "/customer") {
    return customerStore.isLoading || customerStore.isLoadingDetail;
  }
  if (path === "/profile") {
    return shopProfileStore.isLoading || productStore.isLoading;
  }
  return false;
});

const noStores = computed(() => formStore.knownStores.length === 0);

watch(
  isFetching,
  (val) => {
    if (!isLayoutActive.value) return;

    if (val) globalLoading.value = true;
    else {
      globalLoading.value = false;
    }
  },
  { immediate: false },
);

// Own route-scoped fetching so shop selection is synchronized before a request starts.
watch([() => route.path, () => getRouteShop()], () => {
  if (!isLayoutActive.value) return;

  syncShopFromRoute(true);
});

// ── Shop selector ────────────────────────────────────────────────────────────
function getRouteShop() {
  const queryShop = route.query.shop;

  if (Array.isArray(queryShop)) {
    return queryShop[0] || "";
  }

  return typeof queryShop === "string" ? queryShop : "";
}

function syncShopFromRoute(shouldFetch = false) {
  let queryShop = getRouteShop();

  if (!queryShop) {
    queryShop = formStore.storeId || "";
    if (!queryShop) return;
  }

  const didChangeShop = formStore.storeId !== queryShop;
  formStore.setActiveStore(queryShop);

  if (didChangeShop) {
    hydrateStoreData(queryShop);
  }

  if (!getRouteShop()) {
    void router.replace({ query: { ...route.query, shop: queryShop } });
    return;
  }

  if (shouldFetch) {
    fetchCurrent();
  }
}

function onSelectStore(id: string) {
  if (formStore.storeId === id) {
    if (getRouteShop() !== id) {
      router.replace({ query: { ...route.query, shop: id } });
    }
    return;
  }

  formStore.setActiveStore(id);

  // Sync URL query param
  router.replace({ query: { ...route.query, shop: id } });

  // Hydrate cached data for quick switch, fallback to reset
  hydrateStoreData(id);
}

// ── Resolve valid token for current storeId ──────────────────────────────────
function resolveToken(sid: string): string | null {
  if (!sid) return null;
  return resolveStoreAccessToken(credentialVault.getStoreData(sid)) || null;
}

// ── Fetch for the current page ───────────────────────────────────────────────
function fetchCurrent(force = false) {
  const sid = formStore.storeId;
  if (!sid) return;

  if (route.path === "/store") {
    if (force) {
      void loadStoreTabData(resolveStoreTab(route.query.tab), sid, true);
    }
    return;
  }

  const token = resolveToken(sid);

  if (!token) {
    const msg = "Token expired or missing. Please go to Token page.";
    if (route.path === "/order") orderStore.error = msg;
    if (route.path.startsWith("/store")) paymentStore.error = msg;
    if (route.path === "/customer") customerStore.error = msg;
    if (route.path === "/profile") shopProfileStore.error = msg;
    return;
  }

  // Clear previous errors
  if (route.path.startsWith("/order")) orderStore.error = null;
  if (route.path.startsWith("/store")) paymentStore.error = null;
  if (route.path === "/customer") customerStore.error = null;
  if (route.path === "/profile") shopProfileStore.error = null;

  if (route.path === "/order") {
    if (force || !orderStore.hasFetchedAll) orderStore.fetchAll(sid, token);
    paymentStore.fetchBalanceTransactions(sid, token, force);
  } else if (route.path.startsWith("/order/")) {
    const idMatch = route.path.match(/\/order\/(\d+)/);
    if (idMatch && idMatch[1]) {
      orderStore.fetchById(sid, token, idMatch[1], force);
    }
  } else if (route.path.startsWith("/store/payout/")) {
    const idMatch = route.path.match(/\/store\/payout\/(\d+)/);
    if (idMatch && idMatch[1]) {
      void Promise.all([
        paymentStore.fetchPayoutDetail(sid, token, idMatch[1], force),
        paymentStore.fetchPaymentsAccount(sid, token, force),
      ]);
    }
  } else if (route.path === "/customer") {
    if (force || !customerStore.hasFetchedAll) {
      customerStore.fetchAll(sid, token, customerStore.activeQuery);
    }
  } else if (route.path === "/profile") {
    if (force || !shopProfileStore.hasFetchedProfile) {
      shopProfileStore.fetchProfile(sid, token);
    }
    if (force || !productStore.hasFetchedAll) {
      productStore.fetchAll(sid, token);
    }
  }
}

// ── Get domain label for store select ────────────────────────────────────────
function getStoreDomain(id: string): string {
  if (!id) return "";
  return credentialVault.getPublicStoreData(id).domain || "";
}

function getStoreInitials(id: string): string {
  const label = getStoreDomain(id) || id;
  return (
    label
      .replace(/^https?:\/\//, "")
      .charAt(0)
      .toUpperCase() || "S"
  );
}

// ── Search functionality ─────────────────────────────────────────────────────
const searchQuery = ref("");
const filteredStores = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return formStore.knownStores;
  return formStore.knownStores.filter((id) => {
    const domain = getStoreDomain(id).toLowerCase();
    return id.toLowerCase().includes(query) || domain.includes(query);
  });
});

// ── Add Store Modal State ───────────────────────────────────────────────────
const isAddModalOpen = ref(false);

async function deleteStoreOption(id: string) {
  if (
    !(await requestConfirmation({
      title: t("confirm.deleteTitle"),
      message: t("store.deleteConfirm", { id }),
      confirmLabel: t("common.delete"),
    }))
  ) {
    return;
  }
  formStore.removeKnownStore(id);
  credentialVault.removeStoreData(id);
}
</script>

<template>
  <div class="shop-layout-container" :class="{ 'is-single-panel': noStores }">
    <!-- Sidebar Navigation -->
    <aside
      v-if="!noStores"
      class="sidebar"
      :class="{ 'is-collapsed': isSidebarCollapsed }"
    >
      <div class="sidebar-overview">
        <div v-if="!isSidebarCollapsed" class="search-container">
          <Search class="search-icon" :size="14" aria-hidden="true" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search stores..."
            class="sidebar-search"
          />
          <span class="store-count" aria-label="Connected stores">
            {{ formStore.knownStores.length }}
          </span>
        </div>
        <div class="sidebar-overview-actions">
          <BaseButton
            class="sidebar-add-store"
            variant="secondary"
            icon-only
            aria-label="Add new store"
            title="Add new store"
            @click="isAddModalOpen = true"
          >
            <template #icon><IconsAdd /></template>
          </BaseButton>
          <BaseButton
            class="sidebar-toggle"
            variant="ghost"
            icon-only
            :aria-label="
              isSidebarCollapsed ? 'Expand store sidebar' : 'Collapse store sidebar'
            "
            :title="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            @click="toggleSidebar"
          >
            <template #icon>
              <ArrowRightToLine v-if="isSidebarCollapsed" />
              <ArrowLeftToLine v-else />
            </template>
          </BaseButton>
        </div>
      </div>

      <div class="sidebar-content">
        <template v-if="noStores">
          <div class="sidebar-empty">
            <p>No stores found</p>
            <NuxtLink to="/manager" class="shop-bar-link">Add Store</NuxtLink>
          </div>
        </template>
        <template v-else>
          <div
            v-for="id in filteredStores"
            :key="id"
            class="sidebar-item"
            :class="{
              active: formStore.storeId === id,
            }"
            :title="isSidebarCollapsed ? getStoreDomain(id) || id : undefined"
          >
            <div class="sidebar-item-label" @click="onSelectStore(id)">
              <span class="store-mark">{{ getStoreInitials(id) }}</span>
              <span v-if="!isSidebarCollapsed" class="store-copy">
                <strong>{{ getStoreDomain(id) || id }}</strong>
                <small>{{ id }}</small>
              </span>
            </div>
            <div v-if="!isSidebarCollapsed" class="sidebar-item-action-wrapper">
              <div @click.stop class="sidebar-item-actions">
                <BasePopover align="right">
                  <template #trigger="{ isOpen, triggerProps }">
                    <button
                      v-bind="triggerProps"
                      type="button"
                      class="btn-sidebar-more"
                      :class="{ 'is-active': isOpen }"
                    >
                      <IconsMore
                        width="16"
                        height="16"
                        style="transform: rotate(90deg)"
                      />
                    </button>
                  </template>
                  <template #default="{ close }">
                    <div class="popover-menu">
                      <button
                        type="button"
                        role="menuitem"
                        class="popover-item"
                        @click="
                          deleteStoreOption(id);
                          close();
                        "
                        style="color: var(--badge-cancelled-text, #d72c0d)"
                      >
                        <IconsDelete />
                        Remove shop
                      </button>
                    </div>
                  </template>
                </BasePopover>
              </div>
            </div>
          </div>
        </template>
      </div>

      <ShopRateLimitQuota :collapsed="isSidebarCollapsed" />
    </aside>

    <!-- Main Content Area -->
    <main class="main-content">
      <div class="shop-bar">
        <div class="shop-bar-left">
          <slot name="shop-bar-left">
            <div class="title-container">
              <slot name="title" />
              <IconsArrowRight v-if="formStore.storeId" />
              <h3 v-if="formStore.storeId">
                {{ getStoreDomain(formStore.storeId) || formStore.storeId }}
              </h3>
            </div>
          </slot>
        </div>

        <div class="shop-bar-right">
          <BaseButton
            v-if="formStore.storeId"
            class="btn-fetch"
            title="Refresh data for current store"
            :loading="isFetching"
            @click="fetchCurrent(true)"
          >
            <template #icon>
              <IconsRefresh />
            </template>
            {{ isFetching ? t("common.loading") : t("common.refresh") }}
          </BaseButton>
          <BaseButton
            v-if="noStores"
            variant="primary"
            title="Add new store"
            @click="isAddModalOpen = true"
          >
            <template #icon><IconsAdd /></template>
            Add store
          </BaseButton>
        </div>
      </div>

      <div class="page-content">
        <slot />
      </div>
    </main>

    <!-- Add Store Modal -->
    <div
      v-if="isAddModalOpen"
      class="modal-backdrop add-store-backdrop"
      @click.self="isAddModalOpen = false"
    >
      <div
        class="modal-card add-store-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-store-modal-title"
      >
        <div class="modal-head add-store-modal-head">
          <h3 id="add-store-modal-title" class="modal-title">
            {{ t("store.connectNew") }}
          </h3>
          <BaseButton
            variant="ghost"
            icon-only
            :title="t('common.close')"
            :aria-label="t('common.close')"
            @click="isAddModalOpen = false"
          >
            <template #icon><X /></template>
          </BaseButton>
        </div>
        <div class="modal-body add-store-modal-body">
          <StoreAddStoreForm
            show-cancel
            @cancel="isAddModalOpen = false"
            @connected="isAddModalOpen = false"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="../assets/styles/layouts/shop.css"></style>
