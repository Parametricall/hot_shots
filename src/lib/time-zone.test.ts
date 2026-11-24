import { describe, expect, it } from "vite-plus/test";
import { FALLBACK_TIME_ZONE, isTimeZone, pickTimeZone } from "~/lib/time-zone";

describe("isTimeZone", () => {
  it.each(["Australia/Brisbane", "Australia/Perth", "UTC"])("accepts %s", (zone) => {
    expect(isTimeZone(zone)).toBe(true);
  });

  it.each([undefined, "", "Not/AZone", "<script>"])("rejects %s", (zone) => {
    expect(isTimeZone(zone)).toBe(false);
  });
});

describe("pickTimeZone", () => {
  it("takes the first valid zone, in order", () => {
    expect(pickTimeZone("Australia/Perth", "Australia/Sydney")).toBe("Australia/Perth");
    expect(pickTimeZone(undefined, "Australia/Sydney")).toBe("Australia/Sydney");
    expect(pickTimeZone("Not/AZone", "Australia/Sydney")).toBe("Australia/Sydney");
  });

  it("falls back to Brisbane when none is valid", () => {
    expect(FALLBACK_TIME_ZONE).toBe("Australia/Brisbane");
    expect(pickTimeZone(undefined, "Not/AZone")).toBe("Australia/Brisbane");
    expect(pickTimeZone()).toBe("Australia/Brisbane");
  });
});
