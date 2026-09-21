import { defineNuxtPlugin } from "#imports";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "~/stores/form";
import { useRateLimitStore } from "~/stores/rateLimit";

const RATE_LIMIT_REQUEST = Symbol("rate-limit-request");

interface TrackedFetchOptions {
  [RATE_LIMIT_REQUEST]?: {
    storeId: string | null;
    sequence: number;
  };
}

function readStoreId(source: unknown): string | null {
  if (!source || typeof source !== "object" || !("storeId" in source)) {
    return null;
  }

  const value = (source as { storeId?: unknown }).storeId;
  return typeof value === "string" && value ? value : null;
}

export default defineNuxtPlugin(() => {
  const credentialVault = useCredentialVaultStore();
  const formStore = useFormStore();
  const rateLimit = useRateLimitStore();
  let requestSequence = 0;
  const customFetch = $fetch.create({
    onRequest({ request, options }) {
      if (typeof window === "undefined") return;

      if (!isInternalApiRequest(request)) return;

      let storeId =
        readStoreId(options.body) ||
        readStoreId(options.query) ||
        readStoreId(options.params);

      if (!storeId) {
        storeId = formStore.storeId || null;
      }

      (options as unknown as TrackedFetchOptions)[RATE_LIMIT_REQUEST] = {
        storeId,
        sequence: ++requestSequence,
      };

      if (storeId) {
        const storeData = credentialVault.getStoreData(storeId);
        const requestStoreData = {
          domain: storeData.domain,
          sock: storeData.sock,
          clientId: storeData.clientId,
          expiresTime: storeData.expiresTime,
        };
        if (Object.values(requestStoreData).some(Boolean)) {
          options.headers = new Headers(options.headers || {});
          options.headers.set(
            "x-store-data",
            encodeURIComponent(JSON.stringify(requestStoreData)),
          );
        }
      }
    },
    onResponse({ request, response, options }) {
      if (isInternalApiRequest(request)) {
        updateRateLimitFromResponse(rateLimit, response.headers, options, false);
      }
    },
    onResponseError({ request, response, options }) {
      if (isInternalApiRequest(request)) {
        updateRateLimitFromResponse(rateLimit, response.headers, options, true);
      }
    },
  });

  globalThis.$fetch = customFetch;

  return {
    provide: {
      fetch: customFetch,
    },
  };
});

function updateRateLimitFromResponse(
  rateLimit: ReturnType<typeof useRateLimitStore>,
  headers: Headers,
  options: unknown,
  failed: boolean,
) {
  const request = (options as unknown as TrackedFetchOptions)[RATE_LIMIT_REQUEST];
  rateLimit.updateFromHeaders(
    headers,
    Date.now(),
    request?.storeId || "",
    request?.sequence ?? Date.now(),
  );
  rateLimit.recordOperationalResponse(headers, failed);
}

function isInternalApiRequest(request: unknown) {
  if (typeof window === "undefined") return false;

  const rawUrl = readRequestUrl(request);
  if (!rawUrl) return false;

  try {
    const url = new URL(rawUrl, window.location.origin);
    return (
      url.origin === window.location.origin &&
      (url.pathname === "/api" || url.pathname.startsWith("/api/"))
    );
  } catch {
    return false;
  }
}

function readRequestUrl(request: unknown) {
  if (typeof request === "string") return request;
  if (request instanceof URL) return request.toString();
  if (typeof Request !== "undefined" && request instanceof Request) {
    return request.url;
  }
  return null;
}
