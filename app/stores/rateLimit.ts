import { defineStore } from "pinia";
import { computed, ref } from "vue";

const API_RATE_LIMIT_HEADER_PREFIX = "x-ratelimit-api";
const FALLBACK_RATE_LIMIT_HEADER_PREFIX = "x-ratelimit";
const MAX_GRAPHQL_COST_STORES = 12;
const MAX_OPERATIONAL_SAMPLES = 100;

interface HeaderReader {
  get(name: string): string | null;
}

interface RateLimitSnapshot {
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface GraphqlCostSnapshot {
  limit: number;
  remaining: number;
  restoreRate: number;
  requestedCost: number | null;
  actualCost: number | null;
  observedAt: number;
  requestSequence: number;
}

interface OperationalSample {
  failed: boolean;
  cacheStatus: "hit" | "miss" | "stale" | null;
  queueLatencyMs: number | null;
}

export const useRateLimitStore = defineStore("rateLimit", () => {
  const limit = ref<number | null>(null);
  const remaining = ref<number | null>(null);
  const resetAt = ref<number | null>(null);
  const lastUpdatedAt = ref<number | null>(null);
  const graphqlCosts = ref<Record<string, GraphqlCostSnapshot>>({});
  const operationalSamples = ref<OperationalSample[]>([]);

  const isKnown = computed(
    () => limit.value !== null && remaining.value !== null && resetAt.value !== null,
  );
  const cacheSamples = computed(() =>
    operationalSamples.value.filter((sample) => sample.cacheStatus !== null),
  );
  const cacheHitRatio = computed<number | null>(() => {
    if (!cacheSamples.value.length) return null;
    const reusable = cacheSamples.value.filter(
      (sample) => sample.cacheStatus === "hit" || sample.cacheStatus === "stale",
    ).length;
    return (reusable / cacheSamples.value.length) * 100;
  });
  const errorRate = computed<number | null>(() => {
    if (!operationalSamples.value.length) return null;
    return (
      (operationalSamples.value.filter((sample) => sample.failed).length /
        operationalSamples.value.length) *
      100
    );
  });
  const averageQueueLatencyMs = computed<number | null>(() => {
    const values = operationalSamples.value.flatMap((sample) =>
      sample.queueLatencyMs === null ? [] : [sample.queueLatencyMs],
    );
    return values.length
      ? values.reduce((total, value) => total + value, 0) / values.length
      : null;
  });

  function updateFromHeaders(
    headers: HeaderReader,
    observedAt = Date.now(),
    storeId = "",
    requestSequence = observedAt,
  ) {
    const next =
      readSnapshot(headers, API_RATE_LIMIT_HEADER_PREFIX) ||
      readSnapshot(headers, FALLBACK_RATE_LIMIT_HEADER_PREFIX);
    let didUpdate = false;

    if (next && shouldAcceptSnapshot(next)) {
      limit.value = next.limit;
      remaining.value = next.remaining;
      resetAt.value = next.resetAt;
      lastUpdatedAt.value = observedAt;
      didUpdate = true;
    }

    const normalizedStoreId = String(storeId || "").trim();
    const graphqlCost = readGraphqlCostSnapshot(headers, observedAt, requestSequence);
    if (normalizedStoreId && graphqlCost) {
      const current = graphqlCosts.value[normalizedStoreId];
      if (!current || graphqlCost.requestSequence >= current.requestSequence) {
        const nextCosts = {
          ...graphqlCosts.value,
          [normalizedStoreId]: graphqlCost,
        };
        const staleStoreIds = Object.entries(nextCosts)
          .sort((left, right) => right[1].observedAt - left[1].observedAt)
          .slice(MAX_GRAPHQL_COST_STORES)
          .map(([id]) => id);
        for (const id of staleStoreIds) delete nextCosts[id];
        graphqlCosts.value = nextCosts;
        didUpdate = true;
      }
    }

    return didUpdate;
  }

  function shouldAcceptSnapshot(next: RateLimitSnapshot) {
    if (resetAt.value === null || limit.value === null || remaining.value === null) {
      return true;
    }

    if (next.resetAt !== resetAt.value) {
      return next.resetAt > resetAt.value;
    }

    if (next.limit !== limit.value) {
      return next.remaining / next.limit <= remaining.value / limit.value;
    }

    // Concurrent responses can arrive out of order. Within one fixed window,
    // remaining quota can only stay level or decrease.
    return next.remaining <= remaining.value;
  }

  function recordOperationalResponse(headers: HeaderReader, failed: boolean) {
    const cacheStatus = readCacheStatus(headers.get("x-spf-cache-status"));
    const queueLatencyMs = readNonNegativeNumber(
      headers.get("x-spf-shopify-queue-latency-ms"),
    );
    operationalSamples.value = [
      ...operationalSamples.value,
      { failed, cacheStatus, queueLatencyMs },
    ].slice(-MAX_OPERATIONAL_SAMPLES);
  }

  return {
    limit,
    remaining,
    resetAt,
    lastUpdatedAt,
    isKnown,
    graphqlCosts,
    cacheHitRatio,
    errorRate,
    averageQueueLatencyMs,
    updateFromHeaders,
    recordOperationalResponse,
  };
});

function readSnapshot(headers: HeaderReader, prefix: string): RateLimitSnapshot | null {
  const limit = readPositiveInteger(headers.get(`${prefix}-limit`));
  const remaining = readNonNegativeInteger(headers.get(`${prefix}-remaining`));
  const resetAtSeconds = readPositiveInteger(headers.get(`${prefix}-reset`));

  if (limit === null || remaining === null || resetAtSeconds === null) {
    return null;
  }

  return {
    limit,
    remaining: Math.min(remaining, limit),
    resetAt: resetAtSeconds * 1_000,
  };
}

function readPositiveInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function readNonNegativeInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function readGraphqlCostSnapshot(
  headers: HeaderReader,
  observedAt: number,
  requestSequence: number,
): GraphqlCostSnapshot | null {
  const limit = readPositiveNumber(headers.get("x-shopify-graphql-maximum-available"));
  const remaining = readNonNegativeNumber(
    headers.get("x-shopify-graphql-currently-available"),
  );
  const restoreRate = readNonNegativeNumber(
    headers.get("x-shopify-graphql-restore-rate"),
  );

  if (limit === null || remaining === null || restoreRate === null) return null;

  return {
    limit,
    remaining: Math.min(remaining, limit),
    restoreRate,
    requestedCost: readNonNegativeNumber(
      headers.get("x-shopify-graphql-requested-cost"),
    ),
    actualCost: readNonNegativeNumber(headers.get("x-shopify-graphql-actual-cost")),
    observedAt,
    requestSequence: Number.isSafeInteger(requestSequence)
      ? requestSequence
      : Math.trunc(observedAt),
  };
}

function readPositiveNumber(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readNonNegativeNumber(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function readCacheStatus(value: string | null): OperationalSample["cacheStatus"] {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "hit" || normalized === "miss" || normalized === "stale"
    ? normalized
    : null;
}
