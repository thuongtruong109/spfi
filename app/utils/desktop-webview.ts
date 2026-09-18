export interface DesktopWebviewOption {
  label: string;
  value: string;
}

function normalizeWebviewUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    return url.pathname === "/" && !url.search && !url.hash
      ? url.origin
      : url.toString();
  } catch {
    return null;
  }
}

export function parseDesktopWebviewOptions(
  configuredValue: unknown,
): DesktopWebviewOption[] {
  const configured = typeof configuredValue === "string" ? configuredValue.trim() : "";

  const seen = new Set<string>();

  return configured
    .split(/[\n,]+/)
    .map((entry) => {
      const separatorIndex = entry.indexOf("|");
      const label = separatorIndex >= 0 ? entry.slice(0, separatorIndex).trim() : "";
      const rawUrl = separatorIndex >= 0 ? entry.slice(separatorIndex + 1) : entry;
      const value = normalizeWebviewUrl(rawUrl);
      if (!value || seen.has(value)) return null;

      seen.add(value);
      const url = new URL(value);
      return {
        label: label || url.host,
        value,
      };
    })
    .filter((option): option is DesktopWebviewOption => option !== null);
}
