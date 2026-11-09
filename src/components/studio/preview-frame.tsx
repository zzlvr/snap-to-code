"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreviewStatus } from "@/hooks/use-preview-status";
import type { DesignSystem } from "@/lib/design-system";
import { buildPreviewHtml } from "@/lib/preview-html";
import type { GeneratedFile } from "@/lib/types";

type Size = "desktop" | "tablet" | "mobile";

const MIN_HEIGHT = 560;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Live preview of the generated page. Desktop uses the screenshot's own width, scaled down to fit, so the page
 * breaks into the same columns as the original. Tablet and mobile use fixed widths.
 */
export function PreviewFrame({ files, designWidth, designSystem }: { files: GeneratedFile[]; designWidth: number; designSystem?: DesignSystem | null }) {
  const [nonce, setNonce] = useState(0);
  const [size, setSize] = useState<Size>("desktop");
  const [box, setBox] = useState({ width: 0, height: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const sized = useRef(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { error, ready, reset } = usePreviewStatus(frameRef);

  // "Reload" only remounts the iframe (new key), so the HTML itself depends on files alone.
  const html = useMemo(() => buildPreviewHtml(files, { designSystem }), [files, designSystem]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ width, height });
      // On a phone a desktop-wide page would be shown at a quarter of its size: start at the phone width instead.
      if (!sized.current && width > 0) {
        sized.current = true;
        if (width < 600) setSize("mobile");
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const widths: Record<Size, number> = { desktop: clamp(Math.round(designWidth), 1024, 1920), tablet: 768, mobile: 390 };
  const frameWidth = widths[size];
  const scale = box.width > 0 ? Math.min(1, box.width / frameWidth) : 1;
  const shownHeight = Math.max(box.height, MIN_HEIGHT);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div role="group" aria-label="Preview width" className="inline-flex rounded-md border p-0.5">
            {(["desktop", "tablet", "mobile"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                aria-pressed={size === s}
                className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  size === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {frameWidth}px{scale < 1 ? `, shown at ${Math.round(scale * 100)}%` : ""}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            reset();
            setNonce((n) => n + 1);
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Reload
        </Button>
      </div>
      <div
        ref={boxRef}
        className="relative flex-1 overflow-auto rounded-md border bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] overscroll-contain"
        style={{ minHeight: MIN_HEIGHT }}
      >
        {!ready && !error && (
          <p
            role="status"
            className="pointer-events-none absolute inset-x-0 top-6 z-10 mx-auto flex w-fit items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-sm"
          >
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Rendering the generated UI…
          </p>
        )}
        {/* The iframe has the real width; the wrapper shrinks it to the space available. */}
        <div className="mx-auto" style={{ width: frameWidth * scale, height: shownHeight }}>
          <div className="origin-top-left" style={{ width: frameWidth, height: shownHeight / scale, transform: `scale(${scale})` }}>
            <iframe
              ref={frameRef}
              key={nonce}
              title="Live preview"
              // No allow-same-origin: generated code runs in an opaque origin and cannot touch this app.
              sandbox="allow-scripts"
              srcDoc={html}
              className="block h-full w-full border-0 bg-white"
            />
          </div>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive"
        >
          {error.slice(0, 400)}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        The preview uses simplified shadcn/ui components and loads Tailwind and React from a CDN, so it needs an internet connection.
      </p>
    </div>
  );
}
