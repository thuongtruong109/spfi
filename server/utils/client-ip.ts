import { getRequestIP, type H3Event } from "h3";

export function resolveClientIp(event: H3Event, trustProxyHeaders: boolean) {
  return (
    getRequestIP(event, { xForwardedFor: trustProxyHeaders }) ||
    event.node.req.socket.remoteAddress ||
    "unknown"
  );
}
