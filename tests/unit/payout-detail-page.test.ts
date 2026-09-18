import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick, ref } from "vue";
import { createMemoryHistory, createRouter, RouterLink } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PayoutDetailPage from "~/pages/store/payout/[id].vue";
import PayoutsTab from "~/components/payment/PayoutsTab.vue";
import { usePaymentStore } from "~/stores/payment";
import type { ShopifyBalanceTransaction, ShopifyPayout } from "~~/types/shopify";

const auth = { storeId: ref("shop-a"), token: ref("token"), isReady: ref(true) };
vi.mock("~/composables/useActiveShopAuth", () => ({ useActiveShopAuth: () => auth }));
vi.mock("~/composables/useLocalization", () => ({
  useLocalization: () => ({ locale: ref("en"), t: (key: string) => key }),
}));
vi.mock("~/composables/useShopifyPaymentLabel", () => ({
  useShopifyPaymentLabel: () => ({ formatPaymentLabel: (value: string) => value }),
}));
vi.mock("~/composables/useStoreFeedback", () => ({ useStoreFeedback: () => ({}) }));

function payout(id: string, amount = "42.00"): ShopifyPayout {
  return {
    id,
    amount,
    status: "paid",
    date: "2026-09-17",
    currency: "USD",
    summary: {
      adjustments_fee_amount: "0",
      adjustments_gross_amount: "0",
      charges_fee_amount: "0",
      charges_gross_amount: amount,
      refunds_fee_amount: "0",
      refunds_gross_amount: "0",
      reserved_funds_fee_amount: "0",
      reserved_funds_gross_amount: "0",
      retried_payouts_fee_amount: "0",
      retried_payouts_gross_amount: "0",
    },
  };
}

function transactions(payoutId: string, count: number): ShopifyBalanceTransaction[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${payoutId}${index}`,
    type: "charge",
    test: false,
    payout_id: payoutId,
    payout_status: "paid",
    currency: "USD",
    amount: "10.00",
    fee: "1.00",
    net: "9.00",
    source_id: null,
    source_type: null,
    source_order_id: index + 1,
    source_order_transaction_id: null,
    processed_at: "2026-09-17T00:00:00Z",
    adjustment_order_transactions: [],
    adjustment_reason: null,
  }));
}

const PaginationStub = {
  props: ["page", "totalItems"],
  emits: ["update:page", "update:pageSize"],
  template:
    '<nav><button class="next" @click="$emit(\'update:page\', page + 1)">Next</button><span class="page-number">{{ page }}</span></nav>',
};

async function setup(component = PayoutDetailPage) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/store/payout/:id", component: { template: "<div />" } },
      { path: "/:pathMatch(.*)*", component: { template: "<div />" } },
    ],
  });
  await router.push("/store/payout/123?shop=shop-a&tab=payouts");
  await router.isReady();
  vi.stubGlobal("useRoute", () => router.currentRoute.value);
  const store = usePaymentStore();
  for (const [id, amount] of [
    ["123", "42.00"],
    ["456", "84.00"],
  ]) {
    store.payoutDetails[id!] = payout(id!, amount);
    store.payoutDetailStates[id!] = {
      status: "success",
      detailError: null,
      metadataError: null,
      transactionsError: null,
    };
    store.transactionsByPayout[id!] = transactions(id!, 100);
  }
  store.visiblePayouts = [payout("123")];

  const wrapper = mount(component, {
    attachTo: document.body,
    global: {
      plugins: [pinia, router],
      stubs: {
        NuxtLayout: {
          template: '<div><header><slot name="title" /></header><slot /></div>',
        },
        NuxtLink: RouterLink,
        CsvExportButton: true,
        PayoutDataIssue: true,
        PaginationControls: PaginationStub,
        PaymentAccountSummary: true,
        PaymentFilterPanel: true,
        BaseSelect: true,
        BaseButton: true,
      },
    },
  });
  return { wrapper, router, store };
}

describe("payout navigation", () => {
  beforeEach(() => {
    auth.storeId.value = "shop-a";
    vi.stubGlobal("definePageMeta", vi.fn());
    vi.stubGlobal("useShopifyPaymentLabel", () => ({
      formatPaymentLabel: (value: string) => value,
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("updates a reused page and resets pagination when the payout or shop changes", async () => {
    const { wrapper, router } = await setup();
    expect(wrapper.get(".overview-amount").text()).toBe("$42.00");
    await wrapper.get(".next").trigger("click");
    expect(wrapper.get(".page-number").text()).toBe("2");

    await router.push("/store/payout/456?shop=shop-a&tab=payouts");
    await nextTick();
    expect(wrapper.get(".overview-amount").text()).toBe("$84.00");
    expect(wrapper.get(".page-number").text()).toBe("1");

    await wrapper.get(".next").trigger("click");
    auth.storeId.value = "shop-b";
    await nextTick();
    expect(wrapper.get(".page-number").text()).toBe("1");
    expect(wrapper.get(".breadcrumb-back").attributes("aria-label")).toBe(
      "payment.payouts",
    );
    expect(wrapper.get("[role=region]").attributes("tabindex")).toBe("0");
    wrapper.unmount();
  });

  it.each(["payout", "shop", "filter", "page-size"])(
    "ignores pagination completion after changing the %s",
    async (change) => {
      const { wrapper, router, store } = await setup();
      store.transactionsByPayout["123"] = transactions("123", 50);
      store.payoutDetailPageInfo["123"] = {
        hasNextPage: true,
        hasPreviousPage: false,
        nextCursor: "next",
        previousCursor: null,
      };
      let resolve!: () => void;
      vi.spyOn(store, "fetchMorePayoutTransactions").mockImplementation(
        () =>
          new Promise<void>((done) => {
            resolve = () => {
              store.transactionsByPayout["123"] = transactions("123", 100);
              done();
            };
          }),
      );
      await nextTick();
      await wrapper.get(".next").trigger("click");

      if (change === "payout") await router.push("/store/payout/456?shop=shop-a");
      if (change === "shop") auth.storeId.value = "shop-b";
      if (change === "filter")
        await wrapper.get(".tab-btn:last-child").trigger("click");
      if (change === "page-size")
        wrapper.findComponent(PaginationStub).vm.$emit("update:pageSize", 20);
      await nextTick();
      resolve();
      await flushPromises();

      expect(wrapper.get(".page-number").text()).toBe("1");
      wrapper.unmount();
    },
  );

  it("uses a focusable payout link with the shop query and preserves native modified clicks", async () => {
    const { wrapper, router } = await setup(PayoutsTab);
    const link = wrapper.get<HTMLAnchorElement>(".payout-link");
    expect(link.attributes("href")).toBe("/store/payout/123?shop=shop-a&tab=payouts");
    expect(link.attributes("aria-label")).toContain("#123");
    link.element.focus();
    expect(document.activeElement).toBe(link.element);
    const push = vi.spyOn(router, "push");
    await link.trigger("click", { ctrlKey: true });
    expect(push).not.toHaveBeenCalled();
    await link.trigger("click");
    expect(push).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});
