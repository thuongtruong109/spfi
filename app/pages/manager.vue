<script lang="ts" setup>
import { ArrowDown, ArrowUp, X } from "@lucide/vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "~/stores/form";
import type { AddStoreMode } from "~/composables/useAddStoreConnection";
import type { ShopifyAccessTokenResponse } from "~~/types/shopify";
import { getAppErrorMessage } from "~~/utils/error";
import { resolveTokenExpiresAt } from "~~/utils/token-lifecycle";

definePageMeta({ layout: false });

const formStore = useFormStore();
const { t } = useLocalization();
const { requestConfirmation } = useConfirmDialog();
const credentialVault = useCredentialVaultStore();
const route = useRoute();
const feedback = useStoreFeedback();

// ── Local state ───────────────────────────────────────────────────────────────
const rotatingIds = ref<Record<string, boolean>>({});
const testingProxies = ref<Record<string, boolean>>({});
type ProxyCheckError = string | { message?: string };
type ProxyCheckResult = {
  success: boolean;
  ip?: string;
  duration?: number;
  error?: ProxyCheckError;
};

const proxyResults = ref<
  Record<string, { success: boolean; ip?: string; duration?: number; error?: string }>
>({});
const addStoreMode = ref<AddStoreMode>("single");

// ── Search and Sort state ──────────────────────────────────────────────────
const searchQuery = ref("");
const sortOrder = ref("expiry_desc"); // domain_asc, domain_desc, expiry_asc, expiry_desc

function toUserFriendlyMessage(error: unknown) {
  const rawMessage = getAppErrorMessage(error, "");
  const msg = rawMessage.toLowerCase();

  if (
    msg.includes("socks5 authentication failed") ||
    (msg.includes("proxy") && msg.includes("authentication")) ||
    msg.includes("socket closed")
  ) {
    return "The SOCKS proxy is currently not working or the account details are incorrect. Please switch to a different proxy and try again.";
  }

  if (
    msg.includes("etimedout") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("ehostunreach") ||
    msg.includes("enotfound")
  ) {
    return "Không kết nối được tới proxy hoặc Shopify. Vui lòng kiểm tra mạng/proxy rồi thử lại.";
  }

  if (msg.includes("no proxy") || msg.includes("missing proxy")) {
    return "Thiếu thông tin sock (proxy). Vui lòng nhập sock trước khi thêm shop.";
  }

  return rawMessage || "Thao tác chưa thành công. Vui lòng thử lại.";
}

// ── Load stores on mount ──────────────────────────────────────────────────────
onMounted(() => {
  formStore.loadKnownStores();
  openEditModalFromRoute();
});

watch(
  () => route.query.edit,
  () => openEditModalFromRoute(),
);

function getRouteEditStoreId() {
  const edit = route.query.edit;
  return Array.isArray(edit) ? edit[0] || "" : String(edit || "");
}

function openEditModalFromRoute() {
  const editStoreId = getRouteEditStoreId();
  if (!editStoreId || !formStore.knownStores.includes(editStoreId)) return;
  openEditModal(editStoreId);
}

// ── Per-store cookie data ─────────────────────────────────────────────────────
interface StoreInfo {
  id: string;
  domain: string;
  hasToken: boolean;
  expired: boolean;
  expiryLabel: string;
}

function getStoreInfo(id: string): StoreInfo {
  const data = credentialVault.getStoreData(id);
  if (!data || typeof data !== "object") {
    return {
      id,
      domain: "",
      hasToken: false,
      expired: false,
      expiryLabel: "",
    };
  }
  const now = Date.now();
  const hasToken = !!data.accessToken;
  const expired = hasToken && !!data.expiresTime && now >= data.expiresTime;
  const diff = data.expiresTime ? data.expiresTime - now : 0;
  let expiryLabel = "";
  if (hasToken && !expired && diff > 0) {
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    expiryLabel = h >= 1 ? `${h}h ${m}m remaining` : `${m}m remaining`;
  }
  return {
    id,
    domain: data.domain || "",
    hasToken,
    expired,
    expiryLabel,
  };
}

const storeList = computed<StoreInfo[]>(() => formStore.knownStores.map(getStoreInfo));

const filteredStoreList = computed(() => {
  let list = [...storeList.value];

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter((s) => s.domain.toLowerCase().includes(q));
  }

  list.sort((a, b) => {
    if (sortOrder.value === "domain_asc") return a.domain.localeCompare(b.domain);
    if (sortOrder.value === "domain_desc") return b.domain.localeCompare(a.domain);

    const timeA = credentialVault.getStoreData(a.id).expiresTime || 0;
    const timeB = credentialVault.getStoreData(b.id).expiresTime || 0;

    if (sortOrder.value === "expiry_asc") return timeA - timeB;
    if (sortOrder.value === "expiry_desc") return timeB - timeA;

    return 0;
  });

  return list;
});

