import { setResponseHeader, type H3Event } from "h3";
import type { TrafficQueryDiagnostics } from "~~/types/traffic";

export function setTrafficDiagnosticsHeaders(
  event: H3Event,
  diagnostics: TrafficQueryDiagnostics,
) {
  if (diagnostics.cacheStatus) {
    setResponseHeader(event, "x-spf-cache-status", diagnostics.cacheStatus);
  }
  setResponseHeader(event, "x-spf-cache-age", diagnostics.cacheAge);
}
