import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useCustomerStore } from "~/stores/customers";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import { useDataRetentionStore } from "~/stores/dataRetention";
import { useFormStore } from "~/stores/form";
import { useLocationStore } from "~/stores/locations";
import { useMarketStore } from "~/stores/market";
import { useOrderStore } from "~/stores/order";
import { usePaymentStore } from "~/stores/payment";
import { useProductStore } from "~/stores/product";
import { useShopProfileStore } from "~/stores/shopProfile";
import { useTrafficStore } from "~/stores/traffic";
import type { StoreTab } from "~~/types/store";
import { getStoreTokenState, resolveStoreAccessToken } from "~~/utils/shop-auth";
import {
  forgetStoreResource,
  getStoreResourceLoadedAt,
  markStoreResourceLoaded,
  type StoreDataResource,
} from "~~/utils/store-resource-cache";
import { hydrateInactiveStoreScopes } from "~~/utils/store-scope";

const MISSING_TOKEN_MESSAGE =
  "Access token is missing. Update this store's credentials and try again.";
const EXPIRED_TOKEN_MESSAGE =
  "Access token has expired. Update this store's credentials and try again.";

const TAB_RESOURCES: Record<StoreTab, StoreDataResource[]> = {
  transactions: ["paymentTransactions"],
  payouts: ["paymentAccount", "paymentPayouts"],
  disputes: ["disputes"],
  orders: ["orders", "paymentTransactions"],
  products: ["products", "locations"],
  customers: ["customers"],
  markets: ["markets"],
  traffic: ["traffic"],
  operations: ["commerceOps"],
  profile: [
    "profile",
    "paymentAccount",
    "paymentPayouts",
    "paymentTransactions",
    "orders",
  ],
};

