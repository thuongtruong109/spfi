import { flushPromises, mount } from "@vue/test-utils";
import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  reactive,
  ref,
  watch,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TrafficTab from "~/components/store/TrafficTab.vue";
import { emptyDashboardTraffic } from "~~/utils/dashboard-traffic";

const mocks = vi.hoisted(() => ({
  trafficStore: null as unknown as Record<string, unknown>,
  auth: null as unknown as { storeId: unknown; token: unknown },
}));

vi.mock("~/stores/traffic", () => ({
  useTrafficStore: () => mocks.trafficStore,
}));

vi.mock("~/composables/useActiveShopAuth", () => ({
  useActiveShopAuth: () => mocks.auth,
}));

const DashboardTrafficPanelStub = defineComponent({
  name: "DashboardTrafficPanel",
  emits: ["rangeChange"],
  template: '<div><slot name="controls-prefix" /></div>',
});

const StoreTrafficLoadModeSelectStub = defineComponent({
  name: "StoreTrafficLoadModeSelect",
  props: {
    modelValue: { type: String, required: true },
    loading: Boolean,
  },
  emits: ["update:modelValue"],
  template:
    "<button type=\"button\" @click=\"$emit('update:modelValue', 'full')\">{{ modelValue }}</button>",
});

describe("Store TrafficTab loading mode", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("onBeforeUnmount", onBeforeUnmount);

    mocks.auth = {
      storeId: ref("shop-a"),
      token: ref("token-a"),
    };
    const traffic = emptyDashboardTraffic();
    traffic.available = true;
    mocks.trafficStore = reactive({
      traffic,
      hasFetched: true,
      isLoading: false,
      isLoadingAllInsights: false,
      activeFullInsightRange: null,
      isLoadingRange: false,
      activeRangeSummary: null,
      trafficInsightProgress: {
        "24h": { loaded: 0, total: 21, percent: 0, complete: false },
        "7d": { loaded: 0, total: 21, percent: 0, complete: false },
        "30d": { loaded: 0, total: 21, percent: 0, complete: false },
        "60d": { loaded: 0, total: 21, percent: 0, complete: false },
        "90d": { loaded: 0, total: 21, percent: 0, complete: false },
        "6m": { loaded: 0, total: 21, percent: 0, complete: false },
        "1y": { loaded: 0, total: 21, percent: 0, complete: false },
      },
      loadingInsightDimensions: [],
      error: null,
      insightError: null,
      isStoreActive: vi.fn(() => true),
      fetchTrafficRange: vi.fn().mockResolvedValue(true),
      fetchTrafficRangeDimensions: vi.fn().mockResolvedValue(true),
      fetchTrafficDimension: vi.fn().mockResolvedValue(true),
      cancelTrafficDimensionRequests: vi.fn(),
    });
  });

  it("starts in Lazy mode and loads the selected range only when Full is selected", async () => {
    const wrapper = mount(TrafficTab, {
      global: {
        stubs: {
          DashboardTrafficPanel: DashboardTrafficPanelStub,
          StoreTrafficLoadModeSelect: StoreTrafficLoadModeSelectStub,
        },
      },
    });
    await nextTick();

    expect(wrapper.get("button").text()).toBe("lazy");
    expect(
      mocks.trafficStore.fetchTrafficRangeDimensions as ReturnType<typeof vi.fn>,
    ).not.toHaveBeenCalled();
    expect(
      mocks.trafficStore.cancelTrafficDimensionRequests as ReturnType<typeof vi.fn>,
    ).toHaveBeenCalledOnce();

    wrapper.findComponent(DashboardTrafficPanelStub).vm.$emit("rangeChange", "7d");
    await nextTick();
    expect(
      mocks.trafficStore.fetchTrafficRangeDimensions as ReturnType<typeof vi.fn>,
    ).not.toHaveBeenCalled();

    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(
      mocks.trafficStore.fetchTrafficRangeDimensions as ReturnType<typeof vi.fn>,
    ).toHaveBeenCalledWith("shop-a", "token-a", "7d");

    wrapper.unmount();
    expect(
      mocks.trafficStore.cancelTrafficDimensionRequests as ReturnType<typeof vi.fn>,
    ).toHaveBeenCalledTimes(3);
  });

  it("loads a long-range summary on demand without starting full details", async () => {
    const wrapper = mount(TrafficTab, {
      global: {
        stubs: {
          DashboardTrafficPanel: DashboardTrafficPanelStub,
          StoreTrafficLoadModeSelect: StoreTrafficLoadModeSelectStub,
        },
      },
    });
    await flushPromises();

    wrapper.findComponent(DashboardTrafficPanelStub).vm.$emit("rangeChange", "90d");
    await flushPromises();

    expect(
      mocks.trafficStore.fetchTrafficRange as ReturnType<typeof vi.fn>,
    ).toHaveBeenLastCalledWith("shop-a", "token-a", "90d");
    expect(
      mocks.trafficStore.fetchTrafficRangeDimensions as ReturnType<typeof vi.fn>,
    ).not.toHaveBeenCalled();
  });
});
