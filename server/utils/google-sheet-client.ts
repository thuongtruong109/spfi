import { google } from "googleapis";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createApiErrorFromMessage } from "./callShopifyApi";
import {
  validateGoogleSheetRange,
  validateGoogleSpreadsheetId,
} from "./google-sheet-request";

type ServiceAccountFile = {
  client_email?: string;
  private_key?: string;
};

let cachedServiceAccount: ServiceAccountFile | null = null;

export const GOOGLE_SHEET_SCOPES = {
  readonly: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  readwrite: ["https://www.googleapis.com/auth/spreadsheets"],
} as const;

export function requireSpreadsheetId(value?: string) {
  return validateGoogleSpreadsheetId(value);
}

export function resolveSheetRange(value?: string) {
  return validateGoogleSheetRange(value) || "A:Z";
}

export async function createGoogleSheetsClient(scopes: readonly string[]) {
  const serviceAccount = await readServiceAccountFile();
  const clientEmail = String(serviceAccount.client_email || "");
  const privateKey = String(serviceAccount.private_key || "").replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw createApiErrorFromMessage(
      "Missing client_email/private_key in server/service_account.json",
      500,
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [...scopes],
  });

  return google.sheets({ version: "v4", auth });
}

async function readServiceAccountFile() {
  if (cachedServiceAccount) return cachedServiceAccount;

  const filePath = join(process.cwd(), "server", "service_account.json");

  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as ServiceAccountFile;
    cachedServiceAccount = parsed;
    return parsed;
  } catch (error) {
    throw createApiErrorFromMessage(
      getErrorCode(error) === "ENOENT"
        ? "Missing service account file at server/service_account.json"
        : "Invalid service account file format in server/service_account.json",
      500,
    );
  }
}

function getErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error
    ? String(error.code)
    : "";
}
