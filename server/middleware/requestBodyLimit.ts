import { defineEventHandler, getRequestURL } from "h3";
import { enforceApiRequestBodyLimit } from "../utils/request-body-limit";

export default defineEventHandler(async (event) => {
  if (!getRequestURL(event).pathname.startsWith("/api/")) return;
  await enforceApiRequestBodyLimit(event);
});
