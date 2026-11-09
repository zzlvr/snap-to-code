import { describe, expect, it } from "vitest";
import { NO_CHANGES, REFINE_SYSTEM, refinePrompt } from "./prompts";
import { applyRefinement, mergeFiles } from "./refine";

const files = [
  { path: "components/Header.tsx", code: "export default function Header() { return <header /> }\n" },
  { path: "app/page.tsx", code: "export default function Page() { return <main /> }\n" },
];

describe("mergeFiles", () => {
  it("replaces files with the same path and keeps the order", () => {
    const merged = mergeFiles(files, [{ path: "app/page.tsx", code: "new\n" }]);
    expect(merged.map((f) => f.path)).toEqual(["components/Header.tsx", "app/page.tsx"]);
    expect(merged[1].code).toBe("new\n");
    expect(merged[0]).toBe(files[0]);
  });

  it("adds files that did not exist", () => {
    const merged = mergeFiles(files, [{ path: "components/Footer.tsx", code: "x\n" }]);
    expect(merged.map((f) => f.path)).toEqual(["components/Header.tsx", "app/page.tsx", "components/Footer.tsx"]);
  });
});

describe("applyRefinement", () => {
  it("applies the changed files and reports their paths", () => {
    const r = applyRefinement(files, "=== FILE: components/Header.tsx ===\nexport default function Header() { return <header className=\"p-4\" /> }\n");
    expect(r.changed).toEqual(["components/Header.tsx"]);
    expect(r.files[0].code).toContain("p-4");
    expect(r.files[1]).toBe(files[1]);
  });

  it("treats the nothing-to-fix reply as no change", () => {
    const r = applyRefinement(files, NO_CHANGES);
    expect(r.changed).toEqual([]);
    expect(r.files).toBe(files);
  });

  it("ignores a file that comes back identical or empty", () => {
    const same = `=== FILE: app/page.tsx ===\n${files[1].code}=== FILE: components/Empty.tsx ===\n\n`;
    const r = applyRefinement(files, same);
    expect(r.changed).toEqual([]);
    expect(r.files).toBe(files);
  });

  it("replaces brand icons in corrected files", () => {
    const code = 'import { Github } from "lucide-react";\nexport default function A() { return <Github /> }\n';
    const r = applyRefinement(files, `=== FILE: components/A.tsx ===\n${code}`);
    expect(r.files.find((f) => f.path === "components/A.tsx")?.code).not.toMatch(/\bimport \{ Github \}/);
  });
});

describe("refine prompt", () => {
  it("tells the model which images are the design and which the render", () => {
    const p = refinePrompt(files, 2, 3);
    expect(p).toContain("The first 2 images are the original design");
    expect(p).toContain("The next 3 images are the current code");
    expect(p).toContain("=== FILE: app/page.tsx ===");
  });

  it("uses the singular for one image each", () => {
    const p = refinePrompt(files, 1, 1);
    expect(p).toContain("The first 1 image is the original design");
    expect(p).toContain("The next 1 image is the current code");
  });

  it("keeps the generation rules and allows the nothing-to-fix reply", () => {
    expect(REFINE_SYSTEM).toContain("Tailwind CSS utility classes");
    expect(REFINE_SYSTEM).toContain(NO_CHANGES);
  });
});
