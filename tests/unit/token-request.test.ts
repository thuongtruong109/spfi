import { describe, expect, it, vi } from "vitest";
import {
  requestShopifyAccessToken,
  resolveTokenRateLimitDelayMs,
} from "~~/utils/token-request";

const requestBody = {
  storeId: "example",
  clientId: "client-id",
  clientSecret: "client-secret",
  sock: "127.0.0.1:1080",
};

describe("token request rate-limit handling", () => {
  it("uses Retry-After with a small boundary cushion", () => {
    const error = {
      response: {
        headers: new Headers({ "retry-after": "2" }),
      },
    };

    expect(resolveTokenRateLimitDelayMs(error, 1_000)).toBe(2_250);
  });

  it("falls back to the rate-limit reset timestamp", () => {
    const error = {
      response: {
        headers: new Headers({ "x-ratelimit-reset": "11" }),
      },
    };

    expect(resolveTokenRateLimitDelayMs(error, 10_000)).toBe(1_250);
  });

  it("waits for an internal 429 and retries exactly once", async () => {
    const rateLimitError = {
      statusCode: 429,
      response: {
        status: 429,
        headers: new Headers({ "retry-after": "3" }),
      },
    };
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({ access_token: "rotated-token" });
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      requestShopifyAccessToken(requestBody, { fetcher, wait }),
    ).resolves.toEqual({ access_token: "rotated-token" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/generate-token",
      expect.objectContaining({ retry: 0 }),
    );
    expect(wait).toHaveBeenCalledWith(3_250);
  });

  it("does not retry non-rate-limit failures", async () => {
    const fetcher = vi.fn().mockRejectedValue({ statusCode: 500 });
    const wait = vi.fn();

    await expect(
      requestShopifyAccessToken(requestBody, { fetcher, wait }),
    ).rejects.toMatchObject({ statusCode: 500 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
});
