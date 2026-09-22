export const DEFAULT_WEBHOOK_STREAM_LIMITS = {
  total: 100,
  perIp: 10,
  perShop: 5,
  maxLifetimeSeconds: 30 * 60,
} as const;

export interface WebhookStreamLimits {
  total: number;
  perIp: number;
  perShop: number;
  maxLifetimeMs: number;
}

type AcquireResult =
  | { acquired: true; release: () => void }
  | { acquired: false; scope: "process" | "ip" | "shop" };

export class WebhookStreamLimiter {
  private active = 0;
  private readonly byIp = new Map<string, number>();
  private readonly byShop = new Map<string, number>();

  acquire(input: {
    ip: string;
    shopDomains: Iterable<string>;
    limits: WebhookStreamLimits;
  }): AcquireResult {
    const shopDomains = [...new Set(input.shopDomains)];
    if (this.active >= input.limits.total) {
      return { acquired: false, scope: "process" };
    }
    if ((this.byIp.get(input.ip) || 0) >= input.limits.perIp) {
      return { acquired: false, scope: "ip" };
    }
    if (
      shopDomains.some(
        (shopDomain) => (this.byShop.get(shopDomain) || 0) >= input.limits.perShop,
      )
    ) {
      return { acquired: false, scope: "shop" };
    }

    this.active += 1;
    increment(this.byIp, input.ip);
    for (const shopDomain of shopDomains) increment(this.byShop, shopDomain);

    let released = false;
    return {
      acquired: true,
      release: () => {
        if (released) return;
        released = true;
        this.active = Math.max(0, this.active - 1);
        decrement(this.byIp, input.ip);
        for (const shopDomain of shopDomains) decrement(this.byShop, shopDomain);
      },
    };
  }
}

export const webhookStreamLimiter = new WebhookStreamLimiter();

export function resolveWebhookStreamLimits(config: Record<string, unknown>) {
  return {
    total: positiveInteger(
      config.webhookStreamMaxConnections,
      DEFAULT_WEBHOOK_STREAM_LIMITS.total,
      10_000,
    ),
    perIp: positiveInteger(
      config.webhookStreamMaxConnectionsPerIp,
      DEFAULT_WEBHOOK_STREAM_LIMITS.perIp,
      1_000,
    ),
    perShop: positiveInteger(
      config.webhookStreamMaxConnectionsPerShop,
      DEFAULT_WEBHOOK_STREAM_LIMITS.perShop,
      1_000,
    ),
    maxLifetimeMs:
      positiveInteger(
        config.webhookStreamMaxLifetimeSeconds,
        DEFAULT_WEBHOOK_STREAM_LIMITS.maxLifetimeSeconds,
        24 * 60 * 60,
      ) * 1_000,
  } satisfies WebhookStreamLimits;
}

function positiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(maximum, Math.floor(parsed));
}

function increment(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) || 0) + 1);
}

function decrement(counts: Map<string, number>, key: string) {
  const next = (counts.get(key) || 0) - 1;
  if (next > 0) counts.set(key, next);
  else counts.delete(key);
}
