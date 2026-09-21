const TOKEN_ROTATION_LEASE_MS = 2 * 60 * 1_000;
const TOKEN_ROTATION_LEASE_PREFIX = "spf_token_rotation_lease:";

export const TOKEN_ROTATION_SWEEP_LEASE_ID = "$auto-sweep";

interface TokenRotationLease {
  owner?: string;
  expiresAt?: number;
}

export function acquireTokenRotationLease(storeId: string) {
  if (typeof window === "undefined") return false;

  const key = getLeaseKey(storeId);
  const now = Date.now();
  const existing = readLease(key);
  if (existing?.owner && Number(existing.expiresAt) > now) return false;

  const owner = getTokenRotationLeaseOwner();
  writeLease(key, owner, now);
  return readLease(key)?.owner === owner;
}

export function renewTokenRotationLease(storeId: string) {
  if (typeof window === "undefined") return false;

  const key = getLeaseKey(storeId);
  const owner = getTokenRotationLeaseOwner();
  if (readLease(key)?.owner !== owner) return false;

  writeLease(key, owner, Date.now());
  return true;
}

export function releaseTokenRotationLease(storeId: string) {
  if (typeof window === "undefined") return;

  const key = getLeaseKey(storeId);
  if (readLease(key)?.owner === getTokenRotationLeaseOwner()) {
    localStorage.removeItem(key);
  }
}

function getLeaseKey(storeId: string) {
  return `${TOKEN_ROTATION_LEASE_PREFIX}${storeId}`;
}

function readLease(key: string): TokenRotationLease | null {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") as TokenRotationLease | null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function writeLease(key: string, owner: string, now: number) {
  localStorage.setItem(
    key,
    JSON.stringify({ owner, expiresAt: now + TOKEN_ROTATION_LEASE_MS }),
  );
}

let tokenRotationLeaseOwner = "";

function getTokenRotationLeaseOwner() {
  if (!tokenRotationLeaseOwner) {
    tokenRotationLeaseOwner =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  return tokenRotationLeaseOwner;
}
