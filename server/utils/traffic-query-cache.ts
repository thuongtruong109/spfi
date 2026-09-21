import { createHash } from "node:crypto";
import type {
  DashboardTrafficDimensionKey,
  DashboardTrafficRange,
  TrafficQueryDiagnostics,
} from "~~/types/traffic";

export interface TrafficCachePolicy {
  freshForMs: number;
  staleForMs: number;
}

interface TrafficCacheEntry<T extends TrafficQueryDiagnostics> {
  value: T;
  generatedAtMs: number;
  freshUntil: number;
  staleUntil: number;
  touchedAt: number;
}

interface TrafficCacheFlight<T extends TrafficQueryDiagnostics> {
  promise: Promise<TrafficCacheEntry<T>>;
  controller: AbortController;
  waiters: number;
}

interface ResolveTrafficQueryOptions<T extends TrafficQueryDiagnostics> {
  key: string;
  policy: TrafficCachePolicy;
  signal?: AbortSignal;
  refresh?: boolean;
  load: (signal: AbortSignal) => Promise<T>;
}

const MAX_TRAFFIC_CACHE_ENTRIES = 500;

export const TRAFFIC_OVERVIEW_CACHE_POLICY: TrafficCachePolicy = {
  // The overview includes the current hour and current day.
  freshForMs: 60_000,
  staleForMs: 15 * 60_000,
};

export const TRAFFIC_DIMENSION_CACHE_POLICIES: Record<
  DashboardTrafficRange,
  TrafficCachePolicy
> = {
  // Hour-level data changes most frequently.
  "24h": { freshForMs: 60_000, staleForMs: 60 * 60_000 },
  // Day-level ranges are more stable, but still include the current day.
  "7d": { freshForMs: 5 * 60_000, staleForMs: 6 * 60 * 60_000 },
  "30d": { freshForMs: 15 * 60_000, staleForMs: 24 * 60 * 60_000 },
};

export class TrafficQueryCache {
  private readonly entries = new Map<
    string,
    TrafficCacheEntry<TrafficQueryDiagnostics>
  >();
  private readonly flights = new Map<
    string,
    TrafficCacheFlight<TrafficQueryDiagnostics>
  >();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxEntries = MAX_TRAFFIC_CACHE_ENTRIES,
  ) {}

  async resolve<T extends TrafficQueryDiagnostics>({
    key,
    policy,
    signal,
    refresh = false,
    load,
  }: ResolveTrafficQueryOptions<T>): Promise<T> {
    throwIfAborted(signal);
    const now = this.now();
    const cached = this.entries.get(key) as TrafficCacheEntry<T> | undefined;
    if (!refresh && cached && cached.freshUntil > now) {
      cached.touchedAt = now;
      return withDiagnostics(cached, now, false);
    }

    let flight = this.flights.get(key) as TrafficCacheFlight<T> | undefined;
    if (flight?.controller.signal.aborted) {
      this.flights.delete(key);
      flight = undefined;
    }
    if (!refresh && cached && cached.staleUntil > now) {
      cached.touchedAt = now;
      if (!flight) {
        flight = this.startFlight(key, policy, load);
        void flight.promise.catch(() => undefined);
      }
      return withDiagnostics(cached, now, true);
    }
    if (!flight) {
      flight = this.startFlight(key, policy, load);
    }

    try {
      const entry = await waitForFlight(flight, signal);
      return withDiagnostics(entry, this.now(), false);
    } catch (error) {
      if (signal?.aborted) throw abortReason(signal);
      const fallback = this.entries.get(key) as TrafficCacheEntry<T> | undefined;
      const fallbackNow = this.now();
      if (fallback && fallback.staleUntil > fallbackNow) {
        fallback.touchedAt = fallbackNow;
        return withDiagnostics(fallback, fallbackNow, true);
      }
      throw error;
    }
  }

  clear() {
    for (const flight of this.flights.values()) flight.controller.abort();
    this.flights.clear();
    this.entries.clear();
  }

  private startFlight<T extends TrafficQueryDiagnostics>(
    key: string,
    policy: TrafficCachePolicy,
    load: (signal: AbortSignal) => Promise<T>,
  ): TrafficCacheFlight<T> {
    const controller = new AbortController();
    const flight = {
      controller,
      waiters: 0,
      promise: Promise.resolve(undefined as never),
    } as TrafficCacheFlight<T>;

    flight.promise = (async () => {
      try {
        // Defer the loader so this flight is registered even when it throws
        // synchronously.
        await Promise.resolve();
        const value = await load(controller.signal);
        throwIfAborted(controller.signal);
        const generatedAtMs = this.now();
        const entry: TrafficCacheEntry<T> = {
          value: {
            ...value,
            generatedAt: new Date(generatedAtMs).toISOString(),
            cacheAge: 0,
            isStale: false,
          },
          generatedAtMs,
          freshUntil: generatedAtMs + Math.max(0, policy.freshForMs),
          staleUntil: generatedAtMs + Math.max(policy.freshForMs, policy.staleForMs),
          touchedAt: generatedAtMs,
        };
        this.entries.set(key, entry);
        this.prune(generatedAtMs);
        return entry;
      } finally {
        if (this.flights.get(key) === flight) this.flights.delete(key);
      }
    })();

    this.flights.set(key, flight as TrafficCacheFlight<TrafficQueryDiagnostics>);
    return flight;
  }

  private prune(now: number) {
    for (const [key, entry] of this.entries) {
      if (entry.staleUntil <= now) this.entries.delete(key);
    }

    while (this.entries.size > Math.max(1, this.maxEntries)) {
      const oldest = [...this.entries.entries()].sort(
        ([, left], [, right]) => left.touchedAt - right.touchedAt,
      )[0]?.[0];
      if (!oldest) break;
      this.entries.delete(oldest);
    }
  }
}

