import { describe, expect, it } from "vitest";
import {
  formatTrafficChartAxisPeriod,
  formatTrafficChartTooltipPeriod,
} from "~~/utils/traffic-chart-period";

describe("traffic chart period formatting", () => {
  it("shows both clock time and date for hourly axis labels", () => {
    expect(formatTrafficChartAxisPeriod("2026-09-21T14", "hour", "vi-VN")).toEqual({
      primary: "14:00",
      secondary: "21-09",
    });
  });

  it("keeps longer ranges compact and includes the year for monthly buckets", () => {
    expect(formatTrafficChartAxisPeriod("2026-09-21", "day", "en-US")).toEqual({
      primary: "09/21",
    });
    expect(formatTrafficChartAxisPeriod("2026-09-01", "month", "en-US")).toEqual({
      primary: "Sep 2026",
    });
  });

  it("uses a complete, readable timestamp in the tooltip", () => {
    expect(formatTrafficChartTooltipPeriod("2026-09-21T14", "hour", "en-US")).toBe(
      "Sep 21, 2026 · 02:00 PM",
    );
  });

  it("preserves an unrecognized period instead of guessing", () => {
    expect(formatTrafficChartAxisPeriod("not-a-period", "day", "vi-VN")).toEqual({
      primary: "not-a-period",
    });
    expect(formatTrafficChartTooltipPeriod("not-a-period", "day", "vi-VN")).toBe(
      "not-a-period",
    );
  });
});
