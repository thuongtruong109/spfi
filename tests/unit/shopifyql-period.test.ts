import { describe, expect, it } from "vitest";
import { parseShopifyqlPeriod } from "~~/utils/shopifyql-period";

describe("ShopifyQL period parsing", () => {
  it("parses the documented HOUR_TIMESTAMP shape as a wall-clock hour", () => {
    expect(parseShopifyqlPeriod("2026-09-19T10")?.toISOString()).toBe(
      "2026-09-19T10:00:00.000Z",
    );
  });

  it("parses DATE values without shifting the calendar day", () => {
    expect(parseShopifyqlPeriod("2026-09-19")?.toISOString()).toBe(
      "2026-09-19T12:00:00.000Z",
    );
  });

  it("rejects normalized and ambiguous timestamp values", () => {
    expect(parseShopifyqlPeriod("2026-02-30T10")).toBeNull();
    expect(parseShopifyqlPeriod("2026-09-19T24")).toBeNull();
    expect(parseShopifyqlPeriod("2026-09-19T10:00:00Z")).toBeNull();
  });
});
