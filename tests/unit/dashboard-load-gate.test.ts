import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import BaseButton from "~/components/BaseButton.vue";
import DashboardLoadGate from "~/components/dashboard/DashboardLoadGate.vue";
import { DASHBOARD_SERVICES } from "~~/types/dashboard";

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty("overflow");
  document.body.style.removeProperty("overflow");
});

describe("DashboardLoadGate", () => {
  it("shows both selections directly and emits the complete default selection", async () => {
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

    expect(wrapper.find(".dashboard-load-segments").exists()).toBe(false);
    expect(wrapper.findAll(".dashboard-load-checklist")).toHaveLength(2);
    expect(
      wrapper.findAll('.dashboard-load-checklist input[type="checkbox"]'),
    ).toHaveLength(stores.length + DASHBOARD_SERVICES.length);
    expect(wrapper.findAll(".dashboard-load-option-header")).toHaveLength(2);
    expect(wrapper.findAll(".dashboard-load-checklist-actions")).toHaveLength(2);
    expect(wrapper.find(".dashboard-load-gate-eyebrow").exists()).toBe(false);

    await wrapper.get(".dashboard-load-gate-card > .base-button").trigger("click");

    expect(wrapper.emitted("confirm")?.[0]).toEqual([
      {
        storeIds: ["shop-a", "shop-b"],
        services: [...DASHBOARD_SERVICES],
      },
    ]);
    wrapper.unmount();
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

    await wrapper
      .findAll("fieldset")[0]!
      .get(".dashboard-load-checklist-actions button:last-child")
      .trigger("click");

    expect(
      wrapper.get(".dashboard-load-gate-card > .base-button").attributes(),
    ).toHaveProperty("disabled");
    wrapper.unmount();
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

    await wrapper
      .findAll(".dashboard-load-checklist")[0]!
      .get<HTMLInputElement>("input")
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
    wrapper.unmount();
  });

  it("locks document scrolling until the modal unmounts", () => {
    vi.stubGlobal("useLocalization", () => ({
      t: (key: string) => key,
    }));
    document.documentElement.style.overflow = "scroll";
    document.body.style.overflow = "auto";

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

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");

    wrapper.unmount();
    expect(document.documentElement.style.overflow).toBe("scroll");
    expect(document.body.style.overflow).toBe("auto");
  });
});
