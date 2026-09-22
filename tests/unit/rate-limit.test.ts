import { createPinia, setActivePinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import BasePopover from "~/components/BasePopover.vue";
import RateLimitQuota from "~/components/shop/RateLimitQuota.vue";
import { useFormStore } from "~/stores/form";
import { useRateLimitStore } from "~/stores/rateLimit";

describe("rate limit store", () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("uses the stable app-wide API quota headers", () => {
    const store = useRateLimitStore();
    const headers = new Headers({
      "x-ratelimit-limit": "30",
      "x-ratelimit-remaining": "20",
      "x-ratelimit-reset": "100",
      "x-ratelimit-api-limit": "600",
      "x-ratelimit-api-remaining": "599",
      "x-ratelimit-api-reset": "100",
    });

    expect(store.updateFromHeaders(headers, 1_000)).toBe(true);
    expect(store.limit).toBe(600);
    expect(store.remaining).toBe(599);
    expect(store.resetAt).toBe(100_000);
    expect(store.lastUpdatedAt).toBe(1_000);
  });

  it("does not let out-of-order responses increase quota in one window", () => {
    const store = useRateLimitStore();

    store.updateFromHeaders(rateHeaders(600, 598, 100), 1_000);
    store.updateFromHeaders(rateHeaders(600, 599, 100), 2_000);

    expect(store.remaining).toBe(598);
    expect(store.lastUpdatedAt).toBe(1_000);
  });

  it("accepts a new window and ignores a late response from the old one", () => {
    const store = useRateLimitStore();

    store.updateFromHeaders(rateHeaders(600, 1, 100), 1_000);
    store.updateFromHeaders(rateHeaders(600, 599, 160), 2_000);
    store.updateFromHeaders(rateHeaders(600, 0, 100), 3_000);

    expect(store.remaining).toBe(599);
    expect(store.resetAt).toBe(160_000);
    expect(store.lastUpdatedAt).toBe(2_000);
  });

  it("ignores incomplete or invalid headers", () => {
    const store = useRateLimitStore();

    expect(store.updateFromHeaders(new Headers())).toBe(false);
    expect(store.updateFromHeaders(rateHeaders(0, 0, 0))).toBe(false);
    expect(store.isKnown).toBe(false);
  });

  it("tracks GraphQL cost per store and rejects an older concurrent response", () => {
    const store = useRateLimitStore();

    store.updateFromHeaders(graphqlHeaders(1_000, 650, 50, 20), 2_000, "shop-a", 2);
    store.updateFromHeaders(graphqlHeaders(1_000, 900, 50, 10), 1_000, "shop-a", 1);
    store.updateFromHeaders(graphqlHeaders(2_000, 1_800, 100, 30), 3_000, "shop-b", 3);

    expect(store.graphqlCosts["shop-a"]).toMatchObject({
      limit: 1_000,
      remaining: 650,
      restoreRate: 50,
      actualCost: 20,
      requestSequence: 2,
    });
    expect(store.graphqlCosts["shop-b"]).toMatchObject({
      limit: 2_000,
      remaining: 1_800,
    });
  });

  it("bounds GraphQL cost snapshots across many stores", () => {
    const store = useRateLimitStore();
    for (let index = 0; index < 20; index += 1) {
      store.updateFromHeaders(
        graphqlHeaders(1_000, 900, 50, 10),
        index + 1,
        `shop-${index}`,
        index + 1,
      );
    }

    expect(Object.keys(store.graphqlCosts)).toHaveLength(12);
    expect(store.graphqlCosts["shop-0"]).toBeUndefined();
    expect(store.graphqlCosts["shop-19"]).toBeDefined();
  });

  it("tracks cache reuse, throttle queue latency, and API error rate", () => {
    const store = useRateLimitStore();
    store.recordOperationalResponse(
      new Headers({
        "x-spf-cache-status": "miss",
        "x-spf-shopify-queue-latency-ms": "120",
      }),
      false,
    );
    store.recordOperationalResponse(
      new Headers({
        "x-spf-cache-status": "hit",
        "x-spf-shopify-queue-latency-ms": "80",
      }),
      true,
    );

    expect(store.cacheHitRatio).toBe(50);
    expect(store.averageQueueLatencyMs).toBe(100);
    expect(store.errorRate).toBe(50);
  });

  it("shows a compact request row and opens both quota meters in a popover", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useRateLimitStore();
    useFormStore().setActiveStore("shop-a");
    store.updateFromHeaders(rateHeaders(600, 300, futureReset()), 1_000);
    store.updateFromHeaders(
      graphqlHeaders(1_000, 500, 50, 25),
      Date.now() + 1_000,
      "shop-a",
      1,
    );
    store.recordOperationalResponse(
      new Headers({
        "x-spf-cache-status": "hit",
        "x-spf-shopify-queue-latency-ms": "25",
      }),
      false,
    );

    const wrapper = mount(RateLimitQuota, {
      props: { collapsed: false },
      global: {
        components: { BasePopover },
        plugins: [pinia],
      },
    });

    expect(wrapper.get(".quota-summary").text()).toContain("Request quota");
    expect(wrapper.text()).toContain("50%");
    expect(wrapper.get(".quota-summary-progress span").attributes("style")).toContain(
      "width: 50%",
    );
    expect(wrapper.text()).not.toContain("GraphQL cost");

    await wrapper.get(".quota-summary").trigger("click");
    await flushPromises();

    const detail = document.body.querySelector<HTMLElement>(".quota-detail-panel");
    expect(detail).not.toBeNull();
    expect(detail?.textContent).toContain("300 / 600 requests");
    expect(detail?.textContent).toContain("GraphQL cost");
    expect(detail?.textContent).toContain("500 / 1,000 points");
    expect(detail?.textContent).toContain("Cache hit ratio");
    expect(detail?.textContent).toContain("100%");
    expect(detail?.textContent).toContain("25 ms");
    expect(detail?.querySelectorAll(".quota-progress")).toHaveLength(2);

    await wrapper.setProps({ collapsed: true });

    const ring = wrapper.get(".quota-ring-value");
    const circumference = 2 * Math.PI * 17;
    expect(Number(ring.attributes("stroke-dashoffset"))).toBeCloseTo(circumference / 2);
    expect(wrapper.get(".quota-ring").text()).toBe("50");

    wrapper.unmount();
  });
});

function rateHeaders(limit: number, remaining: number, reset: number) {
  return new Headers({
    "x-ratelimit-api-limit": String(limit),
    "x-ratelimit-api-remaining": String(remaining),
    "x-ratelimit-api-reset": String(reset),
  });
}

function graphqlHeaders(
  limit: number,
  remaining: number,
  restoreRate: number,
  actualCost: number,
) {
  return new Headers({
    "x-shopify-graphql-maximum-available": String(limit),
    "x-shopify-graphql-currently-available": String(remaining),
    "x-shopify-graphql-restore-rate": String(restoreRate),
    "x-shopify-graphql-requested-cost": String(actualCost + 5),
    "x-shopify-graphql-actual-cost": String(actualCost),
  });
}

function futureReset() {
  return Math.ceil(Date.now() / 1_000) + 60;
}
