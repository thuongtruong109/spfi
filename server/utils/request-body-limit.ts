import { createError, getHeader, type H3Event } from "h3";

export const MAX_API_BODY_BYTES = 2 * 1024 * 1024;

const RAW_BODY_SYMBOL = Symbol.for("h3RawBody");
const PAYLOAD_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type RequestWithCachedBody = H3Event["node"]["req"] & {
  [RAW_BODY_SYMBOL]?: Promise<Buffer>;
  rawBody?: unknown;
  body?: unknown;
};

type EventWithBodySource = {
  _requestBody?: unknown;
  web?: { request?: { body?: unknown } };
};

export async function enforceApiRequestBodyLimit(
  event: H3Event,
  maxBytes = MAX_API_BODY_BYTES,
) {
  const contentLength = parseContentLength(getHeader(event, "content-length"));
  if (contentLength !== null && contentLength > maxBytes) {
    throw payloadTooLarge(maxBytes);
  }

  if (!PAYLOAD_METHODS.has(event.method)) return;

  const transferEncoding = String(
    getHeader(event, "transfer-encoding") || "",
  ).toLowerCase();
  const request = event.node.req as RequestWithCachedBody;
  const extendedEvent = event as unknown as EventWithBodySource;
  const existingSource =
    extendedEvent._requestBody ??
    extendedEvent.web?.request?.body ??
    request[RAW_BODY_SYMBOL] ??
    request.rawBody ??
    request.body;

  if (existingSource !== undefined && existingSource !== null) {
    const body = await readBodySourceWithinLimit(existingSource, maxBytes);
    cacheRawBody(extendedEvent, request, body);
    return;
  }

  if (!contentLength && !transferEncoding.includes("chunked")) return;

  const bodyPromise = readNodeStreamWithinLimit(request, maxBytes);
  request[RAW_BODY_SYMBOL] = bodyPromise;
  const body = await bodyPromise;
  extendedEvent._requestBody = body;
}

function parseContentLength(value: string | undefined) {
  if (value === undefined || value === "") return null;
  if (!/^\d+$/.test(value.trim())) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid Content-Length",
    });
  }
  return Number(value);
}

async function readBodySourceWithinLimit(source: unknown, maxBytes: number) {
  const resolved = await source;
  if (isWebReadableStream(resolved)) {
    return readWebStreamWithinLimit(resolved, maxBytes);
  }
  if (isNodeReadableStream(resolved)) {
    return readNodeStreamWithinLimit(resolved, maxBytes);
  }

  const body = toBuffer(resolved);
  assertBodySize(body.length, maxBytes);
  return body;
}

function readNodeStreamWithinLimit(
  stream: NodeJS.ReadableStream,
  maxBytes: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let rejected = false;

    stream.on("data", (chunk: Buffer | string) => {
      if (rejected) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > maxBytes) {
        rejected = true;
        chunks.length = 0;
        reject(payloadTooLarge(maxBytes));
        return;
      }
      chunks.push(buffer);
    });
    stream.on("end", () => {
      if (!rejected) resolve(Buffer.concat(chunks, size));
    });
    stream.on("error", (error) => {
      if (!rejected) reject(error);
    });
  });
}

async function readWebStreamWithinLimit(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
) {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, size);
      const chunk = Buffer.from(value);
      size += chunk.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw payloadTooLarge(maxBytes);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
}

function cacheRawBody(
  event: EventWithBodySource,
  request: RequestWithCachedBody,
  body: Buffer,
) {
  event._requestBody = body;
  request[RAW_BODY_SYMBOL] = Promise.resolve(body);
}

function toBuffer(value: unknown) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value instanceof URLSearchParams) return Buffer.from(value.toString());
  if (typeof value === "string") return Buffer.from(value);
  if (value === undefined || value === null) return Buffer.alloc(0);
  return Buffer.from(JSON.stringify(value) ?? "");
}

function isNodeReadableStream(value: unknown): value is NodeJS.ReadableStream {
  return Boolean(
    value &&
    typeof value === "object" &&
    "on" in value &&
    typeof value.on === "function",
  );
}

function isWebReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
  return Boolean(
    value &&
    typeof value === "object" &&
    "getReader" in value &&
    typeof value.getReader === "function",
  );
}

function assertBodySize(size: number, maxBytes: number) {
  if (size > maxBytes) throw payloadTooLarge(maxBytes);
}

function payloadTooLarge(maxBytes: number) {
  return createError({
    statusCode: 413,
    statusMessage: "Payload Too Large",
    message: `Request body exceeds the ${maxBytes}-byte limit.`,
  });
}
