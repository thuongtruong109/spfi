import { setResponseHeader, type H3Event } from "h3";

const SHOPIFY_QUEUE_LATENCY_KEY = "spfShopifyQueueLatencyMs";

export function recordShopifyQueueLatency(event: H3Event, latencyMs: number) {
  const duration = Math.max(0, Math.round(latencyMs));
  const context = event.context as Record<string, unknown> | undefined;
  if (!context || !event.node?.res) return;
  const current = Number(context[SHOPIFY_QUEUE_LATENCY_KEY] || 0);
  const total = Math.max(0, current) + duration;
  context[SHOPIFY_QUEUE_LATENCY_KEY] = total;
  setResponseHeader(event, "x-spf-shopify-queue-latency-ms", total);
}
