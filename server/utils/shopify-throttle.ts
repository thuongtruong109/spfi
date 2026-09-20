const SHOPIFY_RECOMMENDED_BACKOFF_MS = 1_000;
const THROTTLE_STATE_TTL_MS = 5 * 60_000;
const REST_BUCKET_DRAIN_SECONDS = 20;
const REST_BACKOFF_THRESHOLD = 0.8;
const REST_BACKOFF_TARGET = 0.75;
export const MAX_SHOPIFY_THROTTLE_WAIT_MS = 30_000;

interface ShopifyThrottleGate {
  blockedUntil: number;
  touchedAt: number;
}

interface ShopifyGraphqlThrottleStatus {
  maximumAvailable?: unknown;
  currentlyAvailable?: unknown;
  restoreRate?: unknown;
}

interface ShopifyGraphqlCost {
  requestedQueryCost?: unknown;
  actualQueryCost?: unknown;
  throttleStatus?: ShopifyGraphqlThrottleStatus;
}

interface ShopifyqlCost {
  requestedQueryCost?: unknown;
  maximumAvailable?: unknown;
  currentlyAvailable?: unknown;
  windowResetAt?: unknown;
}

export interface ShopifyGraphqlExtensions {
  cost?: ShopifyGraphqlCost;
  shopifyqlCost?: ShopifyqlCost;
  [key: string]: unknown;
}

const throttleGates = new Map<string, ShopifyThrottleGate>();

export function buildShopifyThrottleKey(
  surface: "rest" | "graphql",
  domain: string,
  accessToken: string,
) {
  return `${surface}:${domain.toLowerCase()}:${accessToken}`;
}

export async function waitForShopifyThrottle(key: string, signal?: AbortSignal) {
  while (true) {
    signal?.throwIfAborted();
    const gate = throttleGates.get(key);
    if (!gate) return;

    const delayMs = gate.blockedUntil - Date.now();
    if (delayMs <= 0) {
      throttleGates.delete(key);
      return;
    }

    await wait(delayMs, signal);
  }
}

export function blockShopifyThrottle(key: string, delayMs: number) {
  if (!Number.isFinite(delayMs) || delayMs <= 0) return;

  const now = Date.now();
  cleanupThrottleGates(now);
  const blockedUntil = now + Math.ceil(delayMs);
  const current = throttleGates.get(key);

  throttleGates.set(key, {
    blockedUntil: Math.max(current?.blockedUntil || 0, blockedUntil),
    touchedAt: now,
  });
}

export function parseRetryAfterMs(value: unknown, now = Date.now()) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = String(rawValue ?? "").trim();
  if (!normalized) return null;

  const seconds = Number(normalized);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(1, Math.ceil(seconds * 1_000));
  }

  const retryAt = Date.parse(normalized);
  if (!Number.isFinite(retryAt)) return null;
  return Math.max(1, retryAt - now);
}

export function capShopifyThrottleDelayMs(delayMs: number) {
  return Math.min(MAX_SHOPIFY_THROTTLE_WAIT_MS, Math.max(1, Math.ceil(delayMs)));
}

export function parseShopifyRestCallLimit(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const match = String(rawValue ?? "")
    .trim()
    .match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;

  const used = Number(match[1]);
  const total = Number(match[2]);
  if (
    !Number.isSafeInteger(used) ||
    !Number.isSafeInteger(total) ||
    used < 0 ||
    total <= 0 ||
    used > total
  ) {
    return null;
  }

  return { used, total, remaining: total - used };
}

export function getRestCallLimitDelayMs(value: unknown) {
  const limit = parseShopifyRestCallLimit(value);
  if (!limit || limit.used / limit.total < REST_BACKOFF_THRESHOLD) return null;

  // Shopify REST buckets scale their capacity and leak rate together. Draining
  // from the current utilization to 75% leaves headroom for parallel callers.
  const targetUsed = Math.floor(limit.total * REST_BACKOFF_TARGET);
  const leakRatePerSecond = limit.total / REST_BUCKET_DRAIN_SECONDS;
  return Math.max(
    1,
    Math.ceil(((limit.used - targetUsed) / leakRatePerSecond) * 1_000),
  );
}

export function getGraphqlThrottleDelayMs(
  extensions?: ShopifyGraphqlExtensions,
  retryAfter?: unknown,
) {
  const headerDelay = parseRetryAfterMs(retryAfter);
  if (headerDelay !== null) return headerDelay;

  const cost = extensions?.cost;
  const status = cost?.throttleStatus;
  const requested = toFiniteNumber(cost?.requestedQueryCost);
  const available = toFiniteNumber(status?.currentlyAvailable);
  const restoreRate = toFiniteNumber(status?.restoreRate);

  if (restoreRate !== null && restoreRate > 0) {
    const deficit = Math.max(1, (requested ?? 1) - (available ?? 0));
    return Math.max(1, Math.ceil((deficit / restoreRate) * 1_000));
  }

  return SHOPIFY_RECOMMENDED_BACKOFF_MS;
}

export function isGraphqlThrottled(
  errors: Array<{ extensions?: Record<string, unknown> }> | undefined,
) {
  return Boolean(
    errors?.some(
      (error) => String(error.extensions?.code || "").toUpperCase() === "THROTTLED",
    ),
  );
}

export function getGraphqlThrottleStatus(extensions?: ShopifyGraphqlExtensions) {
  const status = extensions?.cost?.throttleStatus;
  if (!status) return null;

  return {
    maximumAvailable: toFiniteNumber(status.maximumAvailable),
    currentlyAvailable: toFiniteNumber(status.currentlyAvailable),
    restoreRate: toFiniteNumber(status.restoreRate),
  };
}

export function getGraphqlCostSummary(extensions?: ShopifyGraphqlExtensions) {
  const cost = extensions?.cost;
  if (!cost) return null;

  return {
    requestedQueryCost: toFiniteNumber(cost.requestedQueryCost),
    actualQueryCost: toFiniteNumber(cost.actualQueryCost),
  };
}

export function getShopifyqlCostSummary(extensions?: ShopifyGraphqlExtensions) {
  const cost = extensions?.shopifyqlCost;
  if (!cost) return null;

  const windowResetAt = String(cost.windowResetAt || "").trim();
  return {
    requestedQueryCost: toFiniteNumber(cost.requestedQueryCost),
    maximumAvailable: toFiniteNumber(cost.maximumAvailable),
    currentlyAvailable: toFiniteNumber(cost.currentlyAvailable),
    windowResetAt: windowResetAt || null,
  };
}

function cleanupThrottleGates(now: number) {
  for (const [key, gate] of throttleGates) {
    if (gate.blockedUntil <= now && now - gate.touchedAt >= THROTTLE_STATE_TTL_MS) {
      throttleGates.delete(key);
    }
  }
}

function toFiniteNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function wait(delayMs: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(finish, delayMs);
    const abort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason || new DOMException("Aborted", "AbortError"));
    };
    function finish() {
      signal?.removeEventListener("abort", abort);
      resolve();
    }

    signal?.addEventListener("abort", abort, { once: true });
  });
}
