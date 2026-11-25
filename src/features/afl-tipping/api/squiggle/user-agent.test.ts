import { describe, expect, it } from "vite-plus/test";
import { buildSquiggleUserAgent } from "~/features/afl-tipping/api/squiggle/user-agent";

describe("buildSquiggleUserAgent", () => {
  it("puts the contact email after the app's name", () => {
    expect(buildSquiggleUserAgent("test@example.com")).toBe(
      "Hot Shots Tipping (hot-shots.dev) - test@example.com",
    );
  });

  it("returns undefined for a missing or blank email", () => {
    expect(buildSquiggleUserAgent(undefined)).toBeUndefined();
    expect(buildSquiggleUserAgent("")).toBeUndefined();
    expect(buildSquiggleUserAgent("  ")).toBeUndefined();
  });
});
