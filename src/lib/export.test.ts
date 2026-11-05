import { describe, expect, it } from "vitest";
import { baseName } from "./export";

describe("baseName", () => {
  it("drops the folders", () => {
    expect(baseName("components/SiteHeader.tsx")).toBe("SiteHeader.tsx");
    expect(baseName("app/page.tsx")).toBe("page.tsx");
  });

  it("keeps a plain name", () => {
    expect(baseName("page.tsx")).toBe("page.tsx");
  });
});