export function useStoreTabData() {
  const formStore = useFormStore();
  const credentialVault = useCredentialVaultStore();
  const dataRetention = useDataRetentionStore();
  const customerStore = useCustomerStore();
  const commerceOpsStore = useCommerceOpsStore();
  const locationStore = useLocationStore();
  const marketStore = useMarketStore();
  const orderStore = useOrderStore();
  const paymentStore = usePaymentStore();
  const productStore = useProductStore();
  const profileStore = useShopProfileStore();
  const trafficStore = useTrafficStore();

  function isResourceExpired(storeId: string, resource: StoreDataResource) {
    return !dataRetention.isAlive(getStoreResourceLoadedAt(storeId, resource));
  }

  function markResourceLoaded(storeId: string, resource: StoreDataResource) {
    markStoreResourceLoaded(storeId, resource);
  }

  function clearExpiredResources(storeId: string, resources: StoreDataResource[]) {
    const expired = resources.filter((resource) =>
      isResourceExpired(storeId, resource),
    );
    if (!expired.length) return;

    const expiredSet = new Set(expired);
    if (expiredSet.has("orders")) orderStore.evictStore(storeId);
    if (expiredSet.has("products")) productStore.evictStore(storeId);
    if (expiredSet.has("locations")) locationStore.evictStore(storeId);
    if (expiredSet.has("markets")) marketStore.evictStore(storeId);
    if (expiredSet.has("customers")) customerStore.evictStore(storeId);
    if (expiredSet.has("commerceOps")) commerceOpsStore.evictStore(storeId);
    if (expiredSet.has("profile")) profileStore.evictStore(storeId);
    if (expiredSet.has("traffic")) trafficStore.evictStore(storeId);
    for (const resource of expired) forgetStoreResource(storeId, resource);
  }

  function hydrateStoreData(storeId: string) {
    hydrateInactiveStoreScopes(storeId, [
      orderStore,
      paymentStore,
      productStore,
      locationStore,
      marketStore,
      customerStore,
      commerceOpsStore,
      profileStore,
      trafficStore,
    ]);
  }

  function ensureStoreScope(storeId: string) {
    const isCurrentStore =
      orderStore.isStoreActive(storeId) &&
      paymentStore.isStoreActive(storeId) &&
      productStore.isStoreActive(storeId) &&
      locationStore.isStoreActive(storeId) &&
      marketStore.isStoreActive(storeId) &&
      customerStore.isStoreActive(storeId) &&
      commerceOpsStore.isStoreActive(storeId) &&
      profileStore.isStoreActive(storeId) &&
      trafficStore.isStoreActive(storeId);

    if (!isCurrentStore) hydrateStoreData(storeId);
  }

  function getToken(storeId: string) {
    const data = credentialVault.getStoreData(storeId);
    const state = getStoreTokenState(data);
    if (state === "missing") {
      return { token: "", error: MISSING_TOKEN_MESSAGE };
    }
    if (state === "expired") {
      return { token: "", error: EXPIRED_TOKEN_MESSAGE };
    }
    return { token: resolveStoreAccessToken(data), error: "" };
  }

  function setTabError(tab: StoreTab, message: string | null) {
    if (["transactions", "payouts", "disputes"].includes(tab)) {
      paymentStore.error = message;
    } else if (tab === "orders") {
      orderStore.error = message;
    } else if (tab === "products") {
      productStore.error = message;
    } else if (tab === "customers") {
      customerStore.error = message;
    } else if (tab === "operations") {
      commerceOpsStore.mutationError = message;
    } else if (tab === "markets") {
      marketStore.error = message;
    } else if (tab === "traffic") {
      trafficStore.error = message;
    } else {
      profileStore.error = message;
    }
  }

  async function loadStoreTabData(
    tab: StoreTab,
    storeId = formStore.storeId,
    force = false,
  ): Promise<boolean> {
    if (!storeId) return false;

    ensureStoreScope(storeId);
    const resources = TAB_RESOURCES[tab];
    const hadPaymentError = Boolean(paymentStore.error);
    const hadOrderError = Boolean(orderStore.error);
    const hadProductError = Boolean(productStore.error);
    const hadCustomerError = Boolean(customerStore.error);
    const hadMarketError = Boolean(marketStore.error);
    const hadProfileError = Boolean(profileStore.error);
    const hadTrafficError = Boolean(trafficStore.error);
    if (!force) clearExpiredResources(storeId, resources);

    const { token, error: tokenError } = getToken(storeId);
    if (!token) {
      setTabError(tab, tokenError);
      return false;
    }

    setTabError(tab, null);

    if (tab === "transactions") {
      const paymentForce =
        force || hadPaymentError || isResourceExpired(storeId, "paymentTransactions");
      if (
        paymentForce ||
        !paymentStore.hasFetchedBalanceTransactions ||
        !paymentStore.isShowingDefaultTransactions
      ) {
        await paymentStore.fetchGraphqlBalanceTransactions(
          storeId,
          token,
          {},
          { force: paymentForce },
        );
      }
      if (!paymentStore.error) markResourceLoaded(storeId, "paymentTransactions");
      return !paymentStore.error;
    }

    if (tab === "payouts") {
      const accountForce = force || isResourceExpired(storeId, "paymentAccount");
      const payoutForce =
        force || hadPaymentError || isResourceExpired(storeId, "paymentPayouts");
      const requests: Promise<unknown>[] = [];
      if (accountForce || !paymentStore.hasFetchedAccount) {
        requests.push(paymentStore.fetchPaymentsAccount(storeId, token, accountForce));
      }
      if (
        payoutForce ||
        !paymentStore.hasFetchedPayouts ||
        !paymentStore.isShowingDefaultPayouts
      ) {
        requests.push(
          paymentStore.fetchPayouts(storeId, token, {}, { force: payoutForce }),
        );
      }
      await Promise.all(requests);
      if (paymentStore.hasFetchedAccount) {
        markResourceLoaded(storeId, "paymentAccount");
      }
      if (!paymentStore.error && paymentStore.hasFetchedPayouts) {
        markResourceLoaded(storeId, "paymentPayouts");
      }
      return !paymentStore.error;
    }

    if (tab === "disputes") {
      const disputeForce =
        force || hadPaymentError || isResourceExpired(storeId, "disputes");
      if (
        disputeForce ||
        !paymentStore.hasFetchedDisputes ||
        !paymentStore.isShowingDefaultDisputes
      ) {
        await paymentStore.fetchDisputes(storeId, token, {}, { force: disputeForce });
      }
      if (!paymentStore.error) markResourceLoaded(storeId, "disputes");
      return !paymentStore.error;
    }

    if (tab === "orders") {
      const requests: Promise<unknown>[] = [];
      const orderForce = force || hadOrderError || isResourceExpired(storeId, "orders");
      const paymentForce =
        force || hadPaymentError || isResourceExpired(storeId, "paymentTransactions");
      if (orderForce || !orderStore.hasFetchedAll) {
        requests.push(orderStore.fetchAll(storeId, token, orderForce));
      }
      if (
        paymentForce ||
        !paymentStore.hasFetchedBalanceTransactions ||
        !paymentStore.isShowingDefaultTransactions
      ) {
        requests.push(
          paymentStore.fetchBalanceTransactions(storeId, token, paymentForce),
        );
      }
      await Promise.all(requests);
      if (!orderStore.error) markResourceLoaded(storeId, "orders");
      if (!paymentStore.error) markResourceLoaded(storeId, "paymentTransactions");
      return !orderStore.error;
    }

    if (tab === "products") {
      const productForce =
        force || hadProductError || isResourceExpired(storeId, "products");
      if (productForce || !productStore.hasFetchedAll) {
        await productStore.fetchAll(storeId, token);
      }
      if (!productStore.error) markResourceLoaded(storeId, "products");
      if (!locationStore.error && locationStore.hasFetchedAll) {
        markResourceLoaded(storeId, "locations");
      }
      return !productStore.error;
    }

    if (tab === "customers") {
      const customerForce =
        force || hadCustomerError || isResourceExpired(storeId, "customers");
      if (customerForce || !customerStore.hasFetchedAll) {
        await customerStore.fetchAll(storeId, token, customerStore.activeQuery);
      }
      if (!customerStore.error) markResourceLoaded(storeId, "customers");
      return !customerStore.error;
    }

    if (tab === "markets") {
      const marketForce =
        force || hadMarketError || isResourceExpired(storeId, "markets");
      if (marketForce || !marketStore.hasFetchedAll) {
        await marketStore.fetchAll(storeId, token, marketForce);
      }
      if (!marketStore.error) markResourceLoaded(storeId, "markets");
      return !marketStore.error;
    }

    if (tab === "traffic") {
      const trafficForce =
        force || hadTrafficError || isResourceExpired(storeId, "traffic");
      if (trafficForce || !trafficStore.hasFetched) {
        await trafficStore.fetchTraffic(storeId, token, trafficForce);
      }
      if (!trafficStore.error) markResourceLoaded(storeId, "traffic");
      return !trafficStore.error;
    }

    if (tab === "operations") {
      const operationsForce = force || isResourceExpired(storeId, "commerceOps");
      if (operationsForce || !commerceOpsStore.hasLoaded) {
        await commerceOpsStore.loadAll(storeId, token, operationsForce);
      }
      if (commerceOpsStore.availableResourceCount > 0) {
        markResourceLoaded(storeId, "commerceOps");
      }
      return commerceOpsStore.availableResourceCount > 0;
    }

    const requests: Promise<unknown>[] = [];
    const profileForce =
      force || hadProfileError || isResourceExpired(storeId, "profile");
    const accountForce = force || isResourceExpired(storeId, "paymentAccount");
    const payoutForce =
      force || hadPaymentError || isResourceExpired(storeId, "paymentPayouts");
    const transactionForce =
      force || hadPaymentError || isResourceExpired(storeId, "paymentTransactions");
    const orderForce = force || hadOrderError || isResourceExpired(storeId, "orders");
    if (profileForce || !profileStore.hasFetchedProfile) {
      requests.push(profileStore.fetchProfile(storeId, token));
    }
    if (accountForce || !paymentStore.hasFetchedAccount) {
      requests.push(paymentStore.fetchPaymentsAccount(storeId, token, accountForce));
    }
    if (
      payoutForce ||
      !paymentStore.hasFetchedPayouts ||
      !paymentStore.isShowingDefaultPayouts
    ) {
      requests.push(
        paymentStore.fetchPayouts(storeId, token, {}, { force: payoutForce }),
      );
    }
    if (
      transactionForce ||
      !paymentStore.hasFetchedBalanceTransactions ||
      !paymentStore.isShowingDefaultTransactions
    ) {
      requests.push(
        paymentStore.fetchGraphqlBalanceTransactions(
          storeId,
          token,
          {},
          { force: transactionForce },
        ),
      );
    }
    if (orderForce || !orderStore.hasFetchedAll || orderStore.error) {
      requests.push(orderStore.fetchAll(storeId, token, orderForce));
    }
    await Promise.all(requests);
    if (!profileStore.error) markResourceLoaded(storeId, "profile");
    if (paymentStore.hasFetchedAccount) markResourceLoaded(storeId, "paymentAccount");
    if (!paymentStore.error && paymentStore.hasFetchedPayouts) {
      markResourceLoaded(storeId, "paymentPayouts");
    }
    if (!paymentStore.error && paymentStore.hasFetchedBalanceTransactions) {
      markResourceLoaded(storeId, "paymentTransactions");
    }
    if (!orderStore.error) markResourceLoaded(storeId, "orders");
    return !profileStore.error;
  }

  return {
    hydrateStoreData,
    loadStoreTabData,
  };
}
