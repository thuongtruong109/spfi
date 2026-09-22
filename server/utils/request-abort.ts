import type { H3Event } from "h3";

const REQUEST_ABORTED_CODE = "ERR_REQUEST_ABORTED";

/** Expected control-flow error raised when the HTTP client disconnects. */
export class RequestAbortedError extends Error {
  readonly code = REQUEST_ABORTED_CODE;

  constructor() {
    super("Client disconnected before the response completed.");
    this.name = "AbortError";
  }
}

export function isRequestAbortError(error: unknown): error is RequestAbortedError {
  return (
    error instanceof RequestAbortedError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === REQUEST_ABORTED_CODE)
  );
}

/** Mirrors a disconnected HTTP client into an AbortSignal for upstream calls. */
export function createRequestAbortSignal(event: H3Event) {
  const controller = new AbortController();
  const request = event.node?.req;
  const response = event.node?.res;

  const abort = () => {
    if (!controller.signal.aborted) controller.abort(new RequestAbortedError());
  };
  const abortOnPrematureClose = () => {
    if (!response?.writableEnded) abort();
  };

  if (request?.aborted) abort();
  request?.once?.("aborted", abort);
  response?.once?.("close", abortOnPrematureClose);

  return {
    signal: controller.signal,
    dispose() {
      request?.off?.("aborted", abort);
      response?.off?.("close", abortOnPrematureClose);
    },
  };
}
