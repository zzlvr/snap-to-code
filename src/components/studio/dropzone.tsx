"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, ImageUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fileToImageData } from "@/lib/image";
import type { ImageData } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  image: ImageData | null;
  disabled?: boolean;
  /** True while the model is analysing: sweeps a scan band over the screenshot. */
  scanning?: boolean;
  onImage: (img: ImageData | null) => void;
}

/** Four crop marks, like a camera viewfinder. They tighten and turn lime when active. */
function Brackets({ active }: { active?: boolean }) {
  const base = cn(
    "pointer-events-none absolute h-6 w-6 border-foreground/50 transition-[inset,border-color] duration-150",
    active && "border-lime",
  );
  const inset = active ? "8px" : "0px";
  return (
    <>
      <span aria-hidden="true" className={cn(base, "border-l-2 border-t-2")} style={{ left: inset, top: inset }} />
      <span aria-hidden="true" className={cn(base, "border-r-2 border-t-2")} style={{ right: inset, top: inset }} />
      <span aria-hidden="true" className={cn(base, "border-b-2 border-l-2")} style={{ left: inset, bottom: inset }} />
      <span aria-hidden="true" className={cn(base, "border-b-2 border-r-2")} style={{ right: inset, bottom: inset }} />
    </>
  );
}

export function Dropzone({ image, disabled, scanning, onImage }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function accept(file: File | undefined | null) {
    if (!file || disabled) return;
    try {
      onImage(await fileToImageData(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the image");
    }
  }

  // The paste listener is registered once; it always calls the latest `accept` through a ref.
  const acceptRef = useRef(accept);
  useEffect(() => {
    acceptRef.current = accept;
  });

  // Global Ctrl/Cmd+V: grab the first image from the clipboard.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (!item) return;
      e.preventDefault();
      acceptRef.current(item.getAsFile());
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  if (image) {
    return (
      <div className="group relative bg-card p-3">
        <div className="relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.dataUrl}
            width={image.width}
            height={image.height}
            alt="Uploaded interface screenshot"
            className="max-h-72 w-full object-contain"
          />
          {scanning && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              <div className="scan-band h-1/4 w-full" />
            </div>
          )}
        </div>
        <Brackets active={scanning} />
        {!disabled && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute right-4 top-4 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => onImage(null)}
            aria-label="Remove screenshot"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        accept(e.dataTransfer.files[0]);
      }}
      className={cn(
        "relative flex h-56 w-full flex-col items-center justify-center gap-3 bg-card px-6 text-center transition-colors",
        "hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        dragging && "bg-lime/25",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        name="screenshot"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Brackets active={dragging} />
      <ImageUp className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Drop a screenshot or choose a file</p>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />
          Or paste from the clipboard:&nbsp;
          <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">Ctrl/⌘&nbsp;+&nbsp;V</kbd>
        </p>
      </div>
    </button>
  );
}
