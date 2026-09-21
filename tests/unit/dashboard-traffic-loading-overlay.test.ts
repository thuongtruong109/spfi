import { shallowMount } from "@vue/test-utils";
import { computed } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardTrafficLoadingOverlay from "~/components/dashboard/DashboardTrafficLoadingOverlay.vue";

describe("DashboardTrafficLoadingOverlay", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the selected range and an accessible, bounded progress bar", () => {
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("useLocalization", () => ({
      t: (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
    }));

    const wrapper = shallowMount(DashboardTrafficLoadingOverlay, {
      props: {
        rangeLabel: "Last 7 days",
        progress: {
          loaded: 7,
          total: 21,
          percent: 33,
          complete: false,
        },
      },
      global: { stubs: { LoaderCircle: true } },
    });

    expect(wrapper.text()).toContain(
      'dashboard.trafficFullLoadingRange:{"range":"Last 7 days"}',
    );
    expect(wrapper.text()).toContain(
      'dashboard.trafficLoadProgress:{"loaded":7,"total":21,"percent":33}',
    );

    const progressbar = wrapper.get('[role="progressbar"]');
    expect(progressbar.attributes("aria-valuenow")).toBe("33");
    expect(progressbar.attributes("aria-valuemin")).toBe("0");
    expect(progressbar.attributes("aria-valuemax")).toBe("100");
    expect(progressbar.get("i").attributes("style")).toContain("width: 33%");
  });
});
