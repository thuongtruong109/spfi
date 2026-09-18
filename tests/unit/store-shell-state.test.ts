import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { computed, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BaseButton from "~/components/BaseButton.vue";
import StoreAddModeToggle from "~/components/store/AddModeToggle.vue";
import { useStoreTabLoadingState } from "~/composables/useStoreTabLoadingState";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import { useCustomerStore } from "~/stores/customers";
import { useMarketStore } from "~/stores/market";
import { useOrderStore } from "~/stores/order";
import { usePaymentStore } from "~/stores/payment";
import { useProductStore } from "~/stores/product";
import { useShopProfileStore } from "~/stores/shopProfile";
import { useTrafficStore } from "~/stores/traffic";
import type { StoreTab } from "~~/types/store";

describe("store shell UI state", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal("useLocalization", () => ({
      t: (key: string) =>
        ({
          "store.addMode": "Add mode",
          "store.single": "Single",
          "store.bulk": "Bulk",
        })[key] || key,
    }));
  });

  it("uses one accessible mode selector for both add-store entry points", async () => {
    const wrapper = mount(StoreAddModeToggle, {
      props: { modelValue: "single" },
      global: {
        components: { BaseButton },
        stubs: { IconsCheck: true, IconsBulking: true },
      },
    });

    const buttons = wrapper.findAll("button");
    expect(wrapper.get('[role="group"]').attributes("aria-label")).toBe("Add mode");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.attributes("aria-pressed")).toBe("true");
    expect(buttons[1]?.attributes("aria-pressed")).toBe("false");

    await buttons[1]?.trigger("click");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["bulking"]);
  });

  it("treats an empty fetched result as loaded for every store tab", () => {
    const tab = ref<StoreTab>("transactions");
    const state = useStoreTabLoadingState(computed(() => tab.value));
    const payment = usePaymentStore();
    const orders = useOrderStore();
    const products = useProductStore();
    const customers = useCustomerStore();
    const markets = useMarketStore();
    const traffic = useTrafficStore();
    const operations = useCommerceOpsStore();
    const profile = useShopProfileStore();

    const loadedStates: Array<[StoreTab, () => void]> = [
      ["transactions", () => (payment.hasFetchedBalanceTransactions = true)],
      ["payouts", () => (payment.hasFetchedPayouts = true)],
      ["disputes", () => (payment.hasFetchedDisputes = true)],
      ["orders", () => (orders.hasFetchedAll = true)],
      ["products", () => (products.hasFetchedAll = true)],
      ["customers", () => (customers.hasFetchedAll = true)],
      ["markets", () => (markets.hasFetchedAll = true)],
      ["traffic", () => (traffic.hasFetched = true)],
      ["operations", () => (operations.hasLoaded = true)],
      ["profile", () => (profile.hasFetchedProfile = true)],
    ];

    for (const [activeTab, markLoaded] of loadedStates) {
      tab.value = activeTab;
      expect(state.hasData.value).toBe(false);
      markLoaded();
      expect(state.hasData.value).toBe(true);
    }
  });

  it("exposes the active tab loading flag to the shared loading screen", () => {
    const tab = ref<StoreTab>("products");
    const state = useStoreTabLoadingState(computed(() => tab.value));
    const products = useProductStore();
    const payment = usePaymentStore();

    products.isLoading = true;
    expect(state.isLoading.value).toBe(true);

    tab.value = "payouts";
    expect(state.isLoading.value).toBe(false);
    payment.isLoadingAccount = true;
    expect(state.isLoading.value).toBe(true);
  });
});
