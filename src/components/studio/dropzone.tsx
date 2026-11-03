"use client";

import { useRef, useState } from "react";
import { ClipboardPaste, ImageUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Four crop marks, like a camera viewfinder. They tighten and turn lime when active.
 * Movement uses transform only, so it stays on the compositor.
 */
export function Brackets({ active }: { active?: boolean }) {
  const base = cn(
    "pointer-events-none absolute h-7 w-7 border-foreground/50 transition-transform duration-150 motion-reduce:transition-none",
    active && "border-lime",
  );
  return (
    <>
      <span aria-hidden="true" className={cn(base, "left-0 top-0 border-l-2 border-t-2", active && "translate-x-2 translate-y-2")} />
      <span aria-hidden="true" className={cn(base, "right-0 top-0 border-r-2 border-t-2", active && "-translate-x-2 translate-y-2")} />
      <span aria-hidden="true" className={cn(base, "bottom-0 left-0 border-b-2 border-l-2", active && "-translate-y-2 translate-x-2")} />
      <span aria-hidden="true" className={cn(base, "bottom-0 right-0 border-b-2 border-r-2", active && "-translate-x-2 -translate-y-2")} />
    </>
  );
}

interface Props {
  onFile: (file: File | undefined) => void;
}

/** The empty state of the app: one big viewfinder asking for a screenshot. */
export function Dropzone({ onFile }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Outside the button: interactive content may not be nested inside <button>. */}
      <input
        ref={inputRef}
        type="file"
        name="screenshot"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          // Moving over a child element fires dragleave too; only reset when truly leaving the zone.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "relative flex h-[min(52vh,440px)] min-h-72 w-full flex-col items-center justify-center gap-4 bg-card px-6 text-center transition-colors",
          "hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          dragging && "bg-lime/25",
        )}
      >
        <Brackets active={dragging} />
        <ImageUp className="h-9 w-9 text-muted-foreground" aria-hidden="true" />
        {/* Spans only: a <button> may contain phrasing content, not <div>/<p>. */}
        <span className="flex flex-col items-center gap-2">
          <span className="font-heading text-xl font-semibold">Drop a screenshot or choose a file</span>
          <span className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
            Or paste from the clipboard:&nbsp;
            <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-xs">Ctrl/⌘&nbsp;+&nbsp;V</kbd>
          </span>
        </span>
      </button>
    </>
  );
}
