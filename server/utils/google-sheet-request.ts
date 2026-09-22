import { createStandardApiErrorFromMessage } from "./api-error";

export const GOOGLE_SHEET_REQUEST_LIMITS = {
  batches: 100,
  rows: 10_000,
  cells: 50_000,
  spreadsheetIdCharacters: 256,
  rangeCharacters: 512,
  valueCharacters: 50_000,
} as const;

export type GoogleSheetCellValue = string | number | boolean | null;

export interface GoogleSheetValueRange {
  range: string;
  values: GoogleSheetCellValue[][];
}

export function validateGoogleSpreadsheetId(input: unknown) {
  if (input !== undefined && input !== null && typeof input !== "string") {
    throw invalidRequest("spreadsheetId must be a string.");
  }
  const spreadsheetId = String(input ?? "").trim();
  if (!spreadsheetId) {
    throw invalidRequest("Missing spreadsheetId.");
  }
  if (spreadsheetId.length > GOOGLE_SHEET_REQUEST_LIMITS.spreadsheetIdCharacters) {
    throw limitExceeded(
      `spreadsheetId can contain at most ${GOOGLE_SHEET_REQUEST_LIMITS.spreadsheetIdCharacters} characters.`,
    );
  }
  return spreadsheetId;
}

export function validateGoogleSheetUpdate(input: {
  range?: unknown;
  values?: unknown;
}): GoogleSheetValueRange {
  const range = validateGoogleSheetRange(input.range, { required: true });
  const values = validateValues(input.values, { rows: 0, cells: 0 });
  return { range, values };
}

export function validateGoogleSheetBatchUpdate(
  input: unknown,
): GoogleSheetValueRange[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw invalidRequest("A non-empty data array is required.");
  }
  if (input.length > GOOGLE_SHEET_REQUEST_LIMITS.batches) {
    throw limitExceeded(
      `A batch update can contain at most ${GOOGLE_SHEET_REQUEST_LIMITS.batches} ranges.`,
    );
  }

  const counts = { rows: 0, cells: 0 };
  return input.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw invalidRequest("Each batch entry must be an object.");
    }
    const candidate = entry as { range?: unknown; values?: unknown };
    return {
      range: validateGoogleSheetRange(candidate.range, { required: true }),
      values: validateValues(candidate.values, counts),
    };
  });
}

export function validateGoogleSheetRange(
  input: unknown,
  options: { required?: boolean } = {},
) {
  if (input !== undefined && input !== null && typeof input !== "string") {
    throw invalidRequest("A Google Sheet range must be a string.");
  }
  const range = String(input ?? "").trim();
  if (!range && options.required) {
    throw invalidRequest("A Google Sheet range is required.");
  }
  if (range.length > GOOGLE_SHEET_REQUEST_LIMITS.rangeCharacters) {
    throw limitExceeded(
      `A Google Sheet range can contain at most ${GOOGLE_SHEET_REQUEST_LIMITS.rangeCharacters} characters.`,
    );
  }
  return range;
}

function validateValues(
  input: unknown,
  counts: { rows: number; cells: number },
): GoogleSheetCellValue[][] {
  if (!Array.isArray(input) || input.length === 0) {
    throw invalidRequest("A non-empty values array is required.");
  }

  counts.rows += input.length;
  if (counts.rows > GOOGLE_SHEET_REQUEST_LIMITS.rows) {
    throw limitExceeded(
      `A Google Sheet update can contain at most ${GOOGLE_SHEET_REQUEST_LIMITS.rows} rows.`,
    );
  }

  return input.map((row) => {
    if (!Array.isArray(row)) {
      throw invalidRequest("Each values entry must be a row array.");
    }
    counts.cells += row.length;
    if (counts.cells > GOOGLE_SHEET_REQUEST_LIMITS.cells) {
      throw limitExceeded(
        `A Google Sheet update can contain at most ${GOOGLE_SHEET_REQUEST_LIMITS.cells} cells.`,
      );
    }
    return row.map((value) => validateCellValue(value));
  });
}

function validateCellValue(value: unknown): GoogleSheetCellValue {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    throw invalidRequest("Google Sheet numeric values must be finite.");
  }
  if (typeof value === "string") {
    if (value.length > GOOGLE_SHEET_REQUEST_LIMITS.valueCharacters) {
      throw limitExceeded(
        `A Google Sheet value can contain at most ${GOOGLE_SHEET_REQUEST_LIMITS.valueCharacters} characters.`,
      );
    }
    return value;
  }
  throw invalidRequest(
    "Google Sheet values must be strings, numbers, booleans, or null.",
  );
}

function invalidRequest(message: string) {
  return createStandardApiErrorFromMessage(message, 400);
}

function limitExceeded(message: string) {
  return createStandardApiErrorFromMessage(message, 413);
}