export const trafficQueryCache = new TrafficQueryCache();

export function buildTrafficOverviewCacheKey(storeId: string, token: string) {
  return `overview:${credentialScope(storeId, token)}`;
}

export function buildTrafficDimensionCacheKey(
  storeId: string,
  token: string,
  range: DashboardTrafficRange,
  dimension: DashboardTrafficDimensionKey,
  timeZone?: string,
) {
  return `dimension:${credentialScope(storeId, token)}:${range}:${dimension}:${timeZone || "store"}`;
}

function credentialScope(storeId: string, token: string) {
  const tokenFingerprint = createHash("sha256")
    .update(String(token || ""))
    .digest("hex")
    .slice(0, 24);
  return `${String(storeId || "")
    .trim()
    .toLowerCase()}:${tokenFingerprint}`;
}

function withDiagnostics<T extends TrafficQueryDiagnostics>(
  entry: TrafficCacheEntry<T>,
  now: number,
  isStale: boolean,
): T {
  return {
    ...entry.value,
    generatedAt: new Date(entry.generatedAtMs).toISOString(),
    cacheAge: Math.max(0, Math.floor((now - entry.generatedAtMs) / 1_000)),
    isStale,
  };
}

function waitForFlight<T extends TrafficQueryDiagnostics>(
  flight: TrafficCacheFlight<T>,
  signal?: AbortSignal,
): Promise<TrafficCacheEntry<T>> {
  throwIfAborted(signal);
  flight.waiters += 1;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return false;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      flight.waiters = Math.max(0, flight.waiters - 1);
      return true;
    };
    const onAbort = () => {
      if (!finish()) return;
      if (flight.waiters === 0) flight.controller.abort();
      reject(signal ? abortReason(signal) : new DOMException("Aborted", "AbortError"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    flight.promise.then(
      (entry) => {
        if (finish()) resolve(entry);
      },
      (error) => {
        if (finish()) reject(error);
      },
    );
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortReason(signal);
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason || new DOMException("Aborted", "AbortError");
}
