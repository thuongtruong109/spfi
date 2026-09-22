import type { H3Event } from "h3";
import {
  callShopifyApiWithResponse,
  createApiErrorFromMessage,
} from "./callShopifyApi";
import {
  buildShopifyCursorPageParams,
  getShopifyPageInfo,
  type ShopifyPageInfo,
} from "./shopify-pagination";
import {
  reportShopifyContractError,
  ShopifyContractError,
} from "./shopify-contract-error";

type ShopifyQueryParams = Record<string, unknown>;

export interface CallShopifyPaginatedApiOptions<TItem> {
  event: H3Event;
  storeId: string;
  token?: string;
  path: string;
  resourceKey: string;
  params?: ShopifyQueryParams;
  missingProxyMessage?: string;
  mapItem?: (item: unknown) => TItem;
  preserveUnsafeIntegers?: boolean;
  forwardResponseHeaders?: boolean;
}

export interface ShopifyPaginatedPage<TItem> {
  items: TItem[];
  pageInfo: ShopifyPageInfo;
}

const MAX_PAGE_SIZE = 250;

interface CallShopifyPaginatedPageOptions<
  TItem,
> extends CallShopifyPaginatedApiOptions<TItem> {
  cursor?: string | null;
  pageSize?: number;
}

export async function callShopifyPaginatedApiPage<TItem>({
  cursor = null,
  pageSize = MAX_PAGE_SIZE,
  ...options
}: CallShopifyPaginatedPageOptions<TItem>): Promise<ShopifyPaginatedPage<TItem>> {
  const requestedPageSize = Number(pageSize);
  const safePageSize = Number.isFinite(requestedPageSize)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(requestedPageSize)))
    : MAX_PAGE_SIZE;
  const params = options.params || {};
  const requestParams = cursor
    ? buildShopifyCursorPageParams(params, cursor, safePageSize)
    : { ...params, limit: safePageSize };
  const response = await callShopifyApiWithResponse<Record<string, unknown>>({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    path: options.path,
    params: requestParams,
    missingProxyMessage: options.missingProxyMessage,
    preserveUnsafeIntegers: options.preserveUnsafeIntegers ?? true,
    forwardResponseHeaders: options.forwardResponseHeaders ?? true,
  });
  let itemIndex: number | undefined;
  try {
    const data = response.data;
    const rawItems =
      data && typeof data === "object" && !Array.isArray(data)
        ? data[options.resourceKey]
        : undefined;
    if (!Array.isArray(rawItems)) {
      throw new ShopifyContractError(
        `Shopify response is missing the "${options.resourceKey}" list.`,
        options.resourceKey,
        "an array",
      );
    }

    const mapItem = options.mapItem || ((item: unknown) => item as TItem);
    const items = rawItems.map((item, index) => {
      itemIndex = index;
      return mapItem(item);
    });
    return { items, pageInfo: getShopifyPageInfo(response.headers) };
  } catch (error) {
    reportShopifyContractError(
      error,
      response.headers["x-request-id"],
      options.resourceKey,
      itemIndex,
    );
    throw error;
  }
}

export async function callShopifyPaginatedApi<TItem>(
  options: CallShopifyPaginatedApiOptions<TItem>,
): Promise<TItem[]> {
  const items: TItem[] = [];

  for await (const page of iterateShopifyPaginatedApi(options)) {
    items.push(...page.items);
  }

  return items;
}

export async function* iterateShopifyPaginatedApi<TItem>({
  event,
  storeId,
  token,
  path,
  resourceKey,
  params = {},
  missingProxyMessage,
  mapItem = (item) => item as TItem,
  preserveUnsafeIntegers = true,
  forwardResponseHeaders = true,
}: CallShopifyPaginatedApiOptions<TItem>): AsyncGenerator<ShopifyPaginatedPage<TItem>> {
  const visitedCursors = new Set<string>();
  let cursor: string | null = null;

  while (true) {
    const page: ShopifyPaginatedPage<TItem> = await callShopifyPaginatedApiPage({
      event,
      storeId,
      token,
      path,
      resourceKey,
      params,
      missingProxyMessage,
      mapItem,
      preserveUnsafeIntegers,
      forwardResponseHeaders,
      cursor,
      pageSize: MAX_PAGE_SIZE,
    });
    yield page;

    if (!page.pageInfo.nextCursor) break;
    if (visitedCursors.has(page.pageInfo.nextCursor)) {
      throw createApiErrorFromMessage(
        "Shopify returned a repeated pagination cursor.",
        502,
      );
    }

    visitedCursors.add(page.pageInfo.nextCursor);
    cursor = page.pageInfo.nextCursor;
  }
}
