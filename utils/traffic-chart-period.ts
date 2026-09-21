import type { DashboardTrafficGranularity } from "../types/traffic.ts";
import { parseShopifyqlPeriod } from "./shopifyql-period.ts";

export interface TrafficChartAxisPeriod {
  primary: string;
  secondary?: string;
}

const UTC_TIME_ZONE = "UTC";

/**
 * Keeps axis labels compact while retaining the date for hourly ranges, where
 * showing only the clock time makes midnight and adjacent days ambiguous.
 */
export function formatTrafficChartAxisPeriod(
  value: string,
  granularity: DashboardTrafficGranularity,
  locale: string,
): TrafficChartAxisPeriod {
  const date = parseShopifyqlPeriod(value);
  if (!date) return { primary: value };

  if (granularity === "hour") {
    return {
      primary: format(date, locale, { hour: "2-digit", minute: "2-digit" }),
      secondary: format(date, locale, { day: "2-digit", month: "2-digit" }),
    };
  }

  if (granularity === "month") {
    return {
      primary: format(date, locale, { month: "short", year: "numeric" }),
    };
  }

  return {
    primary: format(date, locale, { day: "2-digit", month: "2-digit" }),
  };
}

export function formatTrafficChartTooltipPeriod(
  value: string,
  granularity: DashboardTrafficGranularity,
  locale: string,
) {
  const date = parseShopifyqlPeriod(value);
  if (!date) return value;

  if (granularity === "hour") {
    const dateLabel = format(date, locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timeLabel = format(date, locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateLabel} · ${timeLabel}`;
  }

  if (granularity === "month") {
    return format(date, locale, { month: "long", year: "numeric" });
  }

  return format(date, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function format(date: Date, locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: UTC_TIME_ZONE,
    ...options,
  }).format(date);
}
