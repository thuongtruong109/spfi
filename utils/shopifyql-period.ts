const SHOPIFYQL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SHOPIFYQL_HOUR_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/;

/**
 * Parses ShopifyQL DATE and HOUR_TIMESTAMP values without relying on the
 * runtime's implementation-dependent parsing of partial ISO strings.
 *
 * The returned Date is a UTC-backed wall-clock value. Consumers must format it
 * with `timeZone: "UTC"` so a Shopify bucket isn't shifted into the browser's
 * local timezone.
 */
export function parseShopifyqlPeriod(value: string): Date | null {
  const hourMatch = SHOPIFYQL_HOUR_PATTERN.exec(value);
  if (hourMatch) {
    return createUtcWallClockDate(hourMatch, Number(hourMatch[4]));
  }

  const dateMatch = SHOPIFYQL_DATE_PATTERN.exec(value);
  if (dateMatch) {
    return createUtcWallClockDate(dateMatch, 12);
  }

  return null;
}

function createUtcWallClockDate(match: RegExpExecArray, hour: number) {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;

  const date = new Date(0);
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour
  ) {
    return null;
  }

  return date;
}
