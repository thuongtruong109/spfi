import { beforeEach, describe, expect, it } from "vitest";
import {
  acquireTokenRotationLease,
  releaseTokenRotationLease,
  renewTokenRotationLease,
} from "~~/utils/token-rotation-lease";

describe("token rotation lease", () => {
  beforeEach(() => localStorage.clear());

  it("blocks a concurrent rotation until the active lease is released", () => {
    expect(acquireTokenRotationLease("store-a")).toBe(true);
    expect(acquireTokenRotationLease("store-a")).toBe(false);

    releaseTokenRotationLease("store-a");
    expect(acquireTokenRotationLease("store-a")).toBe(true);
  });

  it("renews only a lease owned by the current tab", () => {
    expect(renewTokenRotationLease("missing-store")).toBe(false);
    expect(acquireTokenRotationLease("store-b")).toBe(true);
    expect(renewTokenRotationLease("store-b")).toBe(true);
  });
});
