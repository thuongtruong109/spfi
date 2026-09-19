import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTrafficStore } from "~/stores/traffic";
import type { DashboardTrafficSummary } from "~~/types/dashboard";
import {
  createTrafficMetrics,
  emptyDashboardTraffic,
} from "~~/utils/dashboard-traffic";
import { hydrateInactiveStoreScopes } from "~~/utils/store-scope";

function trafficFixture(): DashboardTrafficSummary {
  return {
    ...emptyDashboardTraffic(),
    available: true,
    availableStores: 1,
    last24Hours: createTrafficMetrics({
      sessions: 43,
      visitors: 42,
      pageviews: 45,
    }),
  };
}

describe("store scope hydration", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("does not invalidate an in-flight request when the same scope hydrates again", async () => {
    let resolveRequest!: (traffic: DashboardTrafficSummary) => void;
    const request = new Promise<DashboardTrafficSummary>((resolve) => {
      resolveRequest = resolve;
    });
    vi.stubGlobal("$fetch", vi.fn(() => request));
    const trafficStore = useTrafficStore();

    expect(trafficStore.hydrate("shop-a")).toBe(false);
    const pending = trafficStore.fetchTraffic("shop-a", "token-a");

    expect(hydrateInactiveStoreScopes("shop-a", [trafficStore])).toBe(false);
    resolveRequest(trafficFixture());

    expect(await pending).toBe(true);
    expect(trafficStore.hasFetched).toBe(true);
    expect(trafficStore.traffic.available).toBe(true);
    expect(trafficStore.traffic.last24Hours.sessions).toBe(43);
  });

  it("hydrates only scopes that are not already active", () => {
    const activeScope = {
      hydrate: vi.fn(() => true),
      isStoreActive: vi.fn(() => true),
    };
    const inactiveScope = {
      hydrate: vi.fn(() => false),
      isStoreActive: vi.fn(() => false),
    };

    expect(
      hydrateInactiveStoreScopes("shop-a", [activeScope, inactiveScope]),
    ).toBe(true);
    expect(activeScope.hydrate).not.toHaveBeenCalled();
    expect(inactiveScope.hydrate).toHaveBeenCalledOnce();
    expect(inactiveScope.hydrate).toHaveBeenCalledWith("shop-a");
  });
});
