"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreviewStatus } from "@/hooks/use-preview-status";
import { buildPreviewHtml } from "@/lib/preview-html";
import type { GeneratedFile } from "@/lib/types";

const WIDTHS = [
  { label: "Desktop", width: "100%" },
  { label: "Tablet", width: "768px" },
  { label: "Mobile", width: "390px" },
] as const;

export function PreviewFrame({ files }: { files: GeneratedFile[] }) {
  const [nonce, setNonce] = useState(0);
  const [width, setWidth] = useState<(typeof WIDTHS)[number]["width"]>("100%");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { error, ready, reset } = usePreviewStatus(frameRef);

  // "Reload" only remounts the iframe (new key), so the HTML itself depends on files alone.
  const html = useMemo(() => buildPreviewHtml(files), [files]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div role="group" aria-label="Preview width" className="inline-flex rounded-md border p-0.5">
          {WIDTHS.map((w) => (
            <button
              key={w.label}
              type="button"
              onClick={() => setWidth(w.width)}
              aria-pressed={width === w.width}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                width === w.width ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {w.label}
            </button>
          ))}
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
      <div className="relative flex-1 overflow-auto rounded-md border bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] overscroll-contain">
        {!ready && !error && (
          <p
            role="status"
            className="pointer-events-none absolute inset-x-0 top-6 z-10 mx-auto flex w-fit items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-sm"
          >
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Rendering the generated UI…
          </p>
        )}
        <iframe
          ref={frameRef}
          key={nonce}
          title="Live preview"
          // No allow-same-origin: generated code runs in an opaque origin and cannot touch this app.
          sandbox="allow-scripts"
          srcDoc={html}
          style={{ width }}
          className="mx-auto block h-full min-h-[560px] max-w-full bg-white"
        />
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
