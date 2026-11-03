"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildPreviewHtml(files), [files, nonce]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== frameRef.current?.contentWindow) return;
      if (e.data?.type === "preview-error") setError(String(e.data.message));
      if (e.data?.type === "preview-ok") setError(null);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-md border p-0.5">
          {WIDTHS.map((w) => (
            <button
              key={w.label}
              type="button"
              onClick={() => setWidth(w.width)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
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
            setError(null);
            setNonce((n) => n + 1);
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Обновить
        </Button>
      </div>
      <div className="flex-1 overflow-auto rounded-lg border bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
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
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {error.slice(0, 400)}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Превью использует упрощённые версии shadcn/ui и подгружает Tailwind/React с CDN, поэтому нужен интернет.
      </p>
    </div>
  );
}
