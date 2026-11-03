import type { Analysis } from "./types";

export const ANALYSIS_SYSTEM = `You are a senior frontend engineer who decomposes UI screenshots into React components.
Look at the screenshot and describe its structure. Respond with ONLY valid JSON, no markdown, matching exactly:
{
  "summary": "one sentence: what screen this is",
  "style": "colors, typography, density, corner radius, light/dark theme",
  "layout": "how the page is arranged (e.g. fixed left sidebar, top header, main content grid)",
  "components": [
    {
      "name": "PascalCase file-safe name, e.g. Sidebar",
      "role": "layout | navigation | data-display | form | feedback | content",
      "description": "what it contains and how it looks, including exact visible text and approximate sizes",
      "shadcn": ["kebab-case shadcn/ui components it should use, e.g. button, card, badge, table, avatar, input"]
    }
  ]
}
Ignore anything that is not part of the page itself: browser tabs, address bar, window frame, OS taskbar or dock, cursor.
Rules: 3 to 8 components (up to 12 for a long page with many sections), top-level sections only (no tiny atoms). Do not include the page itself as a component.`;

export const GENERATION_SYSTEM = `You are a senior frontend engineer. You convert a UI screenshot into clean, production-quality React code.

Tech rules (mandatory):
- React + TypeScript, Next.js App Router style. Add "use client" only if a component needs state or events.
- Styling ONLY with Tailwind CSS utility classes. No inline styles, no CSS files, no CSS-in-JS.
- Use shadcn/ui components, imported as: import { Button } from "@/components/ui/button" (also card, badge, input, label, textarea, table, avatar, separator, checkbox, switch, tabs, progress, skeleton).
- Use lucide-react for icons. Use the cn helper from "@/lib/utils" when merging classes.
- Use shadcn semantic color tokens (bg-background, text-muted-foreground, border, bg-primary, bg-muted, ...) where they fit; use Tailwind palette colors when the screenshot clearly needs a specific color.
- No other libraries. No network requests. No external images: use initials, gradients or icons instead of photos.
- Hardcode realistic mock data (typed arrays) that matches the screenshot text exactly.
- One component per file in components/. Named exports are not allowed: use "export default function Name()". Type props with an interface when there are props.
- Compose everything in app/page.tsx (default export) importing components via "@/components/Name".
- Be faithful to the screenshot: layout, spacing, hierarchy, text, colors. Make it responsive where natural.
- Build only the page. Ignore browser tabs, the address bar, window frames, the OS taskbar or dock, and the mouse cursor if they appear in the image.

Output format (mandatory): ONLY file blocks, no prose, no markdown fences. Each file:
=== FILE: components/Sidebar.tsx ===
<code>
Put each marker on its own line, before the file's code. The last file must be app/page.tsx.`;

/** Tells the model that several images are slices of one page, not several pages. Empty for a single image. */
export function partsNote(count: number): string {
  if (count <= 1) return "";
  return (
    `\n\nThe screenshot is delivered as ${count} images that are consecutive slices of ONE page, top to bottom. ` +
    `Neighbouring slices overlap slightly, so a row near a cut can appear at the bottom of one image and the top of the next: ` +
    `treat it as one row and never repeat content. Describe and build a single page.`
  );
}

export function analysisPrompt(parts: number): string {
  return `Analyse this UI screenshot.${partsNote(parts)}`;
}

export function generationPrompt(analysis: Analysis, parts = 1): string {
  return `Here is the structural analysis of the screenshot (use it as the component plan, but trust the image for visual details):

${JSON.stringify(analysis, null, 2)}

Generate one file per component listed, then app/page.tsx that composes them.${partsNote(parts)}`;
}
