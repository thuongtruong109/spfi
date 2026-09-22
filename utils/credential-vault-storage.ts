const VAULT_VERSION = 1;
const VAULT_ALGORITHM = "AES-GCM";
const VAULT_AAD = new TextEncoder().encode("spf:credential-vault:v1");
// These are stable storage schema identifiers, not encryption-key material.
const KEY_DATABASE_NAME = "spf-secure-storage";
const KEY_OBJECT_STORE_NAME = "crypto-keys";
const DEVICE_KEY_RECORD_ID = "credential-vault-v1";
const KEY_DATABASE_OPEN_TIMEOUT_MS = 5_000;

export const CREDENTIAL_VAULT_STORAGE_KEY = "spf_credential_vault";

interface EncryptedVaultEnvelope {
  version: typeof VAULT_VERSION;
  algorithm: typeof VAULT_ALGORITHM;
  iv: string;
  ciphertext: string;
}

let cachedVaultKey: CryptoKey | null = null;

export async function readEncryptedCredentialVault(): Promise<unknown | null> {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(CREDENTIAL_VAULT_STORAGE_KEY);
  if (!raw) return null;

  const envelope = parseEnvelope(raw);
  const key = await getOrCreateVaultKey();

  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: VAULT_ALGORITHM,
        iv: fromBase64(envelope.iv),
        additionalData: VAULT_AAD,
      },
      key,
      fromBase64(envelope.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
  } catch {
    throw new Error(
      "The local credential vault could not be decrypted. Its device key may be missing or the stored data may be corrupted.",
    );
  }
}

export async function writeEncryptedCredentialVault(value: unknown): Promise<void> {
  if (typeof window === "undefined") return;

  const key = await getOrCreateVaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: VAULT_ALGORITHM,
      iv,
      additionalData: VAULT_AAD,
    },
    key,
    plaintext,
  );
  const envelope: EncryptedVaultEnvelope = {
    version: VAULT_VERSION,
    algorithm: VAULT_ALGORITHM,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };

  localStorage.setItem(CREDENTIAL_VAULT_STORAGE_KEY, JSON.stringify(envelope));
}

function parseEnvelope(raw: string): EncryptedVaultEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("The local credential vault contains invalid JSON.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as Partial<EncryptedVaultEnvelope>).version !== VAULT_VERSION ||
    (parsed as Partial<EncryptedVaultEnvelope>).algorithm !== VAULT_ALGORITHM ||
    typeof (parsed as Partial<EncryptedVaultEnvelope>).iv !== "string" ||
    typeof (parsed as Partial<EncryptedVaultEnvelope>).ciphertext !== "string"
  ) {
    throw new Error("The local credential vault has an unsupported format.");
  }

  return parsed as EncryptedVaultEnvelope;
}

async function getOrCreateVaultKey(): Promise<CryptoKey> {
  assertWebCryptoAvailable();

  if (cachedVaultKey) return cachedVaultKey;

  if (typeof indexedDB !== "undefined") {
    cachedVaultKey = await getOrCreateIndexedDbKey();
    return cachedVaultKey;
  }

  if (localStorage.getItem(CREDENTIAL_VAULT_STORAGE_KEY)) {
    throw new Error(
      "The encrypted credential vault cannot be reopened because IndexedDB is unavailable.",
    );
  }

  // Non-persistent environments such as isolated tests can still use an
  // in-memory, non-exportable key for the lifetime of the current page.
  cachedVaultKey = await crypto.subtle.generateKey(
    { name: VAULT_ALGORITHM, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return cachedVaultKey;
}

function assertWebCryptoAvailable() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error("Secure browser storage requires Web Crypto support.");
  }
}

async function getOrCreateIndexedDbKey(): Promise<CryptoKey> {
  const generatedKey = await crypto.subtle.generateKey(
    { name: VAULT_ALGORITHM, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const database = await openKeyDatabase();

  try {
    return await new Promise<CryptoKey>((resolve, reject) => {
      const transaction = database.transaction(KEY_OBJECT_STORE_NAME, "readwrite");
      const keyStore = transaction.objectStore(KEY_OBJECT_STORE_NAME);
      const request = keyStore.get(DEVICE_KEY_RECORD_ID);

      request.onerror = () => reject(request.error || new Error("Key read failed."));
      request.onsuccess = () => {
        const existing = request.result;
        if (isCryptoKey(existing)) {
          resolve(existing);
          return;
        }

        const writeRequest = keyStore.put(generatedKey, DEVICE_KEY_RECORD_ID);
        writeRequest.onerror = () =>
          reject(writeRequest.error || new Error("Key write failed."));
        writeRequest.onsuccess = () => resolve(generatedKey);
      };
    });
  } finally {
    database.close();
  }
}

function openKeyDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let isSettled = false;
    const settleWithError = (error: Error) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      reject(error);
    };
    const settleWithDatabase = (database: IDBDatabase) => {
      if (isSettled) {
        database.close();
        return;
      }
      isSettled = true;
      clearTimeout(timeout);
      resolve(database);
    };
    const timeout = setTimeout(
      () =>
        settleWithError(
          new Error("Secure key storage did not become available in time."),
        ),
      KEY_DATABASE_OPEN_TIMEOUT_MS,
    );
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(KEY_DATABASE_NAME, 1);
    } catch (error) {
      settleWithError(
        error instanceof Error
          ? error
          : new Error("Secure key database could not be opened."),
      );
      return;
    }
    request.onerror = () =>
      settleWithError(
        request.error || new Error("Secure key database could not be opened."),
      );
    request.onblocked = () =>
      settleWithError(new Error("Secure key storage is blocked by another tab."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(KEY_OBJECT_STORE_NAME)) {
        database.createObjectStore(KEY_OBJECT_STORE_NAME);
      }
    };
    request.onsuccess = () => settleWithDatabase(request.result);
  });
}

function isCryptoKey(value: unknown): value is CryptoKey {
  return typeof CryptoKey !== "undefined" && value instanceof CryptoKey;
}

function toBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("The local credential vault contains invalid base64 data.");
  }
}
