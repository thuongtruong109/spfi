import { describe, expect, it, vi } from "vitest";
import {
  buildTrafficDimensionCacheKey,
  TrafficQueryCache,
} from "~~/server/utils/traffic-query-cache";
import type { TrafficQueryDiagnostics } from "~~/types/traffic";

interface CacheValue extends TrafficQueryDiagnostics {
  value: number;
}

function value(number: number): CacheValue {
  return {
    value: number,
    generatedAt: null,
    cacheAge: 0,
    isStale: false,
  };
}

describe("traffic query cache", () => {
  it("deduplicates in-flight loads and reports cache age", async () => {
    let now = Date.parse("2026-09-20T10:00:00.000Z");
    let resolveLoad!: (result: CacheValue) => void;
    const load = vi.fn(
      () =>
        new Promise<CacheValue>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const cache = new TrafficQueryCache(() => now);
    const options = {
      key: "dimension:shop:24h:source",
      policy: { freshForMs: 5_000, staleForMs: 20_000 },
      load,
    };

    const first = cache.resolve(options);
    const second = cache.resolve(options);
    await Promise.resolve();
    expect(load).toHaveBeenCalledOnce();

    resolveLoad(value(42));
    await expect(first).resolves.toMatchObject({
      value: 42,
      generatedAt: "2026-09-20T10:00:00.000Z",
      cacheAge: 0,
      isStale: false,
    });
    await expect(second).resolves.toMatchObject({ value: 42 });

    now += 2_500;
    await expect(cache.resolve(options)).resolves.toMatchObject({
      cacheAge: 2,
      isStale: false,
    });
    expect(load).toHaveBeenCalledOnce();
  });

  it("serves an explicitly stale value when refresh fails", async () => {
    let now = Date.parse("2026-09-20T10:00:00.000Z");
    const cache = new TrafficQueryCache(() => now);
    const policy = { freshForMs: 1_000, staleForMs: 10_000 };

    await cache.resolve({ key: "overview", policy, load: async () => value(1) });
    now += 2_500;

    await expect(
      cache.resolve({
        key: "overview",
        policy,
        load: async () => {
          throw new Error("Shopify unavailable");
        },
      }),
    ).resolves.toMatchObject({ value: 1, cacheAge: 2, isStale: true });
  });

  it("keeps upstream alive while another waiter remains", async () => {
    const cache = new TrafficQueryCache();
    const first = new AbortController();
    const second = new AbortController();
    let resolveLoad!: (result: CacheValue) => void;
    let upstreamSignal!: AbortSignal;
    const load = vi.fn(
      (signal: AbortSignal) =>
        new Promise<CacheValue>((resolve, reject) => {
          upstreamSignal = signal;
          resolveLoad = resolve;
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    const options = {
      key: "shared",
      policy: { freshForMs: 1_000, staleForMs: 10_000 },
      load,
    };
    const firstResult = cache.resolve({ ...options, signal: first.signal });
    const secondResult = cache.resolve({ ...options, signal: second.signal });

    await Promise.resolve();
    first.abort();
    await expect(firstResult).rejects.toMatchObject({ name: "AbortError" });
    expect(upstreamSignal.aborted).toBe(false);

    resolveLoad(value(7));
    await expect(secondResult).resolves.toMatchObject({ value: 7 });
  });

  it("aborts upstream when the final waiter cancels", async () => {
    const cache = new TrafficQueryCache();
    const caller = new AbortController();
    let upstreamSignal!: AbortSignal;
    const pending = cache.resolve({
      key: "cancelled",
      policy: { freshForMs: 1_000, staleForMs: 10_000 },
      signal: caller.signal,
      load: (signal) => {
        upstreamSignal = signal;
        return new Promise<CacheValue>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      },
    });

    await Promise.resolve();
    caller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(upstreamSignal.aborted).toBe(true);
  });

  it("lets an explicit refresh bypass a fresh entry", async () => {
    const cache = new TrafficQueryCache();
    const load = vi
      .fn<() => Promise<CacheValue>>()
      .mockResolvedValueOnce(value(1))
      .mockResolvedValueOnce(value(2));
    const options = {
      key: "refresh",
      policy: { freshForMs: 60_000, staleForMs: 120_000 },
      load,
    };

    await expect(cache.resolve(options)).resolves.toMatchObject({ value: 1 });
    await expect(cache.resolve({ ...options, refresh: true })).resolves.toMatchObject({
      value: 2,
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not retain a failed synchronous flight", async () => {
    const cache = new TrafficQueryCache();
    const policy = { freshForMs: 1_000, staleForMs: 10_000 };

    await expect(
      cache.resolve({
        key: "retry",
        policy,
        load: () => {
          throw new Error("failed before a promise was returned");
        },
      }),
    ).rejects.toThrow("failed before a promise was returned");

    await expect(
      cache.resolve({ key: "retry", policy, load: async () => value(3) }),
    ).resolves.toMatchObject({ value: 3 });
  });

  it("isolates cache entries when a credential or timezone changes", () => {
    expect(buildTrafficDimensionCacheKey("shop-a", "token-a", "7d", "source")).not.toBe(
      buildTrafficDimensionCacheKey("shop-a", "token-b", "7d", "source"),
    );
    expect(
      buildTrafficDimensionCacheKey("shop-a", "token-a", "7d", "source", "Etc/UTC"),
    ).not.toBe(
      buildTrafficDimensionCacheKey(
        "shop-a",
        "token-a",
        "7d",
        "source",
        "Asia/Ho_Chi_Minh",
      ),
    );
  });
});
