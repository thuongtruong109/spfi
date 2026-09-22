import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useDashboardStore } from "~/stores/dashboard";
import { useFormStore } from "~/stores/form";
import { useMarketStore } from "~/stores/market";
import { useNotificationStore } from "~/stores/notifications";
import { useOrderStore } from "~/stores/order";
import { useProductStore } from "~/stores/product";
import { CREDENTIAL_VAULT_STORAGE_KEY } from "~~/utils/credential-vault-storage";
import { KNOWN_STORES_STORAGE_KEY } from "~~/utils/known-stores";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("credential vault store", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("normalizes saved credentials and safely ignores corrupted JSON", async () => {
    const vault = useCredentialVaultStore();
    await vault.initialize();
    await vault.saveStoreData("shop-a", {
      domain: " shop-a.myshopify.com ",
      sock: " socks5h://user:pass@8.8.8.8:1080 ",
      clientId: " client-id ",
      clientSecret: " client-secret ",
      accessToken: " access-token-sensitive-value ",
      expiresTime: 9_007_199_254_740_991,
    });

    expect(vault.getStoreData("shop-a")).toMatchObject({
      domain: "shop-a.myshopify.com",
      accessToken: "access-token-sensitive-value",
      expiresTime: 9_007_199_254_740_991,
    });
    expect(localStorage.getItem("shop-a")).toBeNull();
    const encryptedVault = localStorage.getItem(CREDENTIAL_VAULT_STORAGE_KEY) || "";
    expect(JSON.parse(encryptedVault)).toMatchObject({
      version: 1,
      algorithm: "AES-GCM",
    });
    for (const plaintext of [
      "shop-a",
      "client-id",
      "client-secret",
      "socks5h://user:pass@8.8.8.8:1080",
      "access-token-sensitive-value",
    ]) {
      expect(encryptedVault).not.toContain(plaintext);
    }

    setActivePinia(createPinia());
    const reloadedVault = useCredentialVaultStore();
    await reloadedVault.initialize();
    expect(reloadedVault.getStoreData("shop-a")).toMatchObject({
      clientId: "client-id",
      clientSecret: "client-secret",
      accessToken: "access-token-sensitive-value",
    });

    localStorage.setItem("broken-shop", "{not-json");
    expect(reloadedVault.getStoreData("broken-shop")).toEqual({});
  });

  it("fails closed instead of overwriting a corrupted encrypted vault", async () => {
    const vault = useCredentialVaultStore();
    await vault.saveStoreData("shop-a", {
      clientId: "client-id",
      clientSecret: "client-secret",
    });
    const envelope = JSON.parse(
      localStorage.getItem(CREDENTIAL_VAULT_STORAGE_KEY) || "{}",
    ) as { ciphertext?: string };
    envelope.ciphertext = "AAAA";
    const corruptedVault = JSON.stringify(envelope);
    localStorage.setItem(CREDENTIAL_VAULT_STORAGE_KEY, corruptedVault);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    setActivePinia(createPinia());
    const reloadedVault = useCredentialVaultStore();
    await reloadedVault.initialize();

    expect(reloadedVault.initializationError).toContain("could not be decrypted");
    await expect(
      reloadedVault.saveStoreData("shop-b", { clientSecret: "new-secret" }),
    ).rejects.toThrow("could not be decrypted");
    expect(localStorage.getItem(CREDENTIAL_VAULT_STORAGE_KEY)).toBe(corruptedVault);
  });

  it("migrates legacy plaintext store data only after encrypting it", async () => {
    localStorage.setItem(KNOWN_STORES_STORAGE_KEY, JSON.stringify(["legacy-shop"]));
    localStorage.setItem(
      "legacy-shop",
      JSON.stringify({
        value: {
          domain: "legacy-shop.myshopify.com",
          sock: "8.8.8.8:1080:user:pass",
          clientId: "legacy-client",
          clientSecret: "legacy-secret",
        },
      }),
    );
    localStorage.setItem("active_store_id", JSON.stringify({ value: "legacy-shop" }));
    localStorage.setItem(
      "spf_token_rotation_lease:legacy-shop",
      JSON.stringify({ owner: "legacy-owner", expiresAt: Date.now() + 60_000 }),
    );

    const vault = useCredentialVaultStore();
    await vault.initialize();

    expect(vault.getStoreData("legacy-shop")).toMatchObject({
      clientId: "legacy-client",
      clientSecret: "legacy-secret",
    });
    expect(vault.activeStoreId).toBe("legacy-shop");
    expect(localStorage.getItem(KNOWN_STORES_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem("legacy-shop")).toBeNull();
    expect(localStorage.getItem("active_store_id")).toBeNull();
    expect(localStorage.getItem("spf_token_rotation_lease:legacy-shop")).toBeNull();
    const encryptedVault = localStorage.getItem(CREDENTIAL_VAULT_STORAGE_KEY) || "";
    expect(encryptedVault).not.toContain("legacy-shop");
    expect(encryptedVault).not.toContain("legacy-secret");
  });

  it("migrates tracking settings to FedEx and persists another carrier", async () => {
    localStorage.setItem(
      "spf_tracking_provider_settings",
      JSON.stringify({ apiKey: " legacy-key " }),
    );
    const vault = useCredentialVaultStore();
    await vault.initialize();

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
