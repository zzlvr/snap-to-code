import type { Analysis, GeneratedFile } from "./types";

/** Parses `=== FILE: path ===` blocks. Tolerates partial (streaming) output and stray markdown fences. */
export function parseFiles(text: string): GeneratedFile[] {
  const re = /^=== FILE: (.+?) ===[ \t]*$/gm;
  const marks: { path: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    marks.push({ path: normalizePath(m[1]), start: m.index + m[0].length, end: m.index });
  }
  return marks
    .map((mk, i) => {
      const raw = text.slice(mk.start, i + 1 < marks.length ? marks[i + 1].end : undefined);
      return { path: mk.path, code: stripFences(raw) };
    })
    .filter((f) => f.path !== "");
}

/**
 * Paths come from model output, which can be steered by text inside the screenshot,
 * so they are untrusted: they end up as ZIP entry names and as keys of the preview module map.
 * Drop empty, "." and ".." segments (no zip-slip), backslashes and any odd characters.
 */
export function normalizePath(p: string) {
  const segments = p
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .map((s) => s.replace(/[^\w.@()[\]-]/g, ""))
    .filter((s) => s !== "" && s !== "." && s !== ".." && !/^\.+$/.test(s));
  if (segments[0] === "src") segments.shift();
  return segments.join("/");
}

function stripFences(code: string) {
  let c = code.replace(/^\s*\n/, "");
  c = c.replace(/^```[\w-]*\n/, "").replace(/\n?```\s*$/, "");
  return c.replace(/\s+$/, "") + "\n";
}

export function parseAnalysis(text: string): Analysis {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Модель не вернула JSON с анализом");
  const raw = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(raw.components) || raw.components.length === 0) {
    throw new Error("В анализе нет компонентов");
  }
  return {
    summary: String(raw.summary ?? ""),
    style: String(raw.style ?? ""),
    layout: String(raw.layout ?? ""),
    components: raw.components.map((c: Record<string, unknown>) => ({
      name: String(c.name ?? "Section").replace(/[^A-Za-z0-9]/g, ""),
      role: String(c.role ?? ""),
      description: String(c.description ?? ""),
      shadcn: Array.isArray(c.shadcn) ? c.shadcn.map(String) : [],
    })),
  };
}
