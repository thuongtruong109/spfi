import type { AppErrorLike } from "~~/types/shopify";

export function getAppErrorMessage(error: unknown, fallback: string) {
  const candidate = (error && typeof error === "object" ? error : {}) as AppErrorLike;
  const nestedMessage = candidate.data?.data?.error?.message;
  const standardMessage = candidate.data?.error?.message;
  const statusMessage = candidate.data?.statusMessage;
  const dataMessage = candidate.data?.message;
  const message = candidate.message;

  if (typeof nestedMessage === "string" && nestedMessage) {
    return nestedMessage;
  }

  if (typeof standardMessage === "string" && standardMessage) {
    return standardMessage;
  }

  if (typeof statusMessage === "string" && statusMessage) {
    return statusMessage;
  }

  if (typeof dataMessage === "string" && dataMessage) {
    return dataMessage;
  }

  if (typeof message === "string" && message) {
    return message;
  }

  return error instanceof Error ? error.message : fallback;
}

export function getAppErrorStatusCode(error: unknown): number | null {
  const candidate = asRecord(error);
  const data = asRecord(candidate?.data);
  const nestedData = asRecord(data?.data);
  const response = asRecord(candidate?.response);
  const standardError = asRecord(data?.error);
  const nestedStandardError = asRecord(nestedData?.error);
  const values = [
    candidate?.statusCode,
    candidate?.status,
    response?.status,
    data?.statusCode,
    data?.status,
    standardError?.status,
    nestedStandardError?.status,
  ];

  for (const value of values) {
    const statusCode = typeof value === "string" ? Number(value) : value;
    if (
      typeof statusCode === "number" &&
      Number.isInteger(statusCode) &&
      statusCode >= 100 &&
      statusCode <= 599
    ) {
      return statusCode;
    }
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}
