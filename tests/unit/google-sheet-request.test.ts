import { describe, expect, it } from "vitest";
import {
  GOOGLE_SHEET_REQUEST_LIMITS,
  validateGoogleSheetBatchUpdate,
  validateGoogleSheetRange,
  validateGoogleSheetUpdate,
  validateGoogleSpreadsheetId,
} from "~~/server/utils/google-sheet-request";

describe("Google Sheet request limits", () => {
  it("accepts a small, well-formed update", () => {
    expect(
      validateGoogleSheetUpdate({ range: "Q1!A1:B1", values: [["a", 2]] }),
    ).toEqual({ range: "Q1!A1:B1", values: [["a", 2]] });
  });

  it("rejects malformed values as a bad request", () => {
    expect(() =>
      validateGoogleSheetUpdate({ range: "Q1!A1", values: [[{ unsafe: true }]] }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }));
    expect(() => validateGoogleSheetRange({ range: "A1" })).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(() => validateGoogleSpreadsheetId({ id: "sheet-1" })).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("returns 413 when batch, range, value, row, or cell limits are exceeded", () => {
    expect(() =>
      validateGoogleSheetBatchUpdate(
        Array.from({ length: GOOGLE_SHEET_REQUEST_LIMITS.batches + 1 }, (_, index) => ({
          range: `A${index + 1}`,
          values: [[index]],
        })),
      ),
    ).toThrowError(expect.objectContaining({ statusCode: 413 }));

    expect(() =>
      validateGoogleSheetRange(
        "A".repeat(GOOGLE_SHEET_REQUEST_LIMITS.rangeCharacters + 1),
      ),
    ).toThrowError(expect.objectContaining({ statusCode: 413 }));

    expect(() =>
      validateGoogleSpreadsheetId(
        "s".repeat(GOOGLE_SHEET_REQUEST_LIMITS.spreadsheetIdCharacters + 1),
      ),
    ).toThrowError(expect.objectContaining({ statusCode: 413 }));

    expect(() =>
      validateGoogleSheetUpdate({
        range: "A1",
        values: [["x".repeat(GOOGLE_SHEET_REQUEST_LIMITS.valueCharacters + 1)]],
      }),
    ).toThrowError(expect.objectContaining({ statusCode: 413 }));

    expect(() =>
      validateGoogleSheetBatchUpdate([
        { range: "A1", values: Array(6_000).fill([]) },
        { range: "A6001", values: Array(4_001).fill([]) },
      ]),
    ).toThrowError(expect.objectContaining({ statusCode: 413 }));

    expect(() =>
      validateGoogleSheetUpdate({
        range: "A1",
        values: Array.from({ length: GOOGLE_SHEET_REQUEST_LIMITS.rows + 1 }, () => []),
      }),
    ).toThrowError(expect.objectContaining({ statusCode: 413 }));

    expect(() =>
      validateGoogleSheetUpdate({
        range: "A1",
        values: [Array(GOOGLE_SHEET_REQUEST_LIMITS.cells + 1).fill(null)],
      }),
    ).toThrowError(expect.objectContaining({ statusCode: 413 }));
  });
});
