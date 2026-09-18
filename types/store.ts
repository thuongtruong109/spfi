export type StoreTab =
  | "transactions"
  | "payouts"
  | "disputes"
  | "orders"
  | "products"
  | "customers"
  | "markets"
  | "traffic"
  | "operations"
  | "profile";

export const DEFAULT_STORE_TAB: StoreTab = "transactions";

export const STORE_TABS: readonly StoreTab[] = [
  "transactions",
  "payouts",
  "disputes",
  "orders",
  "products",
  "customers",
  "markets",
  "traffic",
  "operations",
  "profile",
];

export function isStoreTab(value: unknown): value is StoreTab {
  return typeof value === "string" && STORE_TABS.includes(value as StoreTab);
}

export function resolveStoreTab(value: unknown): StoreTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isStoreTab(candidate) ? candidate : DEFAULT_STORE_TAB;
}
