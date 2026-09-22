import { beforeEach, describe, expect, it, vi } from "vitest";
import streamHandler from "~~/server/api/webhooks/stream.post";
import type { WebhookNotification } from "~~/types/webhook";

const registry = vi.hoisted(() => ({
  getWebhookNotifications: vi.fn(),
  getWebhookShop: vi.fn(),
  matchesWebhookStreamToken: vi.fn(),
  subscribeToWebhookNotifications: vi.fn(),
}));
const streamState = vi.hoisted(() => ({
  pushes: [] as Array<Record<string, string>>,
  close: () => {},
  closeStream: vi.fn(async () => {}),
  config: {} as Record<string, unknown>,
}));

vi.mock("~~/server/utils/webhook-registry", () => registry);
vi.mock("#imports", () => ({ useRuntimeConfig: () => streamState.config }));
vi.mock("h3", () => ({
  createError: (input: Record<string, unknown>) => Object.assign(new Error(), input),
  createEventStream: () => ({
    push: vi.fn(async (event: Record<string, string>) => {
      streamState.pushes.push(event);
    }),
    onClosed: vi.fn((callback: () => void) => {
      streamState.close = callback;
    }),
    close: streamState.closeStream,
    send: vi.fn(() => ({ streamed: true })),
  }),
  defineEventHandler: <T>(handler: T) => handler,
  getRequestIP: (event: { ip?: string }) => event.ip || "192.0.2.10",
  readBody: (event: { body?: unknown }) => Promise.resolve(event.body),
  setResponseHeader: vi.fn(),
}));

describe("webhook SSE stream route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    streamState.pushes = [];
    streamState.config = {};
    streamState.closeStream.mockImplementation(async () => streamState.close());
    registry.getWebhookShop.mockImplementation(async (domain: string) =>
      domain === "stream-shop.myshopify.com"
        ? {
            storeId: "stream-shop",
            shopDomain: domain,
            clientSecret: "secret",
            streamToken: "stream-token",
          }
        : null,
    );
    registry.matchesWebhookStreamToken.mockReturnValue(true);
    registry.getWebhookNotifications.mockResolvedValue([notification]);
  });

  it("replays cached notifications once and suppresses local-publish duplicates", async () => {
    let publish: ((value: WebhookNotification) => Promise<void>) | undefined;
    registry.subscribeToWebhookNotifications.mockImplementation(
      ({ publish: callback }: { publish: typeof publish }) => {
        publish = callback;
        return vi.fn();
      },
    );

    await expect(
      streamHandler({
        body: {
          subscriptions: [{ storeId: "stream-shop", token: "stream-token" }],
        },
      } as never),
    ).resolves.toEqual({ streamed: true });

    await publish?.(notification);
    expect(
      streamState.pushes.filter(({ event }) => event === "notification"),
    ).toHaveLength(1);
    expect(streamState.pushes[0]).toMatchObject({ event: "connected" });
    streamState.close();
  });

  it("closes and releases a stream at its maximum lifetime", async () => {
    vi.useFakeTimers();
    streamState.config = { webhookStreamMaxLifetimeSeconds: 1 };
    registry.subscribeToWebhookNotifications.mockReturnValue(vi.fn());

    try {
      await streamHandler({
        body: {
          subscriptions: [{ storeId: "stream-shop", token: "stream-token" }],
        },
        ip: "192.0.2.20",
      } as never);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(streamState.pushes).toContainEqual({
        event: "reconnect",
        data: "maximum_lifetime_reached",
      });
      expect(streamState.closeStream).toHaveBeenCalledTimes(1);
    } finally {
      streamState.close();
      vi.useRealTimers();
    }
  });

  it("rejects streams beyond the process connection limit", async () => {
    streamState.config = { webhookStreamMaxConnections: 1 };
    registry.subscribeToWebhookNotifications.mockReturnValue(vi.fn());

    await streamHandler({
      body: {
        subscriptions: [{ storeId: "stream-shop", token: "stream-token" }],
      },
      ip: "192.0.2.30",
    } as never);

    await expect(
      streamHandler({
        body: {
          subscriptions: [{ storeId: "stream-shop", token: "stream-token" }],
        },
        ip: "192.0.2.31",
      } as never),
    ).rejects.toMatchObject({ statusCode: 503 });
    streamState.close();
  });

  it("returns 413 instead of silently truncating excessive subscriptions", async () => {
    await expect(
      streamHandler({
        body: {
          subscriptions: Array.from({ length: 101 }, () => ({
            storeId: "stream-shop",
            token: "stream-token",
          })),
        },
      } as never),
    ).rejects.toMatchObject({ statusCode: 413 });
  });

  it("rejects a stream with no valid signed subscription", async () => {
    registry.matchesWebhookStreamToken.mockReturnValue(false);
    await expect(
      streamHandler({
        body: {
          subscriptions: [{ storeId: "stream-shop", token: "wrong" }],
        },
      } as never),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

const notification: WebhookNotification = {
  id: "delivery-1",
  webhookId: "delivery-1",
  eventId: null,
  storeId: "stream-shop",
  shopDomain: "stream-shop.myshopify.com",
  topic: "ORDERS_UPDATED",
  kind: "order",
  resourceId: "1001",
  orderId: "1001",
  orderName: "#1001",
  status: "updated",
  occurredAt: "2026-08-17T02:00:00.000Z",
  receivedAt: "2026-08-17T02:00:01.000Z",
};
