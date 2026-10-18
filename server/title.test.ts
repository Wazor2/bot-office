import { describe, expect, it } from "vitest";
import { projectTitleFromBrief } from "./workspace";

describe("projectTitleFromBrief", () => {
  it("uses the first non-empty line", () => {
    expect(projectTitleFromBrief("\n  Build a CRM \nmore")).toBe("Build a CRM");
  });
  it("never exceeds the 120-char column and never splits an emoji", () => {
    const t = projectTitleFromBrief("😀".repeat(300));
    expect(Array.from(t).length).toBeLessThanOrEqual(120);
    expect(t).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });
  it("falls back for blank input", () => {
    expect(projectTitleFromBrief("   ")).toBe("New project");
  });
});
