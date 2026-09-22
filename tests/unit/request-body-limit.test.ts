import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import requestBodyLimitHandler from "~~/server/middleware/requestBodyLimit";
import { MAX_API_BODY_BYTES } from "~~/server/utils/request-body-limit";

type TestEvent = {
  url: string;
  method: string;
  headers: Record<string, string>;
  node: { req: Readable & Record<PropertyKey, unknown> };
};

vi.mock("h3", () => ({
  createError: (input: Record<string, unknown>) => Object.assign(new Error(), input),
  defineEventHandler: <T>(handler: T) => handler,
  getHeader: (event: TestEvent, name: string) => event.headers[name.toLowerCase()],
  getRequestURL: (event: TestEvent) => new URL(event.url),
}));

function createEvent(chunks: Buffer[], headers: Record<string, string>): TestEvent {
  const request = Readable.from(chunks) as TestEvent["node"]["req"];
  return {
    url: "https://app.example/api/graphql",
    method: "POST",
    headers,
    node: { req: request },
  };
}

describe("API request body limit", () => {
  it("rejects an oversized declared body before reading it", async () => {
    const event = createEvent([], {
      "content-length": String(MAX_API_BODY_BYTES + 1),
    });

    await expect(requestBodyLimitHandler(event as never)).rejects.toMatchObject({
      statusCode: 413,
    });
  });

  it("rejects an oversized chunked body while it is streaming", async () => {
    const event = createEvent([Buffer.alloc(MAX_API_BODY_BYTES), Buffer.from("x")], {
      "transfer-encoding": "chunked",
    });

    await expect(requestBodyLimitHandler(event as never)).rejects.toMatchObject({
      statusCode: 413,
    });
  });

  it("caches an accepted body for the route readBody call", async () => {
    const event = createEvent([Buffer.from('{"ok":true}')], {
      "transfer-encoding": "chunked",
    });

    await requestBodyLimitHandler(event as never);

    const cached = await event.node.req[Symbol.for("h3RawBody")];
    expect(Buffer.isBuffer(cached)).toBe(true);
    expect((cached as Buffer).toString("utf8")).toBe('{"ok":true}');
  });
});
