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

describe("buildPreviewHtml capture mode", () => {
  const files = [{ path: "app/page.tsx", code: "export default function P() { return <main /> }" }];

  it("only draws the page into an image when asked to", () => {
    expect(buildPreviewHtml(files)).not.toContain("window.__CAPTURE__ = true");
    expect(buildPreviewHtml(files, { capture: true })).toContain("window.__CAPTURE__ = true");
  });

  it("needs no extra script source for the capture", () => {
    const plain = buildPreviewHtml(files).match(/<script src="[^"]+"/g);
    const capture = buildPreviewHtml(files, { capture: true }).match(/<script src="[^"]+"/g);
    expect(capture).toEqual(plain);
  });
});