// ── Delete store ──────────────────────────────────────────────────────────────
async function deleteStore(id: string) {
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

// ── Edit store ───────────────────────────────────────────────────────────────
const showEditModal = ref(false);
const editingStoreId = ref("");
const editDomain = ref("");
const editSock = ref("");
const editClientId = ref("");
const editClientSecret = ref("");
const editError = ref("");

function openEditModal(id: string) {
  const data = credentialVault.getStoreData(id);

  editingStoreId.value = id;
  editDomain.value = data.domain || "";
  editSock.value = data.sock || "";
  editClientId.value = data.clientId || "";
  editClientSecret.value = data.clientSecret || "";
  editError.value = "";
  showEditModal.value = true;
}

function closeEditModal() {
  showEditModal.value = false;
  editingStoreId.value = "";
  editDomain.value = "";
  editSock.value = "";
  editClientId.value = "";
  editClientSecret.value = "";
  editError.value = "";
}

async function saveEditedStore() {
  if (!editingStoreId.value) return;

  const id = editingStoreId.value;
  const previous = credentialVault.getStoreData(id);

  if (!editClientId.value.trim() || !editClientSecret.value.trim()) {
    editError.value = "Client ID và Client Secret không được để trống.";
    return;
  }

  await credentialVault.saveStoreData(id, {
    ...previous,
    domain: editDomain.value.trim(),
    sock: editSock.value.trim(),
    clientId: editClientId.value.trim(),
    clientSecret: editClientSecret.value.trim(),
  });

  feedback.success(`Store \"${id}\" updated successfully.`);
  editError.value = "";
  closeEditModal();
}

async function rotateToken(id: string) {
  const data = credentialVault.getStoreData(id);

  if (!data?.clientId || !data?.clientSecret) {
    alert("Missing client ID or secret for this store. Please re-add it.");
    return;
  }

  rotatingIds.value[id] = true;
  try {
    const res = await $fetch<ShopifyAccessTokenResponse>("/api/generate-token", {
      method: "POST",
      body: {
        storeId: id,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        sock: data.sock,
      },
    });

    if (res?.access_token) {
      await credentialVault.patchStoreData(id, {
        accessToken: res.access_token,
        expiresTime: resolveTokenExpiresAt(res),
      });
    } else {
      throw new Error("Failed to rotate token");
    }
  } catch (e) {
    alert("Rotate failed: " + toUserFriendlyMessage(e));
  } finally {
    rotatingIds.value[id] = false;
  }
}

async function testProxy(id: string) {
  const data = credentialVault.getStoreData(id);
  if (!data?.sock) {
    alert("No sock/proxy information found for this store.");
    return;
  }

  testingProxies.value[id] = true;
  delete proxyResults.value[id];

  try {
    const res = await $fetch<ProxyCheckResult>("/api/check-proxy", {
      method: "POST",
      body: { proxy: data.sock },
    });
    proxyResults.value[id] = {
      ...res,
      error: getProxyCheckErrorMessage(res.error),
    };
  } catch (err) {
    proxyResults.value[id] = {
      success: false,
      error: getAppErrorMessage(err, "Request failed"),
    };
  } finally {
    testingProxies.value[id] = false;
  }
}

function getProxyCheckErrorMessage(error?: ProxyCheckError) {
  if (typeof error === "string" && error) {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    typeof error.message === "string" &&
    error.message
  ) {
    return error.message;
  }

  return undefined;
}
</script>

<template>
  <AdminPageShell
    title="Shop Management"
    sub="Manage your Shopify store access tokens and credentials"
    size="wide"
  >
    <template #icon>
      <IconsBulking />
    </template>
    <template #actions>
      <StoreAddModeToggle v-model="addStoreMode" />
    </template>
    <div class="token-page">
      <!-- ── Add new store ── -->
      <section class="card add-store-card">
        <StoreAddStoreForm
          v-model:mode="addStoreMode"
          :bulk-rows="25"
          :show-mode-toggle="false"
        />
      </section>
      <!-- ── Store list ── -->
      <section class="card" v-if="storeList.length">
        <div class="card-head">
          <div class="card-head-title">
            <span class="card-title">Configured Stores</span>
            <span class="count-badge">{{ filteredStoreList.length }}</span>
          </div>
          <div class="card-head-actions">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search domain..."
              class="search-inp"
            />
            <BasePopover align="right">
              <template #trigger="{ isOpen, triggerProps }">
                <BaseButton
                  v-bind="triggerProps"
                  class="btn-sort"
                  icon-only
                  :class="{ 'is-active': isOpen }"
                  aria-label="Sort stores"
                >
                  <template #icon><IconsSort /></template>
                </BaseButton>
              </template>
              <template #default="{ close }">
                <div class="popover-menu">
                  <button
                    type="button"
                    role="menuitem"
                    class="popover-item"
                    :class="{ active: sortOrder === 'domain_asc' }"
                    @click="
                      sortOrder = 'domain_asc';
                      close();
                    "
                  >
                    <ArrowUp aria-hidden="true" />
                    Domain (A-Z)
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    class="popover-item"
                    :class="{ active: sortOrder === 'domain_desc' }"
                    @click="
                      sortOrder = 'domain_desc';
                      close();
                    "
                  >
                    <ArrowDown aria-hidden="true" />
                    Domain (Z-A)
                  </button>
                  <div class="popover-divider"></div>
                  <button
                    type="button"
                    role="menuitem"
                    class="popover-item"
                    :class="{ active: sortOrder === 'expiry_asc' }"
                    @click="
                      sortOrder = 'expiry_asc';
                      close();
                    "
                  >
                    <ArrowUp aria-hidden="true" />
                    Expiry (Oldest)
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    class="popover-item"
                    :class="{ active: sortOrder === 'expiry_desc' }"
                    @click="
                      sortOrder = 'expiry_desc';
                      close();
                    "
                  >
                    <ArrowDown aria-hidden="true" />
                    Expiry (Newest)
                  </button>
                </div>
              </template>
            </BasePopover>
          </div>
        </div>
        <div class="store-row" v-for="store in filteredStoreList" :key="store.id">
          <div class="store-id">{{ store.domain || "(No domain)" }}</div>
          <div class="store-meta">
            <span v-if="!store.hasToken" class="tag tag-warn">No token</span>
            <span v-else-if="store.expired" class="tag tag-err">Expired</span>
            <span v-else class="tag tag-ok">
              <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clip-rule="evenodd"
                />
              </svg>
              Valid
            </span>
            <span v-if="store.expiryLabel" class="expiry">{{ store.expiryLabel }}</span>

            <!-- proxy check result tooltip-like tag -->
            <span
              v-if="proxyResults[store.id]"
              class="tag"
              :class="proxyResults[store.id]?.success ? 'tag-ok' : 'tag-err'"
            >
              {{
                proxyResults[store.id]?.success
                  ? `${proxyResults[store.id]?.ip} (${proxyResults[store.id]?.duration}ms)`
                  : "Proxy Fail"
              }}
            </span>
          </div>
          <div class="store-actions">
            <BaseButton
              :disabled="testingProxies[store.id]"
              @click="testProxy(store.id)"
            >
              <template #icon>
                <IconsSync v-if="testingProxies[store.id]" />
                <IconsCheck v-else />
              </template>
              {{ testingProxies[store.id] ? "Testing…" : "Check" }}
            </BaseButton>
            <BaseButton
              :disabled="rotatingIds[store.id]"
              @click="rotateToken(store.id)"
            >
              <template #icon><IconsSync /></template>
              {{ rotatingIds[store.id] ? "Rotating…" : "Rotate" }}
            </BaseButton>
            <BaseButton @click="openEditModal(store.id)">
              <template #icon><IconsMore /></template>
              Edit
            </BaseButton>
            <BaseButton variant="danger-ghost" @click="deleteStore(store.id)">
              <template #icon><IconsDelete /></template>
              Delete
            </BaseButton>
          </div>
        </div>
      </section>

      <div v-else class="empty-state">No stores configured yet. Add one below.</div>

      <div v-if="showEditModal" class="modal-backdrop" @click.self="closeEditModal">
        <div class="modal-card">
          <div class="modal-head">
            <h3 class="modal-title">Edit Store</h3>
            <BaseButton
              variant="ghost"
              icon-only
              :aria-label="t('common.close')"
              @click="closeEditModal"
            >
              <template #icon><X aria-hidden="true" /></template>
            </BaseButton>
          </div>

          <div class="modal-body">
            <div class="field field-2">
              <label class="field-label">Sock (Proxy URL)</label>
              <input
                v-model="editSock"
                type="text"
                class="inp"
                placeholder="IP:Port:User:Pass"
              />
            </div>
            <div class="field field-1">
              <label class="field-label">Domain</label>
              <input
                v-model="editDomain"
                type="text"
                class="inp"
                placeholder="myshop.store"
              />
            </div>
            <div class="field field-1">
              <label class="field-label">Store ID</label>
              <input class="inp" :value="editingStoreId" disabled />
            </div>
            <div class="field field-1">
              <label class="field-label">Client ID</label>
              <input v-model="editClientId" type="text" class="inp" />
            </div>
            <div class="field field-1">
              <label class="field-label">Client Secret</label>
              <input v-model="editClientSecret" type="text" class="inp" />
            </div>
          </div>

          <div v-if="editError" class="alert alert-err modal-alert">
            {{ editError }}
          </div>

          <div class="modal-actions_2">
            <BaseButton size="medium" @click="closeEditModal">
              <template #icon><IconsArrowRight class="icon-left" /></template>
              Cancel
            </BaseButton>
            <BaseButton size="medium" variant="primary" @click="saveEditedStore">
              <template #icon><IconsCheck /></template>
              Save
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </AdminPageShell>
</template>

<style scoped src="../assets/styles/pages/manager.css"></style>
