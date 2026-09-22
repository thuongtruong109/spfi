import { defineEventHandler, readBody } from "h3";
import { createApiError } from "../../utils/callShopifyApi";
import {
  createGoogleSheetsClient,
  GOOGLE_SHEET_SCOPES,
  requireSpreadsheetId,
} from "../../utils/google-sheet-client";
import { GOOGLE_SHEET_VALUE_INPUT_OPTION } from "../../utils/google-sheet-values";
import {
  type GoogleSheetValueRange,
  validateGoogleSheetBatchUpdate,
} from "../../utils/google-sheet-request";

type BatchUpdateBody = {
  spreadsheetId?: string;
  data: GoogleSheetValueRange[];
};

export default defineEventHandler(async (event) => {
  const body = (await readBody<BatchUpdateBody>(event)) || {};
  const spreadsheetId = requireSpreadsheetId(body.spreadsheetId);
  const data = validateGoogleSheetBatchUpdate(body.data);

  try {
    const sheets = await createGoogleSheetsClient(GOOGLE_SHEET_SCOPES.readwrite);
    const response = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: GOOGLE_SHEET_VALUE_INPUT_OPTION,
        data,
      },
    });

    return {
      success: true,
      totalUpdatedCells: response.data.totalUpdatedCells,
      totalUpdatedRows: response.data.totalUpdatedRows,
    };
  } catch (error) {
    throw createApiError(error, "Failed to batch update data via Google Sheet API.");
  }
});
