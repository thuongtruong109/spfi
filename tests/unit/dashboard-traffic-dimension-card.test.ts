import { shallowMount } from "@vue/test-utils";
import { computed, defineComponent, nextTick, ref, watch } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardTrafficDimensionCard from "~/components/dashboard/DashboardTrafficDimensionCard.vue";

describe("DashboardTrafficDimensionCard", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests only the active dimension and requests a newly selected tab", async () => {
    installNuxtImports();
    const wrapper = shallowMount(DashboardTrafficDimensionCard, {
      props: {
        icon: defineComponent({ template: "<svg />" }),
        title: "Acquisition",
        subtitle: "Traffic acquisition",
        dimensions: {},
        options: [
          { key: "source", label: "Source" },
          { key: "campaign", label: "Campaign" },
        ],
        range: "24h",
        rangeLabel: "Last 24 hours",
        loadingDimensions: ["24h:source"],
      },
      global: { stubs: { DashboardDonutChart: true } },
    });

    expect(wrapper.emitted("dimensionChange")?.[0]).toEqual(["source"]);
    expect(wrapper.text()).toContain("dashboard.trafficInsightsLoading");

    await wrapper.findAll(".traffic-dimension-switch button")[1]?.trigger("click");
    await nextTick();

    expect(wrapper.emitted("dimensionChange")?.at(-1)).toEqual(["campaign"]);
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
