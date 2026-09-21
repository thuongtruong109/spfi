import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ApiLoadingIcon from "~/components/ApiLoadingIcon.vue";
import ShopEmptyState from "~/components/shop/EmptyState.vue";

describe("API loading indicators", () => {
  it("keeps the existing transition icon as the default", () => {
    const wrapper = mount(ApiLoadingIcon);

    expect(wrapper.get("svg").attributes("data-loading-icon")).toBe("transition");
  });

  it("uses the circular spinner for API-backed sections", () => {
    const wrapper = mount(ApiLoadingIcon, {
      props: { variant: "section" },
    });

    expect(wrapper.get("svg").attributes("data-loading-icon")).toBe("section");
    expect(wrapper.get("svg").classes()).toContain("is-section");
  });

  it("automatically renders the circular spinner in a loading empty state", () => {
    const wrapper = mount(ShopEmptyState, {
      props: {
        title: "Loading store data",
        description: "Waiting for Shopify",
        loading: true,
      },
      global: { components: { ApiLoadingIcon } },
    });

    expect(wrapper.get('[data-loading-icon="section"]')).toBeDefined();
    expect(wrapper.attributes("class")).toContain("is-loading");
  });
});
