export interface StoreScopeCache {
  hydrate(storeId: string): boolean;
  isStoreActive(storeId: string): boolean;
}

export function hydrateInactiveStoreScopes(
  storeId: string,
  scopes: StoreScopeCache[],
) {
  if (!storeId) return false;

  let hydrated = false;
  for (const scope of scopes) {
    if (scope.isStoreActive(storeId)) continue;
    scope.hydrate(storeId);
    hydrated = true;
  }
  return hydrated;
}
