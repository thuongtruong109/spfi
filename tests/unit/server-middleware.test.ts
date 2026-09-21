import { beforeEach, describe, expect, it, vi } from "vitest";
import securityHandler from "~~/server/middleware/00-security";
import rateLimitHandler from "~~/server/middleware/rateLimit";

type TestEvent = {
  url: string;
  method: string;
  headers: Record<string, string>;
  config: Record<string, unknown>;
  context: Record<string, unknown>;
  responseHeaders: Record<string, string>;
  ip: string;
  node: { req: { socket: { remoteAddress: string } } };
};

vi.mock("#imports", () => ({
  useRuntimeConfig: (event: TestEvent) => event.config,
}));

vi.mock("h3", () => ({
  createError: (input: Record<string, unknown>) => Object.assign(new Error(), input),
  defineEventHandler: <T>(handler: T) => handler,
  getHeader: (event: TestEvent, name: string) => event.headers[name.toLowerCase()],
  getRequestIP: (event: TestEvent) => event.ip,
  getRequestURL: (event: TestEvent) => new URL(event.url),
  sendNoContent: (_event: TestEvent, status: number) => ({ status }),
  setResponseHeader: (event: TestEvent, name: string, value: unknown) => {
    event.responseHeaders[name.toLowerCase()] = String(value);
  },
}));

function createEvent(overrides: Partial<TestEvent> = {}): TestEvent {
  return {
    url: "https://app.example/api/orders",
    method: "POST",
    headers: { "sec-fetch-site": "same-origin" },
    config: {
      allowedOrigins: "",
      apiOriginRequired: true,
      allowHostOriginFallback: false,
      apiRateLimitPerMinute: 10,
      tokenRateLimitPerMinute: 2,
      trustProxyHeaders: false,
    },
    context: {},
    responseHeaders: {},
    ip: `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
    node: { req: { socket: { remoteAddress: "203.0.113.1" } } },
    ...overrides,
  };
}

describe("security middleware", () => {
  it("sets browser security and API no-store headers for an allowed request", () => {
    const event = createEvent();
    securityHandler(event as never);

    expect(event.context.cspNonce).toEqual(expect.any(String));
    expect(event.responseHeaders["content-security-policy"]).toContain("nonce-");
    expect(event.responseHeaders["cache-control"]).toBe("no-store");
  });

  it("rejects a cross-site API request outside the configured allowlist", () => {
    const event = createEvent({
      method: "GET",
      headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
    });

    expect(() => securityHandler(event as never)).toThrowError(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it("answers an allowlisted CORS preflight with explicit headers", () => {
    const event = createEvent({
      method: "OPTIONS",
      headers: { origin: "https://ops.example", "sec-fetch-site": "cross-site" },
      config: {
        allowedOrigins: "https://ops.example",
        apiOriginRequired: true,
        allowHostOriginFallback: false,
      },
    });

    expect(securityHandler(event as never)).toEqual({ status: 204 });
    expect(event.responseHeaders["access-control-allow-origin"]).toBe(
      "https://ops.example",
    );
    expect(event.responseHeaders["access-control-allow-methods"]).toContain("POST");
  });

  it("allows the dedicated HMAC-authenticated Shopify webhook without Origin", () => {
    const event = createEvent({
      url: "https://app.example/api/webhooks/shopify",
      method: "POST",
      headers: {},
    });

    expect(() => securityHandler(event as never)).not.toThrow();
    expect(event.responseHeaders["cache-control"]).toBe("no-store");
  });
});

describe("rate-limit middleware", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("emits quota headers and rejects requests beyond the configured window", () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    const first = createEvent({
      ip,
      config: {
        apiRateLimitPerMinute: 1,
        tokenRateLimitPerMinute: 1,
        trustProxyHeaders: false,
      },
    });
    rateLimitHandler(first as never);
    expect(first.responseHeaders["x-ratelimit-remaining"]).toBe("0");

    const second = createEvent({ ...first, responseHeaders: {} });
    expect(() => rateLimitHandler(second as never)).toThrowError(
      expect.objectContaining({ statusCode: 429 }),
    );
    expect(second.responseHeaders["retry-after"]).toEqual(expect.any(String));
  });

  it("reports the token policy as the most constrained generate-token quota", () => {
    const event = createEvent({
      url: "https://app.example/api/generate-token",
      ip: `192.0.2.${Math.floor(Math.random() * 200) + 1}`,
      config: {
        apiRateLimitPerMinute: 20,
        tokenRateLimitPerMinute: 1,
        trustProxyHeaders: false,
      },
    });
    rateLimitHandler(event as never);

    expect(event.responseHeaders["x-ratelimit-limit"]).toBe("1");
    expect(event.responseHeaders["x-ratelimit-api-limit"]).toBe("20");
  });

  it("uses only the app-wide quota when the token-specific limit is disabled", () => {
    const event = createEvent({
      url: "https://app.example/api/generate-token",
      ip: `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
      config: {
        apiRateLimitPerMinute: 20,
        tokenRateLimitPerMinute: 0,
        trustProxyHeaders: false,
      },
    });

    rateLimitHandler(event as never);

    expect(event.responseHeaders["x-ratelimit-limit"]).toBe("20");
    expect(event.responseHeaders["x-ratelimit-remaining"]).toBe("19");
  });
});
