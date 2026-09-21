import { EventEmitter } from "node:events";
import type { H3Event } from "h3";
import { describe, expect, it } from "vitest";
import {
  createRequestAbortSignal,
  isRequestAbortError,
} from "~~/server/utils/request-abort";

function createEvent() {
  const request = Object.assign(new EventEmitter(), { aborted: false });
  const response = Object.assign(new EventEmitter(), { writableEnded: false });
  const event = { node: { req: request, res: response } } as unknown as H3Event;
  return { event, request, response };
}

describe("createRequestAbortSignal", () => {
  it("uses an identifiable control-flow error when the client disconnects", () => {
    const { event, response } = createEvent();
    const requestAbort = createRequestAbortSignal(event);

    response.emit("close");

    expect(requestAbort.signal.aborted).toBe(true);
    expect(isRequestAbortError(requestAbort.signal.reason)).toBe(true);
    expect(requestAbort.signal.reason).toMatchObject({
      name: "AbortError",
      code: "ERR_REQUEST_ABORTED",
    });
  });

  it("does not abort after a response finishes normally", () => {
    const { event, response } = createEvent();
    const requestAbort = createRequestAbortSignal(event);
    response.writableEnded = true;

    response.emit("close");

    expect(requestAbort.signal.aborted).toBe(false);
  });

  it("removes disconnect listeners when disposed", () => {
    const { event, request, response } = createEvent();
    const requestAbort = createRequestAbortSignal(event);

    requestAbort.dispose();
    request.emit("aborted");
    response.emit("close");

    expect(requestAbort.signal.aborted).toBe(false);
  });
});
