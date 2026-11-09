/** What the model and the preview need to know about a project's own styling. Read from files the user adds. */
export interface DesignSystem {
  /** Names of the files it was read from. */
  sources: string[];
  /** Custom properties of `:root`. */
  light: Record<string, string>;
  /** Custom properties of `.dark`. */
  dark: Record<string, string>;
  /** Custom properties of Tailwind v4 `@theme` blocks (`--color-*`, `--radius-*`, `--font-*`, ...). */
  theme: Record<string, string>;
  /** Excerpt of a Tailwind v3 config file. */
  config: string;
  /** UI components of the project, from files such as button.tsx. */
  components: { name: string; exports: string[] }[];
}

export interface InputFile {
  name: string;
  text: string;
}

const MAX_CONFIG = 3500;
const NOT_COLOR = /^--(radius|font|spacing|shadow|text|tracking|leading|ease|animate|breakpoint|container|blur|drop-shadow)/;
const TRIPLET = /^-?[\d.]+\s+[\d.]+%\s+[\d.]+%$/;

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/** Text between the braces that open at `open` (the index of "{"). Tolerates nested blocks. */
function blockAt(css: string, open: number): string {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  return css.slice(open + 1);
}

/** Custom properties declared directly in a block (nested rules are skipped). */
function properties(block: string): Record<string, string> {
  let flat = "";
  let depth = 0;
  for (const ch of block) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (depth === 0) flat += ch;
  }
  const out: Record<string, string> = {};
  for (const m of flat.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) out[m[1]] = m[2].trim();
  return out;
}

function readCss(css: string, into: DesignSystem) {
  const text = stripComments(css);
  const roots = /(?:^|[};\s])((?::root|html)(?:\s*,\s*(?::root|html))*|\.dark|:root\.dark|html\.dark)\s*\{/g;
  for (const m of text.matchAll(roots)) {
    const block = blockAt(text, m.index + m[0].length - 1);
    Object.assign(m[1].includes("dark") ? into.dark : into.light, properties(block));
  }
  for (const m of text.matchAll(/@theme(?:\s+(?:inline|static|default|reference))*\s*\{/g)) {
    Object.assign(into.theme, properties(blockAt(text, m.index + m[0].length - 1)));
  }
}

function readComponent(file: InputFile, into: DesignSystem) {
  const name = file.name.replace(/^.*[\\/]/, "").replace(/\.(tsx|jsx|ts|js)$/, "");
  const exports = new Set<string>();
  for (const m of file.text.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(",")) {
      const id = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (id && /^\w+$/.test(id)) exports.add(id);
    }
  }
  for (const m of file.text.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+(\w+)/g)) exports.add(m[1]);
  if (name && exports.size > 0) into.components.push({ name, exports: [...exports] });
}

/** Reads the files a user adds (CSS with the theme, a Tailwind config, UI components) into one design system. */
export function extractDesignSystem(files: InputFile[]): DesignSystem {
  const ds: DesignSystem = { sources: [], light: {}, dark: {}, theme: {}, config: "", components: [] };
  for (const file of files) {
    const base = file.name.replace(/^.*[\\/]/, "");
    if (/\.css$/i.test(base)) {
      readCss(file.text, ds);
      ds.sources.push(base);
    } else if (/^tailwind\.config\.(js|cjs|mjs|ts)$/i.test(base)) {
      ds.config = stripComments(file.text).replace(/(^|\s)\/\/.*$/gm, "$1").trim().slice(0, MAX_CONFIG);
      ds.sources.push(base);
    } else if (/\.(tsx|jsx)$/i.test(base)) {
      readComponent(file, ds);
      ds.sources.push(base);
    }
  }
  return ds;
}

export function hasDesignSystem(ds: DesignSystem | null | undefined): ds is DesignSystem {
  return !!ds && ds.sources.length > 0;
}

/** Files are the user's own but can be large: the model only gets a bounded amount of them. */
const MAX_VARS = 80;
const MAX_COMPONENTS = 60;
const MAX_EXPORTS = 12;

const list = (vars: Record<string, string>) =>
  Object.entries(vars)
    .slice(0, MAX_VARS)
    .map(([k, v]) => `${k}: ${v.slice(0, 120)}`)
    .join("; ");

/** Class names of the colours the project defines (primary, muted-foreground, lime, ...). */
export function colorNames(ds: DesignSystem): string[] {
  const themed = Object.keys(ds.theme)
    .filter((k) => k.startsWith("--color-"))
    .map((k) => k.slice("--color-".length));
  if (themed.length > 0) return themed;
  const names = new Set([...Object.keys(ds.light), ...Object.keys(ds.dark)]);
  return [...names].filter((k) => !NOT_COLOR.test(k)).map((k) => k.slice(2));
}

