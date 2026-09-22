import { describe, expect, it } from "vitest";
import {
  WebhookStreamLimiter,
  type WebhookStreamLimits,
} from "~~/server/utils/webhook-stream-limiter";

const limits: WebhookStreamLimits = {
  total: 2,
  perIp: 1,
  perShop: 1,
  maxLifetimeMs: 60_000,
};

describe("webhook stream limiter", () => {
  it("enforces process, IP, and shop concurrency and releases idempotently", () => {
    const limiter = new WebhookStreamLimiter();
    const first = limiter.acquire({
      ip: "192.0.2.1",
      shopDomains: ["one.myshopify.com"],
      limits,
    });
    expect(first.acquired).toBe(true);
    expect(
      limiter.acquire({
        ip: "192.0.2.1",
        shopDomains: ["two.myshopify.com"],
        limits,
      }),
    ).toEqual({ acquired: false, scope: "ip" });
    expect(
      limiter.acquire({
        ip: "192.0.2.2",
        shopDomains: ["one.myshopify.com"],
        limits,
      }),
    ).toEqual({ acquired: false, scope: "shop" });

    const second = limiter.acquire({
      ip: "192.0.2.2",
      shopDomains: ["two.myshopify.com"],
      limits,
    });
    expect(second.acquired).toBe(true);
    expect(
      limiter.acquire({
        ip: "192.0.2.3",
        shopDomains: ["three.myshopify.com"],
        limits,
      }),
    ).toEqual({ acquired: false, scope: "process" });

    if (first.acquired) {
      first.release();
      first.release();
    }
    if (second.acquired) second.release();

    expect(
      limiter.acquire({
        ip: "192.0.2.3",
        shopDomains: ["one.myshopify.com"],
        limits,
      }).acquired,
    ).toBe(true);
  });
});
