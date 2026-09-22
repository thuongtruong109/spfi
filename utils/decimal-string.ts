interface ParsedDecimal {
  units: bigint;
  scale: number;
}

const BIGINT_ZERO = BigInt(0);
const BIGINT_TEN = BigInt(10);

export function addDecimalStrings(leftValue: string, rightValue: string) {
  const { left, right, scale } = alignDecimals(
    parseDecimalString(leftValue),
    parseDecimalString(rightValue),
  );
  return formatDecimalString(left + right, scale);
}

export function sumDecimalStrings(values: string[]) {
  return values.reduce(addDecimalStrings, "0");
}

export function negateDecimalString(value: string) {
  const parsed = parseDecimalString(value);
  return formatDecimalString(-parsed.units, parsed.scale);
}

export function compareDecimalStrings(leftValue: string, rightValue: string) {
  const { left, right } = alignDecimals(
    parseDecimalString(leftValue),
    parseDecimalString(rightValue),
  );
  return left === right ? 0 : left > right ? 1 : -1;
}

export function multiplyDecimalStrings(leftValue: string, rightValue: string) {
  const left = parseDecimalString(leftValue);
  const right = parseDecimalString(rightValue);
  return formatDecimalString(left.units * right.units, left.scale + right.scale);
}

export function subtractDecimalStrings(leftValue: string, rightValue: string) {
  return addDecimalStrings(leftValue, negateDecimalString(rightValue));
}

function parseDecimalString(value: string): ParsedDecimal {
  const normalized = String(value || "0").trim();
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error("Invalid decimal string.");
  const fraction = match[3] || "";
  const units = BigInt(`${match[1] || ""}${match[2]}${fraction}`);
  return { units, scale: fraction.length };
}

function alignDecimals(left: ParsedDecimal, right: ParsedDecimal) {
  const scale = Math.max(left.scale, right.scale);
  return {
    left: left.units * BIGINT_TEN ** BigInt(scale - left.scale),
    right: right.units * BIGINT_TEN ** BigInt(scale - right.scale),
    scale,
  };
}

function formatDecimalString(units: bigint, scale: number) {
  const negative = units < BIGINT_ZERO;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
  const value = scale
    ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, "")
    : digits;
  return `${negative ? "-" : ""}${value || "0"}`;
}
