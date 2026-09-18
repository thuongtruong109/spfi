import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useDashboardStore } from "~/stores/dashboard";
import { useFormStore } from "~/stores/form";
import { useMarketStore } from "~/stores/market";
import { useNotificationStore } from "~/stores/notifications";
import { useOrderStore } from "~/stores/order";
import { useProductStore } from "~/stores/product";
import { KNOWN_STORES_STORAGE_KEY } from "~~/utils/known-stores";

afterEach(() => vi.unstubAllGlobals());

describe("credential vault store", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("normalizes saved credentials and safely ignores corrupted JSON", async () => {
    const vault = useCredentialVaultStore();
    vault.initialize();
    await vault.saveStoreData("shop-a", {
      domain: " shop-a.myshopify.com ",
      accessToken: " token ",
      expiresTime: 9_007_199_254_740_991,
    });

    expect(vault.getStoreData("shop-a")).toMatchObject({
      domain: "shop-a.myshopify.com",
      accessToken: "token",
      expiresTime: 9_007_199_254_740_991,
    });
    expect(JSON.parse(localStorage.getItem("shop-a") || "{}")).toMatchObject({
      value: { domain: "shop-a.myshopify.com", accessToken: "token" },
    });

    localStorage.setItem("broken-shop", "{not-json");
    expect(vault.getStoreData("broken-shop")).toEqual({});
  });

  it("migrates tracking settings to FedEx and persists another carrier", async () => {
    localStorage.setItem(
      "spf_tracking_provider_settings",
      JSON.stringify({ apiKey: " legacy-key " }),
    );
    const vault = useCredentialVaultStore();
    vault.initialize();

    expect(vault.trackingSettings).toEqual({
      apiKey: "legacy-key",
      carrier: "fedex",
    });

    await vault.saveTrackingSettings({ apiKey: "key", carrier: "ups" });
    expect(vault.trackingSettings).toEqual({ apiKey: "key", carrier: "ups" });
  });
});

describe("notification store", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("keeps the live stream when token rotation does not change webhook configuration", async () => {
    const form = useFormStore();
    const vault = useCredentialVaultStore();
    form.knownStores = ["shop-a"];
    await vault.saveStoreData("shop-a", {
      domain: "shop-a.myshopify.com",
      clientSecret: "client-secret",
      accessToken: "token-before-rotation",
      expiresTime: Date.now() + 60_000,
    });
    const register = vi.fn().mockResolvedValue({
      storeId: "shop-a",
      shopDomain: "shop-a.myshopify.com",
      streamToken: "stream-token",
      webhookUrl: "https://ops.example/api/webhooks/shopify",
      registeredTopics: [],
      warnings: [],
      synchronizationError: null,
    });
    vi.stubGlobal("$fetch", register);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('event: connected\ndata: {"stores":1}\n\n'),
            );
          },
        }),
      }),
    );

    const notifications = useNotificationStore();
    await notifications.synchronize();
    await vault.patchStoreData("shop-a", {
      accessToken: "token-after-rotation",
      expiresTime: Date.now() + 120_000,
    });
    await notifications.synchronize();

    expect(register).toHaveBeenCalledTimes(1);
  });
});

describe("order store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("retains independent pagination and data per active store", () => {
    const store = useOrderStore();
    expect(store.hydrate("shop-a")).toBe(false);
    store.orders = [{ id: 1, name: "#1" }];
    store.orderCount = 1;
    store.setPageSize(50);
    store.setPage(3);

    expect(store.hydrate("shop-b")).toBe(false);
    expect(store.orders).toEqual([]);
    expect(store.currentPage).toBe(1);

    expect(store.hydrate("shop-a")).toBe(true);
    expect(store.orders).toEqual([{ id: 1, name: "#1" }]);
    expect(store.pageSize).toBe(50);
    expect(store.currentPage).toBe(3);
  });
});

describe("product store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("tracks loaded cursor pages independently from the product count", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        products: [{ id: 1, title: "First" }],
        count: 75,
        pageInfo: {
          nextCursor: "page-2",
          previousCursor: null,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      })
      .mockResolvedValueOnce({
        products: [{ id: 2, title: "Second" }],
        count: 75,
        pageInfo: {
          nextCursor: null,
          previousCursor: "page-1",
          hasNextPage: false,
          hasPreviousPage: true,
        },
      });
    vi.stubGlobal("$fetch", request);

    const store = useProductStore();
    await store.fetchAll("shop-a", "token", 50);
    await store.fetchNext("shop-a", "token");

    expect(store.loadedPageCount).toBe(2);
    expect(store.products.map((product) => product.id)).toEqual([1, 2]);
    expect(store.hydrate("shop-b")).toBe(false);
    expect(store.loadedPageCount).toBe(0);
    expect(store.hydrate("shop-a")).toBe(true);
    expect(store.loadedPageCount).toBe(2);
  });

  it("bulk publishes exact product IDs and refreshes the list once", async () => {
    const request = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/product/bulk-publication") {
        return Promise.resolve({ total: 2, succeeded: 2, failedIds: [] });
      }
      if (url === "/api/product/page") {
        return Promise.resolve({
          products: [],
          count: 0,
          pageInfo: {
            nextCursor: null,
            previousCursor: null,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        });
      }
      return Promise.resolve({});
    });
    vi.stubGlobal("$fetch", request);

    const store = useProductStore();
    const result = await store.setProductsPublished(
      "shop-a",
      "token",
      ["9007199254740993", 42, "9007199254740993"],
      true,
    );

    expect(result).toEqual({ total: 2, succeeded: 2, failedIds: [] });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[0]).toBe("/api/product/bulk-publication");
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      body: {
        productIds: ["9007199254740993", 42],
        publish: true,
      },
    });
    expect(request.mock.calls[1]?.[0]).toBe("/api/product/page");
  });
});

