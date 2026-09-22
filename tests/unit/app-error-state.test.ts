import { mount } from "@vue/test-utils";
import { setActivePinia } from "pinia";
import { describe, expect, it } from "vitest";
import AppErrorState from "~/components/AppErrorState.vue";

describe("AppErrorState", () => {
  it("renders a usable fallback before Pinia has initialized", () => {
    setActivePinia(undefined);

    const wrapper = mount(AppErrorState, {
      props: {
        error: {
          statusCode: 500,
          statusMessage: "Application initialization failed.",
        },
      },
      global: {
        stubs: {
          BaseButton: {
            template: "<button><slot name='icon' /><slot /></button>",
          },
        },
      },
    });

    expect(wrapper.text()).toContain("This page could not be displayed");
    expect(wrapper.text()).toContain("Application initialization failed.");
    expect(wrapper.text()).toContain("Try again");
    expect(wrapper.text()).toContain("Go to dashboard");
  });
});
