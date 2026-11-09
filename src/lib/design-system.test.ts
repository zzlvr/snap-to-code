import { describe, expect, it } from "vitest";
import { colorNames, designSystemRules, extractDesignSystem, hasDesignSystem, previewTheme } from "./design-system";
import { GENERATION_SYSTEM, withDesignSystem } from "./prompts";
import { buildPreviewHtml } from "./preview-html";

const v4 = `
@import "tailwindcss";
@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  --color-lime: var(--lime);
  --radius-lg: var(--radius);
  --font-sans: var(--font-geist-sans), sans-serif;
}
/* palette */
:root { --background: #f3f4f1; --primary: #101114; --lime: #c8f03c; --radius: 0.375rem; }
@layer base { .dark { --background: oklch(0.145 0 0); --primary: oklch(0.922 0 0); } }
`;

const button = `
import * as React from "react";
const buttonVariants = cva("x");
function Button() { return null }
export { Button, buttonVariants }
`;

describe("extractDesignSystem", () => {
  it("reads Tailwind v4 theme blocks and root variables", () => {
    const ds = extractDesignSystem([{ name: "globals.css", text: v4 }]);
    expect(ds.light["--primary"]).toBe("#101114");
    expect(ds.light["--radius"]).toBe("0.375rem");
    expect(ds.dark["--background"]).toBe("oklch(0.145 0 0)");
    expect(ds.theme["--color-lime"]).toBe("var(--lime)");
    expect(colorNames(ds)).toEqual(["background", "primary", "lime"]);
  });

  it("reads components and what they export", () => {
    const ds = extractDesignSystem([{ name: "button.tsx", text: button }]);
    expect(ds.components).toEqual([{ name: "button", exports: ["Button", "buttonVariants"] }]);
  });

  it("keeps an excerpt of a Tailwind config", () => {
    const ds = extractDesignSystem([{ name: "tailwind.config.ts", text: "// c\nexport default { theme: { extend: {} } }" }]);
    expect(ds.config).toContain("theme");
    expect(ds.config).not.toContain("// c");
  });

  it("ignores files it does not know", () => {
    const ds = extractDesignSystem([{ name: "package.json", text: "{}" }, { name: "photo.png", text: "x" }]);
    expect(hasDesignSystem(ds)).toBe(false);
  });

  it("falls back to variable names when there is no @theme block", () => {
    const ds = extractDesignSystem([{ name: "globals.css", text: ":root{--primary:#111;--radius:4px;--muted:#eee}" }]);
    expect(colorNames(ds)).toEqual(["primary", "muted"]);
  });
});

describe("prompt rules", () => {
  it("adds the project's colours, values and components to the instructions", () => {
    const ds = extractDesignSystem([
      { name: "globals.css", text: v4 },
      { name: "button.tsx", text: button },
    ]);
    const rules = designSystemRules(ds);
    expect(rules).toContain("lime");
    expect(rules).toContain("--primary: #101114");
    expect(rules).toContain("Dark theme values");
    expect(rules).toContain("- button: Button, buttonVariants");
    expect(withDesignSystem(GENERATION_SYSTEM, ds)).toContain(GENERATION_SYSTEM);
  });

  it("leaves the instructions alone without a design system", () => {
    expect(withDesignSystem(GENERATION_SYSTEM, null)).toBe(GENERATION_SYSTEM);
    expect(withDesignSystem(GENERATION_SYSTEM, extractDesignSystem([]))).toBe(GENERATION_SYSTEM);
  });
});

describe("preview theme", () => {
  it("points colours straight at the variables so the dark theme works", () => {
    const t = previewTheme(extractDesignSystem([{ name: "globals.css", text: v4 }]));
    expect(t.colors?.primary).toBe("color-mix(in oklab, var(--primary) calc(<alpha-value> * 100%), transparent)");
    expect(t.radius?.lg).toBe("var(--radius)");
    expect(t.css).toContain(":root{--background:#f3f4f1");
    expect(t.css).toContain(".dark{--background:oklch(0.145 0 0)");
    expect(t.css).toContain("body{background:var(--background)");
  });

  it("keeps the default colours for old hsl-triplet variables", () => {
    const t = previewTheme(extractDesignSystem([{ name: "globals.css", text: ":root{--primary:222 47% 11%;--background:0 0% 100%}" }]));
    expect(t.colors).toBeNull();
  });

  it("is added to the preview page only when there is a design system", () => {
    const files = [{ path: "app/page.tsx", code: "export default function P(){return null}" }];
    expect(buildPreviewHtml(files)).not.toContain("tailwind.config.theme.extend");
    const ds = extractDesignSystem([{ name: "globals.css", text: v4 }]);
    const html = buildPreviewHtml(files, { designSystem: ds });
    expect(html).toContain("Object.assign(tailwind.config.theme.extend");
    expect(html).toContain("--lime:#c8f03c");
  });

  it("never lets a file close the style or script tag", () => {
    const ds = extractDesignSystem([{ name: "g.css", text: ":root{--x:</style><script>alert(1)</script>;--primary:#111}" }]);
    const html = buildPreviewHtml([{ path: "app/page.tsx", code: "x" }], { designSystem: ds });
    expect(html).not.toContain("<script>alert(1)");
  });
});
