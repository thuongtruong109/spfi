export type StoreDataResource =
  | "customers"
  | "disputes"
  | "locations"
  | "markets"
  | "orders"
  | "commerceOps"
  | "payment"
  | "products"
  | "profile"
  | "traffic";

const resourceLoadedAt = new Map<string, number>();
const MAX_RESOURCE_TIMESTAMPS = 64;

export function getStoreResourceLoadedAt(storeId: string, resource: StoreDataResource) {
  return resourceLoadedAt.get(cacheKey(storeId, resource));
}

export function markStoreResourceLoaded(
  storeId: string,
  resource: StoreDataResource,
  loadedAt = Date.now(),
) {
  const key = cacheKey(storeId, resource);
  resourceLoadedAt.delete(key);
  resourceLoadedAt.set(key, loadedAt);
  while (resourceLoadedAt.size > MAX_RESOURCE_TIMESTAMPS) {
    const oldest = resourceLoadedAt.keys().next().value;
    if (!oldest) break;
    resourceLoadedAt.delete(oldest);
  }
}

export function forgetStoreResource(storeId: string, resource: StoreDataResource) {
  resourceLoadedAt.delete(cacheKey(storeId, resource));
}

function cacheKey(storeId: string, resource: StoreDataResource) {
  return `${storeId}:${resource}`;
}
