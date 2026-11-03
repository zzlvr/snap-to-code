"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsLeftRight, Loader2 } from "lucide-react";
import { usePreviewStatus } from "@/hooks/use-preview-status";
import { buildPreviewHtml } from "@/lib/preview-html";
import type { GeneratedFile, ImageData } from "@/lib/types";
import { Brackets } from "./dropzone";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The screenshot alone, with the scan sweep while the model is reading it. */
export function OriginalStage({ image, scanning }: { image: ImageData; scanning?: boolean }) {
  return (
    <div className="relative bg-card p-4">
      <div className="relative mx-auto w-fit max-w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.dataUrl}
          width={image.width}
          height={image.height}
          alt="Uploaded interface screenshot"
          className="block max-h-[70vh] w-auto max-w-full"
        />
        {scanning && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="scan-band h-1/4 w-full" />
          </div>
        )}
      </div>
      <Brackets active={scanning} />
    </div>
  );
}

/**
 * Original screenshot on the left, the rendered result on the right, one draggable divider.
 * The result is rendered at the screenshot's own width and scaled to fit, so both sides line up.
 */
export function CompareView({ image, files }: { image: ImageData; files: GeneratedFile[] }) {
  const [pos, setPos] = useState(50);
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { error, ready } = usePreviewStatus(frameRef);

  const html = useMemo(() => buildPreviewHtml(files), [files]);
  const viewportW = clamp(image.width, 360, 1920);
  const viewportH = Math.round((image.height * viewportW) / image.width);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / viewportW));
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewportW]);

  function moveTo(clientX: number) {
    const rect = boxRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0) setPos(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100));
  }

  return (
    <div className="space-y-2">
      {/* The handle lives outside the clipping layer below, so it stays grabbable at 0% and 100%. */}
      <div ref={boxRef} className="relative w-full select-none" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
        <div className="absolute inset-0 overflow-hidden rounded-md border bg-white">
          {/* Result layer: a sandboxed iframe at the screenshot's width, scaled down to the box. */}
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ width: viewportW, height: viewportH, transform: `scale(${scale})` }}
          >
            <iframe
              ref={frameRef}
              title="Generated result"
              // No allow-same-origin: generated code runs in an opaque origin and cannot touch this app.
              sandbox="allow-scripts"
              srcDoc={html}
              className="block h-full w-full border-0 bg-white"
            />
          </div>

          {!ready && !error && (
            <p
              role="status"
              className="pointer-events-none absolute right-0 top-1/2 flex w-1/2 -translate-y-1/2 items-center justify-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Rendering the generated UI…
            </p>
          )}

          {/* Original layer on top, clipped to the left of the divider (clipped areas pass clicks through). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.dataUrl}
            width={image.width}
            height={image.height}
            alt="Original screenshot"
            draggable={false}
            className="absolute inset-0 h-full w-full object-fill"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          />

          {/* Bottom corners: the top of a screenshot is usually a header worth seeing. */}
          <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-foreground/85 px-2 py-0.5 text-xs font-medium text-background">
            Original
          </span>
          <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-lime px-2 py-0.5 text-xs font-medium text-foreground">
            Generated
          </span>
        </div>

        <div
          role="slider"
          tabIndex={0}
          aria-label="Compare original and generated"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          aria-valuetext={`${Math.round(pos)}% original`}
          className="group absolute inset-y-0 z-10 w-8 -translate-x-1/2 cursor-ew-resize touch-none outline-none"
          style={{ left: `${pos}%` }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
            moveTo(e.clientX);
          }}
          onPointerMove={(e) => dragging && moveTo(e.clientX)}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            setDragging(false);
          }}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 10 : 2;
            if (e.key === "ArrowLeft") setPos((p) => clamp(p - step, 0, 100));
            else if (e.key === "ArrowRight") setPos((p) => clamp(p + step, 0, 100));
            else if (e.key === "Home") setPos(0);
            else if (e.key === "End") setPos(100);
            else return;
            e.preventDefault();
          }}
        >
          <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-lime shadow-[0_0_0_1px_rgba(16,17,20,0.35)]" />
          <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-foreground bg-lime text-foreground shadow group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2">
            <ChevronsLeftRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {error.slice(0, 400)}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Drag the handle, or focus it and use the arrow keys (Shift for bigger steps). Differences usually come from the
        model or from the simplified shadcn/ui stand-ins in the preview.
      </p>
    </div>
  );
}
