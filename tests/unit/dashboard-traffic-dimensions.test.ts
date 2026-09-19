import { describe, expect, it } from "vitest";
import { trafficDimensionRequestKey } from "../../utils/dashboard-traffic-dimensions";

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
