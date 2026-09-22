import { useSheetService, type ProxySheetRow } from "~/composables/useSheetService";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "~/stores/form";
import { useSheetSettingsStore } from "~/stores/sheetSettings";
import type { ShopifyAccessTokenResponse } from "~~/types/shopify";
import { getAppErrorMessage } from "~~/utils/error";
import { resolveMasterSheetTabs } from "~~/utils/sheetConfig";
import { resolveTokenExpiresAt } from "~~/utils/token-lifecycle";

export type AddStoreMode = "single" | "bulking";
export type AddStoreStepStatus = "pending" | "active" | "done" | "error";

export function useAddStoreConnection() {
  const formStore = useFormStore();
  const credentialVault = useCredentialVaultStore();
  const sheetSettings = useSheetSettingsStore();
  const { t } = useLocalization();
  const runtimeConfig = useRuntimeConfig();
  const {
    readProxySheetRows,
    buildRangeFromSheetName,
    normalizeSpreadsheetId,
    loadMetaByInput,
  } = useSheetService();

  const mode = ref<AddStoreMode>("single");
  const storeId = ref("");
  const domains = ref("");
  const proxy = ref("");
  const clientId = ref("");
  const clientSecret = ref("");
  const isConnecting = ref(false);
  const error = ref("");
  const success = ref("");
  const steps = ref<Array<{ id: string; label: string; status: AddStoreStepStatus }>>([
    { id: "MASTER", label: t("store.searchingMaster"), status: "pending" },
    { id: "TOKEN_GEN", label: t("store.generatingToken"), status: "pending" },
    { id: "DONE", label: t("store.finalizing"), status: "pending" },
  ]);

  function resetSteps() {
    for (const step of steps.value) step.status = "pending";
  }

  function setStep(id: string, status: AddStoreStepStatus) {
    const step = steps.value.find((entry) => entry.id === id);
    if (step) step.status = status;
  }

  function clear() {
    storeId.value = "";
    domains.value = "";
    proxy.value = "";
    clientId.value = "";
    clientSecret.value = "";
    error.value = "";
    success.value = "";
    resetSteps();
  }

  function handleCredentialPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData("text");
    if (!text) return;

    const parts = text.split(/[\/|]/).map((part) => part.trim());
    if (parts.length < 3) return;

    event.preventDefault();
    storeId.value = parts[0] || "";
    clientId.value = parts[1] || "";
    clientSecret.value = parts[2] || "";
  }

  async function connect() {
    const requestedDomains = domains.value
      .split("\n")
      .map((domain) => domain.trim())
      .filter(Boolean);

    if (!requestedDomains.length) {
      error.value = t("store.enterDomain");
      return 0;
    }

    error.value = "";
    success.value = "";
    resetSteps();
    isConnecting.value = true;

    const manualInput = {
      storeId: storeId.value.trim(),
      clientId: clientId.value.trim(),
      clientSecret: clientSecret.value.trim(),
      proxy: proxy.value.trim(),
    };
    const rowsBySheet: Record<string, ProxySheetRow[]> = {};
    const errors: string[] = [];
    let successCount = 0;

    try {
      for (const domain of requestedDomains) {
        resetSteps();
        setStep("MASTER", "active");

        const credentials =
          requestedDomains.length === 1
            ? { ...manualInput }
            : { storeId: "", clientId: "", clientSecret: "", proxy: "" };

        try {
          if (
            !credentials.storeId ||
            !credentials.clientId ||
            !credentials.clientSecret
          ) {
            await populateCredentialsFromSheet(domain, credentials, rowsBySheet);
          } else {
            setStep("MASTER", "done");
          }

          if (formStore.knownStores.includes(credentials.storeId)) {
            throw new Error(`Store ${credentials.storeId} is already connected.`);
          }
          if (
            !credentials.storeId ||
            !credentials.clientId ||
            !credentials.clientSecret
          ) {
            throw new Error("Missing Store ID, Client ID, or Client Secret.");
          }

          setStep("TOKEN_GEN", "active");
          const response = await $fetch<ShopifyAccessTokenResponse>(
            "/api/generate-token",
            {
              method: "POST",
              body: {
                storeId: credentials.storeId,
                clientId: credentials.clientId,
                clientSecret: credentials.clientSecret,
                sock: credentials.proxy,
              },
            },
          );
          if (!response.access_token) {
            throw new Error("Shopify did not return an access token.");
          }
          setStep("TOKEN_GEN", "done");

          setStep("DONE", "active");
          await credentialVault.saveStoreData(credentials.storeId, {
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            accessToken: response.access_token,
            expiresTime: resolveTokenExpiresAt(response),
            domain,
            sock: credentials.proxy,
          });
          await formStore.addKnownStore(credentials.storeId);
          if (requestedDomains.length === 1) {
            await formStore.setActiveStore(credentials.storeId);
          }
          successCount += 1;
          setStep("DONE", "done");
        } catch (connectError) {
          setStep("TOKEN_GEN", "error");
          errors.push(`${domain}: ${toUserFriendlyMessage(connectError)}`);
        }
      }

      error.value = errors.join("\n");
      if (successCount) {
        success.value = t("store.connectedCount", { count: successCount });
        storeId.value = "";
        domains.value = "";
        proxy.value = "";
        clientId.value = "";
        clientSecret.value = "";
      }
      return successCount;
    } finally {
      isConnecting.value = false;
      if (requestedDomains.length > 1) resetSteps();
    }
  }

  async function populateCredentialsFromSheet(
    domain: string,
    credentials: {
      storeId: string;
      clientId: string;
      clientSecret: string;
      proxy: string;
    },
    rowsBySheet: Record<string, ProxySheetRow[]>,
  ) {
    const configuredSheets = sheetSettings.resolve({
      sheetUrls: runtimeConfig.public.sheetUrls,
      masterSheetUrl: runtimeConfig.public.masterSheetUrl,
      masterSheetTabs: runtimeConfig.public.masterSheetTabs,
    });
    const spreadsheetUrl = configuredSheets.masterSheetUrl;
    if (!spreadsheetUrl) {
      throw new Error(
        "Master sheet is not configured. Enter Store ID, Client ID, and Client Secret manually.",
      );
    }

    const configuredTabs = resolveMasterSheetTabs(configuredSheets.masterSheetTabs);
    const metadata = configuredTabs.length
      ? null
      : await loadMetaByInput(spreadsheetUrl);
    const sheetTabs = configuredTabs.length
      ? configuredTabs
      : resolveMasterSheetTabs("", metadata?.sheets || []);
    if (!sheetTabs.length) {
      throw new Error("The master sheet has no configured or discoverable tabs.");
    }

    let match: ProxySheetRow | undefined;
    for (const sheetName of sheetTabs) {
      rowsBySheet[sheetName] ||= await readProxySheetRows({
        spreadsheetId: normalizeSpreadsheetId(spreadsheetUrl),
        range: buildRangeFromSheetName(sheetName),
        dataRowStart: 2,
        mapping: { domain: 6, proxyUrl: 5, credentials: 21 },
      });
      match = rowsBySheet[sheetName].find(
        (row) => row.domain.trim().toLowerCase() === domain.toLowerCase(),
      );
      if (match) break;
    }

    if (!match) throw new Error(`No shop was found for domain ${domain}.`);

    credentials.proxy ||= match.proxyUrl?.trim() || "";
    credentials.storeId ||= match.storeId || "";
    credentials.clientId ||= match.clientId || "";
    credentials.clientSecret ||= match.clientSecret || "";
    setStep("MASTER", "done");
  }

  return {
    mode,
    storeId,
    domains,
    proxy,
    clientId,
    clientSecret,
    isConnecting,
    error,
    success,
    steps,
    clear,
    connect,
    handleCredentialPaste,
  };
}

function toUserFriendlyMessage(error: unknown) {
  const rawMessage = getAppErrorMessage(error, "");
  const message = rawMessage.toLowerCase();

  if (
    message.includes("socks5 authentication failed") ||
    (message.includes("proxy") && message.includes("authentication")) ||
    message.includes("socket closed")
  ) {
    return "The SOCKS proxy is unavailable or its credentials are incorrect.";
  }
  if (
    ["etimedout", "timeout", "econnreset", "ehostunreach", "enotfound"].some((code) =>
      message.includes(code),
    )
  ) {
    return "Could not connect to the proxy or Shopify. Check the network and retry.";
  }
  if (message.includes("no proxy") || message.includes("missing proxy")) {
    return "Proxy information is required for this store.";
  }

  return rawMessage || "The store could not be connected. Please retry.";
}
