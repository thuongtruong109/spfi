import { describe, expect, it } from "vitest";
import { DASHBOARD_TRAFFIC_DIMENSION_KEYS } from "../../types/traffic";
import {
  DASHBOARD_TRAFFIC_DIMENSION_GROUPS,
  DASHBOARD_TRAFFIC_DIMENSION_LABEL_KEYS,
  trafficDimensionRequestKey,
} from "../../utils/dashboard-traffic-dimensions";

describe("trafficDimensionRequestKey", () => {
  it("isolates cached dimension results by range and dimension", () => {
    expect(trafficDimensionRequestKey("24h", "source")).toBe("24h:source");
    expect(trafficDimensionRequestKey("7d", "source")).not.toBe(
      trafficDimensionRequestKey("24h", "source"),
    );
    expect(trafficDimensionRequestKey("24h", "country")).not.toBe(
      trafficDimensionRequestKey("24h", "source"),
    );
  });
});

describe("traffic dimension metadata", () => {
  it("covers every dimension exactly once", () => {
    const groupedDimensions = Object.values(DASHBOARD_TRAFFIC_DIMENSION_GROUPS).flat();

    expect(groupedDimensions).toHaveLength(DASHBOARD_TRAFFIC_DIMENSION_KEYS.length);
    expect(new Set(groupedDimensions)).toEqual(
      new Set(DASHBOARD_TRAFFIC_DIMENSION_KEYS),
    );
    expect(Object.keys(DASHBOARD_TRAFFIC_DIMENSION_LABEL_KEYS)).toEqual(
      expect.arrayContaining([...DASHBOARD_TRAFFIC_DIMENSION_KEYS]),
    );
  });
});
