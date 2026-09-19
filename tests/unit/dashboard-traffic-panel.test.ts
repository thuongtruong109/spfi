import { shallowMount } from "@vue/test-utils";
import { computed, ref, watch } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardTrafficPanel from "~/components/dashboard/DashboardTrafficPanel.vue";
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

    expect(wrapper.text()).toContain("dashboard.trafficQueryFailed");
    expect(wrapper.find(".traffic-metric-grid strong").text()).toBe("—");
  });

  it("distinguishes a fully failed query from genuinely unavailable traffic", () => {
    installNuxtImports();
    const traffic = emptyDashboardTraffic();
    traffic.availability.today = "failed";

    const wrapper = mountPanel(traffic);

    expect(wrapper.text()).toContain("dashboard.trafficQueryFailed");
    expect(wrapper.text()).not.toContain("dashboard.trafficPermissionHint");
  });
});

function installNuxtImports() {
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("useLocalization", () => ({
    locale: ref("en-US"),
    t: (key: string) => key,
  }));
}

function mountPanel(traffic: ReturnType<typeof emptyDashboardTraffic>) {
  return shallowMount(DashboardTrafficPanel, {
    props: { traffic, storeCount: 1 },
    global: {
      stubs: {
        DashboardTrafficControls: true,
        DashboardTrafficChart: true,
        DashboardDonutChart: true,
        DashboardTrafficInsights: true,
      },
    },
  });
}
