import { shallowMount } from "@vue/test-utils";
import { computed, defineComponent, nextTick, ref, watch } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardTrafficPanel from "~/components/dashboard/DashboardTrafficPanel.vue";
import DashboardTrafficReportingStatus from "~/components/dashboard/DashboardTrafficReportingStatus.vue";
import {
  createTrafficMetrics,
  emptyDashboardTraffic,
} from "~~/utils/dashboard-traffic";

describe("DashboardTrafficPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders metrics when a partial traffic response is marked available", () => {
    installNuxtImports();
    const traffic = emptyDashboardTraffic();
    traffic.available = true;
    traffic.availableStores = 1;
    traffic.today = createTrafficMetrics({ sessions: 9, visitors: 7 });
    traffic.last24Hours = traffic.today;
    traffic.rangeData["24h"].metrics = traffic.today;

    const wrapper = mountPanel(traffic);

    expect(wrapper.text()).toContain("dashboard.trafficMetricSessions");
    expect(wrapper.text()).toContain("9");
    expect(wrapper.text()).not.toContain("dashboard.trafficUnavailable");
    const firstMetric = wrapper.get(".traffic-metric-grid > div");
    expect(firstMetric.element.firstElementChild?.tagName).toBe("SPAN");
    expect(firstMetric.element.lastElementChild?.tagName).toBe("SMALL");
    expect(firstMetric.find("small").text()).toBe("dashboard.trafficRange24h");
    expect(wrapper.text()).toContain("dashboard.trafficUniqueShopify");
    expect(wrapper.text()).toContain("dashboard.trafficViewsPerSession");
    expect(wrapper.text()).toContain("dashboard.trafficBouncesDetail");
    expect(wrapper.text()).toContain("dashboard.trafficConversionsDetail");
  });

  it("shows unavailable only when no summary alias was usable", () => {
    installNuxtImports();
    const wrapper = mountPanel(emptyDashboardTraffic());

    expect(wrapper.text()).toContain("dashboard.trafficUnavailable");
  });

  it("does not present a failed metrics alias as zero traffic", () => {
    installNuxtImports();
    const traffic = emptyDashboardTraffic();
    traffic.available = true;
    traffic.availableStores = 1;
    traffic.last24Hours = createTrafficMetrics({ sessions: 9 });
    traffic.rangeData["24h"].metrics = traffic.last24Hours;
    traffic.availability.last24Hours = "failed";
    traffic.rangeData["24h"].availability.metrics = "failed";

    const wrapper = mountPanel(traffic);

    expect(wrapper.text()).toContain("dashboard.trafficMetricsQueryFailed");
    expect(wrapper.find(".traffic-metric-grid strong").text()).toBe("—");
  });

  it("identifies the failed breakdown and selected range", () => {
    installNuxtImports();
    const traffic = emptyDashboardTraffic();
    traffic.available = true;
    traffic.rangeData["24h"].metrics = createTrafficMetrics({ sessions: 5 });
    traffic.rangeData["24h"].availability.metrics = "available";
    traffic.rangeData["24h"].availability.sources = "failed";

    const wrapper = mountPanel(traffic);

    expect(wrapper.text()).toContain("dashboard.trafficBreakdownQueryFailed");
  });

  it("distinguishes a fully failed query from genuinely unavailable traffic", () => {
    installNuxtImports();
    const traffic = emptyDashboardTraffic();
    traffic.availability.today = "failed";

    const wrapper = mountPanel(traffic);

    expect(wrapper.text()).toContain("dashboard.trafficQueryFailed");
    expect(wrapper.text()).not.toContain("dashboard.trafficPermissionHint");
  });

  it("renders the load mode and horizontal controls in the reporting bar", () => {
    installNuxtImports();
    const traffic = emptyDashboardTraffic();
    traffic.available = true;
    traffic.availableStores = 1;
    traffic.rangeData["24h"].metrics = createTrafficMetrics({ sessions: 5 });

    const wrapper = shallowMount(DashboardTrafficPanel, {
      props: { traffic, storeCount: 1 },
      slots: {
        "controls-prefix": '<div class="test-load-mode">Full</div>',
      },
      global: {
        stubs: {
          DashboardTrafficReportingStatus: {
            template:
              '<div class="traffic-reporting-bar"><slot name="actions" /></div>',
          },
          DashboardTrafficControls: {
            template: '<aside class="traffic-controls">Controls</aside>',
          },
          DashboardTrafficChart: true,
          DashboardDonutChart: true,
          DashboardTrafficInsights: true,
        },
      },
    });

    const toolbar = wrapper.get(".traffic-reporting-bar > .traffic-toolbar-actions");
    expect(toolbar.find(".test-load-mode").exists()).toBe(true);
    expect(toolbar.find(".traffic-controls").exists()).toBe(true);
  });

  it("keeps range controls usable while the selected range shows progress", async () => {
    installNuxtImports();
    const traffic = emptyDashboardTraffic();
    traffic.available = true;
    traffic.availableStores = 1;
    traffic.rangeData["24h"].metrics = createTrafficMetrics({ sessions: 5 });
    const ControlsStub = defineComponent({
      name: "DashboardTrafficControls",
      props: { modelValue: String },
      emits: ["update:modelValue"],
      template:
        "<button class=\"test-range-control\" @click=\"$emit('update:modelValue', '7d')\">Range</button>",
    });

    const wrapper = shallowMount(DashboardTrafficPanel, {
      props: {
        traffic,
        storeCount: 1,
        fullLoading: true,
        fullLoadProgress: {
          loaded: 7,
          total: 21,
          percent: 33,
          complete: false,
        },
      },
      global: {
        stubs: {
          DashboardTrafficReportingStatus: {
            template:
              '<div class="traffic-reporting-bar"><slot name="actions" /></div>',
          },
          DashboardTrafficControls: ControlsStub,
          DashboardTrafficLoadingOverlay: {
            props: ["progress"],
            template:
              '<div class="test-loading-overlay">{{ progress.loaded }}/{{ progress.total }}</div>',
          },
          DashboardTrafficChart: true,
          DashboardDonutChart: true,
          DashboardTrafficInsights: true,
        },
      },
    });

    expect(wrapper.get(".traffic-data-content").classes()).toContain("is-loading");
    expect(wrapper.get(".test-loading-overlay").text()).toBe("7/21");

    await wrapper.get(".test-range-control").trigger("click");
    await nextTick();
    expect(wrapper.emitted("rangeChange")?.at(-1)).toEqual(["7d"]);
  });

  it("shows store reporting, freshness, failures, and selected-range coverage", () => {
    installNuxtImports();
    const traffic = emptyDashboardTraffic();
    traffic.available = true;
    traffic.availableStores = 7;
    traffic.last24Hours = createTrafficMetrics({ sessions: 70 });
    traffic.rangeData["24h"].metrics = traffic.last24Hours;
    traffic.rangeData["24h"].sources = [];
    traffic.rangeData["24h"].countries = [];
    traffic.rangeData["24h"].devices = [];
    traffic.reporting = {
      totalStores: 10,
      reportingStores: 7,
      lastSuccessfulAt: "2026-09-20T09:00:00.000Z",
      stores: [
        {
          storeId: "partial",
          label: "Partial Store",
          status: "partial",
          lastSuccessfulAt: "2026-09-20T09:00:00.000Z",
          issues: [{ range: "24h", block: "sources", state: "failed" }],
          message: null,
        },
        {
          storeId: "failed",
          label: "Failed Store",
          status: "failed",
          lastSuccessfulAt: null,
          issues: [],
          message: "Missing read_reports.",
        },
      ],
      coverage: {
        "24h": coverage(10, {
          metrics: 7,
          trend: 7,
          sources: 6,
          countries: 7,
          devices: 5,
        }),
        "7d": coverage(10),
        "30d": coverage(10),
      },
    };

    const statusProps = {
      traffic,
      storeCount: 10,
      range: "24h" as const,
      rangeLabel: "dashboard.trafficRange24h",
    };
    const status = shallowMount(DashboardTrafficReportingStatus, {
      props: { ...statusProps, loading: true },
    });
    const wrapper = mountPanel(traffic, { storeCount: 10, loading: true });

    expect(status.text()).toContain(
      'dashboard.trafficStoresReporting:{"available":7,"total":10}',
    );
    expect(status.text()).toContain("dashboard.trafficDataStale");
    expect(status.text()).toContain("dashboard.trafficLastSuccessfulAt");
    expect(status.text()).toContain("dashboard.trafficStoreIssues");
    expect(status.text()).toContain("Partial Store");
    expect(status.text()).toContain("Failed Store");
    expect(status.text()).toContain("dashboard.trafficPartialBlocks");
    expect(wrapper.findAll(".traffic-breakdown-coverage span")).toHaveLength(3);

    const freshStatus = shallowMount(DashboardTrafficReportingStatus, {
      props: { ...statusProps, loading: false },
      slots: { actions: '<button class="test-actions">Actions</button>' },
    });
    expect(freshStatus.text()).toContain("dashboard.trafficDataFresh");
    expect(freshStatus.text()).not.toContain("dashboard.trafficDataStale");
    expect(freshStatus.find(".traffic-reporting-bar > .test-actions").exists()).toBe(
      true,
    );

    traffic.isStale = true;
    const cachedStatus = shallowMount(DashboardTrafficReportingStatus, {
      props: { ...statusProps, loading: false },
    });
    expect(cachedStatus.text()).toContain("dashboard.trafficDataStale");
  });
});

function installNuxtImports() {
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("useLocalization", () => ({
    locale: ref("en-US"),
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }));
}

function mountPanel(
  traffic: ReturnType<typeof emptyDashboardTraffic>,
  props: { storeCount?: number; loading?: boolean } = {},
) {
  return shallowMount(DashboardTrafficPanel, {
    props: {
      traffic,
      storeCount: props.storeCount || 1,
      loading: props.loading,
    },
    global: {
      stubs: {
        DashboardTrafficControls: true,
        DashboardTrafficChart: true,
        DashboardDonutChart: true,
        DashboardTrafficInsights: true,
        DashboardTrafficReportingStatus: true,
      },
    },
  });
}

function coverage(
  totalStores: number,
  reporting: Partial<
    Record<"metrics" | "trend" | "sources" | "countries" | "devices", number>
  > = {},
) {
  return {
    metrics: { reportingStores: reporting.metrics || 0, totalStores },
    trend: { reportingStores: reporting.trend || 0, totalStores },
    sources: { reportingStores: reporting.sources || 0, totalStores },
    countries: { reportingStores: reporting.countries || 0, totalStores },
    devices: { reportingStores: reporting.devices || 0, totalStores },
  };
}
