import type { GeneratedFile } from "./types";

export interface ScanWarning {
  path: string;
  message: string;
}

const ALLOWED_MODULES = /^(react|react-dom|lucide-react|next\/(link|image|navigation)|@\/.+|\.{1,2}\/.*)$/;

const RULES: { re: RegExp; message: string }[] = [
  { re: /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/, message: "сетевой запрос" },
  { re: /\beval\s*\(|\bnew\s+Function\b/, message: "динамическое выполнение кода (eval / Function)" },
  { re: /dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write/, message: "вставка сырого HTML" },
  { re: /document\.cookie|localStorage|sessionStorage|indexedDB/, message: "доступ к cookie или хранилищу" },
  { re: /window\.(open|location)|location\.(href|assign|replace)\s*=/, message: "переход или открытие окна" },
  { re: /<script\b|<iframe\b/i, message: "тег script или iframe" },
];

/**
 * Generated code is untrusted: a screenshot can contain text that steers the model.
 * The preview is sandboxed, but code copied into a real project is not, so flag anything
 * a UI mock-up has no business doing. Heuristic, not a guarantee.
 */
export function scanGeneratedCode(files: GeneratedFile[]): ScanWarning[] {
  const out: ScanWarning[] = [];
  for (const f of files) {
    for (const rule of RULES) {
      if (rule.re.test(f.code)) out.push({ path: f.path, message: rule.message });
    }
    for (const m of f.code.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["']([^"']+)["']/g)) {
      if (!ALLOWED_MODULES.test(m[1])) out.push({ path: f.path, message: `неожиданный импорт «${m[1]}»` });
    }
  }
  return out;
}
