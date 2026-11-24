import { describe, expect, it } from "vite-plus/test";
import { finalsSpots } from "~/features/afl-tipping/constants";

describe("finalsSpots", () => {
  it("is the top 10 from 2026, when the AFL added a wildcard round", () => {
    expect(finalsSpots(2026)).toBe(10);
    expect(finalsSpots(2027)).toBe(10);
  });

  it("is the top 8 before", () => {
    expect(finalsSpots(2025)).toBe(8);
  });
});
