import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveShopifyTrafficTimeZone,
  shopifyqlTimeZoneModifier,
} from "~~/server/utils/shopify-traffic-timezone";

const mocks = vi.hoisted(() => ({
  callShopifyApi: vi.fn(),
}));

vi.mock("~~/server/utils/callShopifyApi", () => ({
  callShopifyApi: mocks.callShopifyApi,
  createApiErrorFromMessage: (message: string, statusCode: number) =>
    Object.assign(new Error(message), { statusCode }),
}));

describe("Shopify traffic timezone", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses a validated timezone already loaded with the store profile", async () => {
    await expect(
      resolveShopifyTrafficTimeZone({
        event: {} as never,
        storeId: "shop-a",
        token: "token",
        timeZone: "Asia/Ho_Chi_Minh",
      }),
    ).resolves.toBe("Asia/Ho_Chi_Minh");
    expect(mocks.callShopifyApi).not.toHaveBeenCalled();
  });

  it("loads the store IANA timezone when the caller has no profile", async () => {
    mocks.callShopifyApi.mockResolvedValue({
      shop: { iana_timezone: "America/New_York" },
    });

    await expect(
      resolveShopifyTrafficTimeZone({
        event: {} as never,
        storeId: "shop-a",
        token: "token",
      }),
    ).resolves.toBe("America/New_York");
    expect(mocks.callShopifyApi).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/shop.json",
        params: { fields: "iana_timezone" },
      }),
    );
  });

  it("fails closed instead of silently querying in the wrong timezone", async () => {
    mocks.callShopifyApi.mockResolvedValue({ shop: {} });

    await expect(
      resolveShopifyTrafficTimeZone({
        event: {} as never,
        storeId: "shop-a",
        token: "token",
      }),
    ).rejects.toMatchObject({ statusCode: 502 });
    expect(() => shopifyqlTimeZoneModifier("UTC' LIMIT 1")).toThrow(
      /valid IANA timezone/,
    );
  });
});
