import type { H3Event } from "h3";

/** Mirrors a disconnected HTTP client into an AbortSignal for upstream calls. */
export function createRequestAbortSignal(event: H3Event) {
  const controller = new AbortController();
  const request = event.node?.req;
  const response = event.node?.res;

  const abort = () => {
    if (!controller.signal.aborted) controller.abort();
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
