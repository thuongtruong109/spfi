import type { H3Event } from "h3";
import type { ShopifyShop } from "~~/types/shopify";
import { callShopifyApi, createApiErrorFromMessage } from "./callShopifyApi";

interface TrafficTimeZoneInput {
  event: H3Event;
  storeId: string;
  token: string;
  timeZone?: string;
  signal?: AbortSignal;
}

export function normalizeIanaTimeZone(value: unknown): string | null {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) return null;

  try {
    Intl.DateTimeFormat("en-US", { timeZone: candidate }).resolvedOptions();
    return candidate;
  } catch {
    return null;
  }
}

export function requireIanaTimeZone(value: unknown): string {
  const timeZone = normalizeIanaTimeZone(value);
  if (timeZone) return timeZone;

  throw createApiErrorFromMessage(
    "Shopify did not return a valid IANA timezone for this store.",
    502,
  );
}

export async function resolveShopifyTrafficTimeZone(
  input: TrafficTimeZoneInput,
): Promise<string> {
  input.signal?.throwIfAborted();
  if (input.timeZone !== undefined) return requireIanaTimeZone(input.timeZone);

  const response = await callShopifyApi<{ shop?: Pick<ShopifyShop, "iana_timezone"> }>({
    event: input.event,
    storeId: input.storeId,
    token: input.token,
    path: "/shop.json",
    params: { fields: "iana_timezone" },
    forwardResponseHeaders: false,
    signal: input.signal,
  });

  return requireIanaTimeZone(response.shop?.iana_timezone);
}

export function shopifyqlTimeZoneModifier(timeZone: string) {
  return `TIMEZONE '${requireIanaTimeZone(timeZone)}'`;
}
