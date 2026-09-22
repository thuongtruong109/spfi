import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SecretInput from "~/components/base/SecretInput.vue";

describe("SecretInput", () => {
  it("masks the value by default and reveals it only on request", async () => {
    const wrapper = mount(SecretInput, {
      props: { modelValue: "new-secret" },
    });
    const input = wrapper.get("input");
    const toggle = wrapper.get("button");

    expect(input.attributes("type")).toBe("password");
    expect(toggle.attributes("aria-pressed")).toBe("false");

    await toggle.trigger("click");
    expect(input.attributes("type")).toBe("text");
    expect(toggle.attributes("aria-pressed")).toBe("true");

    await toggle.trigger("click");
    expect(input.attributes("type")).toBe("password");
  });

  it("emits changes without retaining a separate copy of the secret", async () => {
    const wrapper = mount(SecretInput, {
      props: { modelValue: "" },
    });

    await wrapper.get("input").setValue("replacement-secret");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      "replacement-secret",
    ]);
  });
});