describe("market store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("caches market lists per store and updates status only after Shopify succeeds", async () => {
    const request = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/market/status") {
        return Promise.resolve({
          id: "gid://shopify/Market/1",
          status: "DRAFT",
        });
      }
      return Promise.resolve({
        items: [
          {
            id: "gid://shopify/Market/1",
            handle: "us",
            name: "United States",
            status: "ACTIVE",
            type: "REGION",
            conditionTypes: ["REGION"],
            conditionApplicationLevel: "SPECIFIC",
            regions: [],
            regionsTruncated: false,
            currencySettings: null,
            priceInclusions: null,
            catalogCount: null,
            catalogs: [],
            catalogsTruncated: false,
            webPresences: [],
            webPresencesTruncated: false,
            shipping: {
              inherits: true,
              enabled: null,
              optionCount: null,
              options: [],
              optionsTruncated: false,
            },
          },
        ],
        fetchedAt: "2026-08-12T00:00:00.000Z",
        truncated: false,
      });
    });
    vi.stubGlobal("$fetch", request);

    const store = useMarketStore();
    await expect(store.fetchAll("shop-a", "token")).resolves.toBe(true);
    await expect(store.fetchAll("shop-a", "token")).resolves.toBe(true);
    expect(request).toHaveBeenCalledTimes(1);

    await expect(
      store.setStatus("shop-a", "token", "gid://shopify/Market/1", "DRAFT"),
    ).resolves.toBe(true);
    expect(store.markets[0]?.status).toBe("DRAFT");

    expect(store.hydrate("shop-b")).toBe(false);
    expect(store.markets).toEqual([]);
    expect(store.hydrate("shop-a")).toBe(true);
    expect(store.markets[0]?.status).toBe("DRAFT");
  });
});

describe("dashboard store", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("prepares saved stores without requesting dashboard data", async () => {
    localStorage.setItem(
      KNOWN_STORES_STORAGE_KEY,
      JSON.stringify(["shop-a", "shop-b"]),
    );
    const request = vi.fn();
    vi.stubGlobal("$fetch", request);

    const dashboard = useDashboardStore();
    dashboard.prepare();

    expect(dashboard.isPrepared).toBe(true);
    expect(dashboard.totalStores).toBe(2);
    expect(dashboard.hasLoaded).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("reuses a live all-store snapshot until an explicit refresh", async () => {
    localStorage.setItem(KNOWN_STORES_STORAGE_KEY, JSON.stringify(["shop-a"]));
    const form = useFormStore();
    const vault = useCredentialVaultStore();
    await vault.saveStoreData("shop-a", {
      domain: "shop-a.myshopify.com",
      accessToken: "token",
    });
    const request = vi.fn().mockResolvedValue({ storeId: "shop-a" });
    vi.stubGlobal("$fetch", request);

    const dashboard = useDashboardStore();
    await dashboard.load();
    await dashboard.load();

    expect(form.knownStores).toEqual(["shop-a"]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(dashboard.hasLoaded).toBe(true);

    await dashboard.load(true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("loads only selected stores and dashboard services", async () => {
    localStorage.setItem(
      KNOWN_STORES_STORAGE_KEY,
      JSON.stringify(["shop-a", "shop-b"]),
    );
    const vault = useCredentialVaultStore();
    await vault.saveStoreData("shop-a", {
      domain: "shop-a.myshopify.com",
      accessToken: "token-a",
    });
    await vault.saveStoreData("shop-b", {
      domain: "shop-b.myshopify.com",
      accessToken: "token-b",
    });
    const request = vi.fn().mockResolvedValue({ storeId: "shop-b" });
    vi.stubGlobal("$fetch", request);

    const dashboard = useDashboardStore();
    await dashboard.load(false, {
      storeIds: ["shop-b", "unknown-shop"],
      services: ["orders", "traffic"],
    });

    expect(dashboard.totalStores).toBe(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      "/api/dashboard",
      expect.objectContaining({
        body: expect.objectContaining({
          storeId: "shop-b",
          token: "token-b",
          services: ["orders", "traffic"],
        }),
      }),
    );
  });
});
