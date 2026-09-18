import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import BaseButton from "~/components/BaseButton.vue";
import DashboardLoadGate from "~/components/dashboard/DashboardLoadGate.vue";
import { DASHBOARD_SERVICES } from "~~/types/dashboard";

afterEach(() => vi.unstubAllGlobals());

describe("DashboardLoadGate", () => {
  it("defaults both scopes to all and emits the complete selection", async () => {
    vi.stubGlobal("useLocalization", () => ({
      t: (key: string) => key,
    }));
    const stores = [
      { id: "shop-a", label: "Shop A" },
      { id: "shop-b", label: "Shop B" },
    ];
    const wrapper = mount(DashboardLoadGate, {
      props: {
        stores,
        storeCount: stores.length,
        loading: false,
        completedStores: 0,
        progress: 0,
      },
      global: { components: { BaseButton } },
    });

    const pressedButtons = wrapper.findAll('button[aria-pressed="true"]');
    expect(pressedButtons).toHaveLength(2);
    expect(pressedButtons.map((button) => button.text())).toEqual([
      "dashboard.loadGateAllStores",
      "dashboard.loadGateAllServices",
    ]);

    await wrapper.get(".dashboard-load-gate-card > .base-button").trigger("click");

    expect(wrapper.emitted("confirm")?.[0]).toEqual([
      {
        storeIds: ["shop-a", "shop-b"],
        services: [...DASHBOARD_SERVICES],
      },
    ]);
  });

  it("prevents loading when a selected scope is empty", async () => {
    vi.stubGlobal("useLocalization", () => ({
      t: (key: string) => key,
    }));
    const wrapper = mount(DashboardLoadGate, {
      props: {
        stores: [{ id: "shop-a", label: "Shop A" }],
        storeCount: 1,
        loading: false,
        completedStores: 0,
        progress: 0,
      },
      global: { components: { BaseButton } },
    });

    await wrapper.findAll(".dashboard-load-segments button")[1]?.trigger("click");
    await wrapper
      .get(".dashboard-load-checklist-actions button:last-child")
      .trigger("click");

    expect(
      wrapper.get(".dashboard-load-gate-card > .base-button").attributes(),
    ).toHaveProperty("disabled");
  });

  it("preserves manual deselection when the available store list changes", async () => {
    vi.stubGlobal("useLocalization", () => ({
      t: (key: string) => key,
    }));
    const wrapper = mount(DashboardLoadGate, {
      props: {
        stores: [{ id: "shop-a", label: "Shop A" }],
        storeCount: 1,
        loading: false,
        completedStores: 0,
        progress: 0,
      },
      global: { components: { BaseButton } },
    });

    await wrapper.findAll(".dashboard-load-segments button")[1]?.trigger("click");
    await wrapper
      .get<HTMLInputElement>(".dashboard-load-checklist input")
      .setValue(false);
    await wrapper.setProps({
      stores: [
        { id: "shop-a", label: "Shop A renamed" },
        { id: "shop-b", label: "Shop B" },
      ],
      storeCount: 2,
    });

    const checkboxes = wrapper.findAll<HTMLInputElement>(
      ".dashboard-load-checklist input",
    );
    expect(checkboxes[0]?.element.checked).toBe(false);
    expect(checkboxes[1]?.element.checked).toBe(true);
  });
});
