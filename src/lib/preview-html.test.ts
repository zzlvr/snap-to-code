import { describe, expect, it } from "vitest";
import { buildPreviewHtml } from "./preview-html";

describe("buildPreviewHtml", () => {
  const html = buildPreviewHtml([
    { path: "app/page.tsx", code: 'export default function Page() { return <main className="dark bg-background">Hi</main>; }' },
  ]);

  it("defines the light and the dark colour variables", () => {
    expect(html).toContain(":root{--background:0 0% 100%");
    expect(html).toContain(".dark{--background:0 0% 3.9%");
  });

  it("lets Tailwind switch themes by class", () => {
    expect(html).toContain('darkMode: "class"');
  });
});