/** The rules added to the model's instructions when the user supplied a design system. */
export function designSystemRules(ds: DesignSystem): string {
  const parts: string[] = [
    "The project already has its own design system. Build with it instead of inventing styles:",
    "- When a colour in the screenshot is close to one of the project's colours, use that colour's class (for example bg-primary, text-muted-foreground, border-border). Use an arbitrary value such as bg-[#1a2b3c] only when nothing in the project is close.",
    "- Use the project's radius classes (rounded-md, rounded-lg, ...) as defined below instead of fixed sizes where the corners match.",
  ];
  const colors = colorNames(ds);
  if (colors.length > 0) parts.push(`Project colours (class names): ${colors.join(", ")}.`);
  if (Object.keys(ds.light).length > 0) parts.push(`Light theme values: ${list(ds.light)}`);
  if (Object.keys(ds.dark).length > 0) parts.push(`Dark theme values (class "dark"): ${list(ds.dark)}`);
  const other = Object.entries(ds.theme).filter(([k]) => !k.startsWith("--color-"));
  if (other.length > 0) parts.push(`Theme settings: ${list(Object.fromEntries(other))}`);
  if (ds.config) parts.push(`Tailwind config of the project:\n${ds.config}`);
  if (ds.components.length > 0) {
    parts.push(
      "UI components the project has, imported as @/components/ui/<file>. Use only these shadcn components, and only the names exported here:\n" +
        ds.components
          .slice(0, MAX_COMPONENTS)
          .map((c) => `- ${c.name}: ${c.exports.slice(0, MAX_EXPORTS).join(", ")}`)
          .join("\n"),
    );
  }
  return parts.join("\n");
}

export interface PreviewTheme {
  /** CSS that sets the project's variables, added after the default palette. */
  css: string;
  /** Tailwind colour map, or null to keep the default shadcn colours. */
  colors: Record<string, string> | null;
  /** Tailwind border radius map, or null to keep the default. */
  radius: Record<string, string> | null;
}

const alpha = (value: string) => `color-mix(in oklab, ${value} calc(<alpha-value> * 100%), transparent)`;

/**
 * What the preview needs so the page looks as it would in the project: the project's variables and colour names.
 * Colours point straight at the variables (not at a copy made at the root), so the dark theme works under `.dark`.
 */
export function previewTheme(ds: DesignSystem): PreviewTheme {
  const rule = (sel: string, vars: Record<string, string>) =>
    Object.keys(vars).length > 0 ? `${sel}{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}` : "";
  // The project's real variables go in as they are: the default palette stays underneath for anything it leaves out.
  const css = rule(":root", ds.light) + rule(".dark", ds.dark);

  const colors: Record<string, string> = {};
  const themed = Object.entries(ds.theme).filter(([k]) => k.startsWith("--color-"));
  for (const [k, v] of themed) colors[k.slice("--color-".length)] = alpha(v);
  if (themed.length === 0) {
    const entries = Object.entries({ ...ds.light, ...ds.dark }).filter(([k]) => !NOT_COLOR.test(k));
    const allTriplets = entries.length > 0 && entries.every(([, v]) => TRIPLET.test(v));
    // Old shadcn setups keep "222 47% 11%" in the variable and wrap it in hsl() themselves: the default config does that already.
    if (!allTriplets) for (const [k] of entries) colors[k.slice(2)] = alpha(`var(${k})`);
  }

  const radius: Record<string, string> = {};
  for (const [k, v] of Object.entries(ds.theme)) if (k.startsWith("--radius-")) radius[k.slice("--radius-".length)] = v;

  // The default page, text and border colours are written for hsl() triplets: restate them for the project's own values.
  let base = "";
  if (Object.keys(colors).length > 0) {
    const raw = (name: string) => ds.theme[`--color-${name}`] ?? (name in colors ? `var(--${name})` : null);
    const [bg, fg, border] = [raw("background"), raw("foreground"), raw("border")];
    if (bg || fg) base += `body{${bg ? `background:${bg};` : ""}${fg ? `color:${fg}` : ""}}`;
    if (border) base += `*{border-color:${border}}`;
  }

  return {
    css: css + base,
    colors: Object.keys(colors).length > 0 ? colors : null,
    radius: Object.keys(radius).length > 0 ? radius : null,
  };
}
