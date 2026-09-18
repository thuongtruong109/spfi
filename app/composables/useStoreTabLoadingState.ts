import type { ComputedRef } from "vue";
import { computed } from "vue";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import { useCustomerStore } from "~/stores/customers";
import { useMarketStore } from "~/stores/market";
import { useOrderStore } from "~/stores/order";
import { usePaymentStore } from "~/stores/payment";
import { useProductStore } from "~/stores/product";
import { useShopProfileStore } from "~/stores/shopProfile";
import { useTrafficStore } from "~/stores/traffic";
import type { StoreTab } from "~~/types/store";

export function useStoreTabLoadingState(activeTab: ComputedRef<StoreTab>) {
  const commerceOpsStore = useCommerceOpsStore();
  const customerStore = useCustomerStore();
  const marketStore = useMarketStore();
  const orderStore = useOrderStore();
  const paymentStore = usePaymentStore();
  const productStore = useProductStore();
  const profileStore = useShopProfileStore();
  const trafficStore = useTrafficStore();

  const hasData = computed(() => {
    switch (activeTab.value) {
      case "transactions":
        return (
          paymentStore.hasFetchedBalanceTransactions ||
          paymentStore.balanceTransactions.length > 0
        );
      case "payouts":
        return (
          paymentStore.hasFetchedPayouts ||
          paymentStore.payouts.length > 0 ||
          paymentStore.balance !== null
        );
      case "disputes":
        return paymentStore.hasFetchedDisputes;
      case "orders":
        return orderStore.hasFetchedAll || orderStore.orders.length > 0;
      case "products":
        return productStore.hasFetchedAll || productStore.products.length > 0;
      case "customers":
        return customerStore.hasFetchedAll || customerStore.customers.length > 0;
      case "markets":
        return marketStore.hasFetchedAll || marketStore.markets.length > 0;
      case "traffic":
        return trafficStore.hasFetched;
      case "operations":
        return commerceOpsStore.hasLoaded;
      case "profile":
        return profileStore.hasFetchedProfile;
    }
  });

  const isLoading = computed(() => {
    switch (activeTab.value) {
      case "transactions":
        return paymentStore.isLoadingTransactions;
      case "payouts":
        return paymentStore.isLoadingAccount || paymentStore.isLoadingPayouts;
      case "disputes":
        return paymentStore.isLoadingDisputes;
      case "orders":
        return orderStore.isLoading;
      case "products":
        return productStore.isLoading;
      case "customers":
        return customerStore.isLoading;
      case "markets":
        return marketStore.isLoading;
      case "traffic":
        return trafficStore.isLoading;
      case "operations":
        return commerceOpsStore.isLoading;
      case "profile":
        return profileStore.isLoading || paymentStore.isLoading || orderStore.isLoading;
    }
  });

  return { hasData, isLoading };
}
