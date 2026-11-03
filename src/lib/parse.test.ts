import { describe, expect, it } from "vitest";
import { parseAnalysis, parseFiles } from "./parse";

describe("parseFiles", () => {
  it("splits multiple file blocks", () => {
    const text = [
      "=== FILE: components/Sidebar.tsx ===",
      "export default function Sidebar() {}",
      "=== FILE: app/page.tsx ===",
      "export default function Page() {}",
    ].join("\n");
    expect(parseFiles(text)).toEqual([
      { path: "components/Sidebar.tsx", code: "export default function Sidebar() {}\n" },
      { path: "app/page.tsx", code: "export default function Page() {}\n" },
    ]);
  });

  it("returns an empty list when there are no markers", () => {
    expect(parseFiles("just some prose")).toEqual([]);
    expect(parseFiles("")).toEqual([]);
  });

  it("ignores text before the first marker", () => {
    const files = parseFiles("Sure! Here is the code:\n=== FILE: a.tsx ===\nconst a = 1;\n");
    expect(files).toHaveLength(1);
    expect(files[0].code).toBe("const a = 1;\n");
  });

  it("strips markdown fences the model adds despite instructions", () => {
    const text = "=== FILE: a.tsx ===\n```tsx\nconst a = 1;\n```\n=== FILE: b.tsx ===\n```\nconst b = 2;\n```\n";
    expect(parseFiles(text).map((f) => f.code)).toEqual(["const a = 1;\n", "const b = 2;\n"]);
  });

  it("normalizes paths: leading ./ and src/", () => {
    const text = "=== FILE: ./src/components/Header.tsx ===\nx\n=== FILE: /app/page.tsx ===\ny\n";
    expect(parseFiles(text).map((f) => f.path)).toEqual(["components/Header.tsx", "app/page.tsx"]);
  });

  it("blocks path traversal in model-supplied paths (zip-slip)", () => {
    const text = [
      "=== FILE: ../../etc/passwd ===",
      "x",
      "=== FILE: components/../../../evil.tsx ===",
      "x",
      "=== FILE: C:\\Windows\\win.tsx ===",
      "x",
      "=== FILE: .. ===",
      "x",
    ].join("\n");
    const paths = parseFiles(text).map((f) => f.path);
    for (const p of paths) {
      expect(p.split("/")).not.toContain("..");
      expect(p.startsWith("/")).toBe(false);
      expect(p).not.toContain("\\");
      expect(p).not.toContain(":");
    }
    expect(paths).toContain("etc/passwd");
    expect(paths).toContain("components/evil.tsx");
    // a path made only of traversal segments yields no file at all
    expect(paths).not.toContain("");
    expect(paths).toHaveLength(3);
  });

  it("handles a partial stream: unfinished marker line is not a file yet", () => {
    expect(parseFiles("=== FILE: components/Hea")).toEqual([]);
  });

  it("handles a partial stream: last file contains the code received so far", () => {
    const files = parseFiles("=== FILE: a.tsx ===\nconst a = 1;\n=== FILE: b.tsx ===\nexport def");
    expect(files).toHaveLength(2);
    expect(files[1]).toEqual({ path: "b.tsx", code: "export def\n" });
  });

  it("tolerates CRLF line endings", () => {
    const files = parseFiles("=== FILE: a.tsx ===\r\nconst a = 1;\r\n=== FILE: b.tsx ===\r\nconst b = 2;\r\n");
    expect(files.map((f) => f.path)).toEqual(["a.tsx", "b.tsx"]);
  });

  it("does not treat a marker-like string inside code as a separator", () => {
    const text = "=== FILE: a.tsx ===\nconst s = \"=== FILE: fake ===\";\n";
    const files = parseFiles(text);
    expect(files).toHaveLength(1);
    expect(files[0].code).toContain("fake");
  });
});

describe("parseAnalysis", () => {
  const valid = {
    summary: "Dashboard",
    style: "light, rounded",
    layout: "sidebar + content",
    components: [{ name: "Sidebar", role: "navigation", description: "Left nav", shadcn: ["button"] }],
  };

  it("parses plain JSON", () => {
    const a = parseAnalysis(JSON.stringify(valid));
    expect(a.summary).toBe("Dashboard");
    expect(a.components[0]).toEqual(valid.components[0]);
  });

  it("extracts JSON wrapped in prose or code fences", () => {
    const a = parseAnalysis("Here you go:\n```json\n" + JSON.stringify(valid) + "\n```");
    expect(a.components).toHaveLength(1);
  });

  it("sanitizes component names to file-safe identifiers", () => {
    const a = parseAnalysis(JSON.stringify({ ...valid, components: [{ name: "Data Table!", description: "" }] }));
    expect(a.components[0].name).toBe("DataTable");
  });

  it("fills defaults for missing optional fields", () => {
    const a = parseAnalysis(JSON.stringify({ components: [{ name: "Header" }] }));
    expect(a.summary).toBe("");
    expect(a.components[0]).toMatchObject({ role: "", description: "", shadcn: [] });
  });

  it("throws when there is no JSON", () => {
    expect(() => parseAnalysis("no json here")).toThrow(/JSON/);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseAnalysis("{ not valid }")).toThrow();
  });

  it("throws when components are missing or empty", () => {
    expect(() => parseAnalysis(JSON.stringify({ summary: "x" }))).toThrow(/no components/);
    expect(() => parseAnalysis(JSON.stringify({ components: [] }))).toThrow(/no components/);
  });
});
