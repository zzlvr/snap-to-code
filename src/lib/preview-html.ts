import type { GeneratedFile } from "./types";

/**
 * Builds a self-contained HTML document that compiles and renders the generated
 * TSX files inside a sandboxed iframe (Tailwind CDN + React UMD + Babel standalone).
 * shadcn/ui and lucide-react are provided by lightweight in-iframe implementations,
 * so the preview is a close approximation of the real project, not a byte-exact one.
 */
export function buildPreviewHtml(files: GeneratedFile[]): string {
  const map: Record<string, string> = {};
  for (const f of files) map[f.path] = f.code;
  // "<" is escaped so generated code can never close the script tag.
  const filesJson = JSON.stringify(map).replace(/</g, "\\u003c");

  return (
    HEAD +
    "<script>window.__FILES__ = " +
    filesJson +
    ";</script>" +
    "<script>" +
    RUNTIME +
    "</script></body></html>"
  );
}

const HEAD = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://cdn.tailwindcss.com/3.4.17"></script>
<script>
tailwind.config = { darkMode: "class", theme: { extend: {
  colors: {
    border: "hsl(var(--border))", input: "hsl(var(--input))", ring: "hsl(var(--ring))",
    background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
    primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
    secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
    destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
    muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
    accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
    card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
    popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" }
  },
  borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" }
} } };
</script>
<style>
:root{--background:0 0% 100%;--foreground:222.2 84% 4.9%;--card:0 0% 100%;--card-foreground:222.2 84% 4.9%;--popover:0 0% 100%;--popover-foreground:222.2 84% 4.9%;--primary:222.2 47.4% 11.2%;--primary-foreground:210 40% 98%;--secondary:210 40% 96.1%;--secondary-foreground:222.2 47.4% 11.2%;--muted:210 40% 96.1%;--muted-foreground:215.4 16.3% 46.9%;--accent:210 40% 96.1%;--accent-foreground:222.2 47.4% 11.2%;--destructive:0 84.2% 60.2%;--destructive-foreground:210 40% 98%;--border:214.3 31.8% 91.4%;--input:214.3 31.8% 91.4%;--ring:222.2 84% 4.9%;--radius:0.5rem}
*{border-color:hsl(var(--border))}
body{margin:0;background:hsl(var(--background));color:hsl(var(--foreground));font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#err{display:none;margin:16px;padding:12px 14px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:8px;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap}
</style>
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>
<script>window.react = window.React;</script>
<script src="https://unpkg.com/lucide-react@0.469.0/dist/umd/lucide-react.min.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"></script>
</head><body><div id="err"></div><div id="root"></div>`;

const RUNTIME = String.raw`
(function () {
  var h = React.createElement;
  function report(msg) {
    var el = document.getElementById("err");
    el.style.display = "block";
    el.textContent = msg;
    parent.postMessage({ type: "preview-error", message: msg }, "*");
  }
  window.addEventListener("error", function (e) { report(String(e.message || e.error)); });
  window.addEventListener("unhandledrejection", function (e) { report(String(e.reason)); });

  var cn = function () {
    return Array.prototype.slice.call(arguments).flat(Infinity).filter(Boolean).join(" ");
  };
  function mk(tag, base, name) {
    var C = React.forwardRef(function (p, ref) {
      var rest = Object.assign({}, p); var cls = rest.className; delete rest.className; delete rest.asChild;
      return h(tag, Object.assign({ ref: ref, className: cn(base, cls) }, rest));
    });
    C.displayName = name; return C;
  }
  function Passthrough(name) {
    var C = function (p) { return h("div", { className: p.className }, p.children); };
    C.displayName = name; return C;
  }

  var btnVariants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline"
  };
  var btnSizes = { default: "h-10 px-4 py-2", sm: "h-9 rounded-md px-3", lg: "h-11 rounded-md px-8", icon: "h-10 w-10" };
  var Button = React.forwardRef(function (p, ref) {
    var rest = Object.assign({}, p); var v = rest.variant || "default"; var s = rest.size || "default";
    var cls = rest.className; delete rest.variant; delete rest.size; delete rest.className; delete rest.asChild;
    return h("button", Object.assign({ ref: ref, className: cn("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50", btnVariants[v], btnSizes[s], cls) }, rest));
  });
  var badgeVariants = {
    default: "border-transparent bg-primary text-primary-foreground",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    destructive: "border-transparent bg-destructive text-destructive-foreground",
    outline: "text-foreground"
  };
  function Badge(p) {
    var rest = Object.assign({}, p); var v = rest.variant || "default"; var cls = rest.className;
    delete rest.variant; delete rest.className;
    return h("div", Object.assign({ className: cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", badgeVariants[v], cls) }, rest));
  }
  var Checkbox = function (p) {
    return h("input", { type: "checkbox", className: cn("h-4 w-4 rounded border border-primary accent-[hsl(var(--primary))]", p.className), checked: p.checked, defaultChecked: p.defaultChecked, onChange: function (e) { p.onCheckedChange && p.onCheckedChange(e.target.checked); } });
  };
  var Switch = function (p) {
    var st = React.useState(!!(p.checked != null ? p.checked : p.defaultChecked)); var on = p.checked != null ? p.checked : st[0];
    return h("button", { type: "button", role: "switch", "aria-checked": on, onClick: function () { st[1](!on); p.onCheckedChange && p.onCheckedChange(!on); }, className: cn("inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", on ? "bg-primary" : "bg-input", p.className) }, h("span", { className: cn("block h-5 w-5 rounded-full bg-background shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5") }));
  };
  var Progress = function (p) {
    return h("div", { className: cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", p.className) }, h("div", { className: "h-full bg-primary transition-all", style: { width: (p.value || 0) + "%" } }));
  };
  var TabsCtx = React.createContext({});
  function Tabs(p) {
    var st = React.useState(p.defaultValue); var value = p.value != null ? p.value : st[0];
    return h(TabsCtx.Provider, { value: { value: value, set: function (v) { st[1](v); p.onValueChange && p.onValueChange(v); } } }, h("div", { className: p.className }, p.children));
  }
  function TabsTrigger(p) {
    var c = React.useContext(TabsCtx); var active = c.value === p.value;
    return h("button", { type: "button", onClick: function () { c.set(p.value); }, className: cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all", active ? "bg-background text-foreground shadow-sm" : "", p.className) }, p.children);
  }
  function TabsContent(p) {
    var c = React.useContext(TabsCtx);
    return c.value === p.value ? h("div", { className: cn("mt-2", p.className) }, p.children) : null;
  }
  var Avatar = function (p) { return h("span", { className: cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", p.className) }, p.children); };
  var AvatarFallback = function (p) { return h("span", { className: cn("flex h-full w-full items-center justify-center rounded-full bg-muted text-sm", p.className) }, p.children); };
  var AvatarImage = function () { return null; };

  var UI = {
    button: { Button: Button },
    badge: { Badge: Badge },
    card: {
      Card: mk("div", "rounded-lg border bg-card text-card-foreground shadow-sm", "Card"),
      CardHeader: mk("div", "flex flex-col space-y-1.5 p-6", "CardHeader"),
      CardTitle: mk("h3", "text-2xl font-semibold leading-none tracking-tight", "CardTitle"),
      CardDescription: mk("p", "text-sm text-muted-foreground", "CardDescription"),
      CardContent: mk("div", "p-6 pt-0", "CardContent"),
      CardFooter: mk("div", "flex items-center p-6 pt-0", "CardFooter")
    },
    input: { Input: mk("input", "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground", "Input") },
    textarea: { Textarea: mk("textarea", "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm", "Textarea") },
    label: { Label: mk("label", "text-sm font-medium leading-none", "Label") },
    separator: { Separator: function (p) { return h("div", { className: cn("shrink-0 bg-border", p.orientation === "vertical" ? "h-full w-px" : "h-px w-full", p.className) }); } },
    skeleton: { Skeleton: mk("div", "animate-pulse rounded-md bg-muted", "Skeleton") },
    table: {
      Table: function (p) { return h("div", { className: "relative w-full overflow-auto" }, h("table", { className: cn("w-full caption-bottom text-sm", p.className) }, p.children)); },
      TableHeader: mk("thead", "[&_tr]:border-b", "TableHeader"),
      TableBody: mk("tbody", "[&_tr:last-child]:border-0", "TableBody"),
      TableFooter: mk("tfoot", "border-t bg-muted/50 font-medium", "TableFooter"),
      TableRow: mk("tr", "border-b transition-colors hover:bg-muted/50", "TableRow"),
      TableHead: mk("th", "h-12 px-4 text-left align-middle font-medium text-muted-foreground", "TableHead"),
      TableCell: mk("td", "p-4 align-middle", "TableCell"),
      TableCaption: mk("caption", "mt-4 text-sm text-muted-foreground", "TableCaption")
    },
    avatar: { Avatar: Avatar, AvatarFallback: AvatarFallback, AvatarImage: AvatarImage },
    checkbox: { Checkbox: Checkbox },
    switch: { Switch: Switch },
    progress: { Progress: Progress },
    tabs: {
      Tabs: Tabs, TabsContent: TabsContent, TabsTrigger: TabsTrigger,
      TabsList: mk("div", "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", "TabsList")
    }
  };
  function withFallback(obj) {
    return new Proxy(obj, { get: function (t, k) {
      if (k in t || typeof k !== "string" || k === "default" || !/^[A-Z]/.test(k)) return t[k];
      return Passthrough(k);
    } });
  }

  var iconFallback = function (p) { return h("span", { className: p.className }); };
  var lucide = new Proxy(window.LucideReact || {}, { get: function (t, k) {
    if (k in t || typeof k !== "string" || !/^[A-Z]/.test(k)) return t[k];
    return iconFallback;
  } });

  var files = window.__FILES__;
  var cache = {};
  function normalize(p) {
    var out = [];
    p.split("/").forEach(function (s) { if (s === "..") out.pop(); else if (s && s !== ".") out.push(s); });
    return out.join("/");
  }
  function findFile(p) {
    var c = [p, p + ".tsx", p + ".ts", p + ".jsx", p + ".js", p + "/index.tsx", p + "/index.ts"];
    for (var i = 0; i < c.length; i++) if (files[c[i]] != null) return c[i];
    return null;
  }
  function makeRequire(from) {
    return function (spec) {
      if (spec === "react") return React;
      if (spec === "react-dom" || spec === "react-dom/client") return ReactDOM;
      if (spec === "react/jsx-runtime") return { jsx: h, jsxs: h, Fragment: React.Fragment };
      if (spec === "lucide-react") return lucide;
      if (spec === "@/lib/utils") return { cn: cn };
      if (spec === "next/link") return { default: function (p) { return h("a", Object.assign({}, p, { href: p.href })); } };
      if (spec === "next/image") return { default: function (p) { return h("img", { src: p.src, alt: p.alt, className: p.className }); } };
      if (spec === "next/navigation") return { usePathname: function () { return "/"; }, useRouter: function () { return { push: function () {}, replace: function () {} }; } };
      var m = /^@\/components\/ui\/([\w-]+)$/.exec(spec);
      if (m) return withFallback(UI[m[1]] || {});
      var target = null;
      if (spec.indexOf("@/") === 0) target = findFile(normalize(spec.slice(2)));
      else if (spec.charAt(0) === ".") target = findFile(normalize(from.split("/").slice(0, -1).join("/") + "/" + spec));
      if (!target) throw new Error("Module not available in preview: " + spec + " (imported from " + from + ")");
      return load(target);
    };
  }
  function load(path) {
    if (cache[path]) return cache[path].exports;
    var mod = { exports: {} }; cache[path] = mod;
    var out;
    try {
      out = Babel.transform(files[path], {
        filename: path,
        sourceType: "module",
        presets: [["typescript", { isTSX: true, allExtensions: true }], "react"],
        plugins: ["transform-modules-commonjs"]
      }).code;
    } catch (e) { throw new Error("Syntax error in " + path + ": " + e.message); }
    new Function("require", "module", "exports", "React", out)(makeRequire(path), mod, mod.exports, React);
    return mod.exports;
  }

  class Boundary extends React.Component {
    constructor(p) { super(p); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error: error }; }
    componentDidCatch(error) { report(String(error && error.stack || error)); }
    render() { return this.state.error ? null : this.props.children; }
  }

  try {
    var entry = findFile("app/page") || findFile("page") || findFile("components/App");
    if (!entry) throw new Error("app/page.tsx not found in generated files");
    var Page = load(entry).default;
    if (typeof Page !== "function") throw new Error(entry + " has no default export component");
    ReactDOM.createRoot(document.getElementById("root")).render(h(Boundary, null, h(Page)));
    parent.postMessage({ type: "preview-ok" }, "*");
  } catch (e) { report(String(e && e.message || e)); }
})();
`;
