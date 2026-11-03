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
  onImage: (img: ImageData | null) => void;
}

export function Dropzone({ image, disabled, onImage }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function accept(file: File | undefined | null) {
    if (!file || disabled) return;
    try {
      onImage(await fileToImageData(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось прочитать изображение");
    }
  }

  // Global Ctrl/Cmd+V: grab the first image from the clipboard.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (!item) return;
      e.preventDefault();
      accept(item.getAsFile());
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  if (image) {
    return (
      <div className="group relative overflow-hidden rounded-xl border bg-muted/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.dataUrl} alt="Загруженный скриншот" className="max-h-72 w-full object-contain" />
        {!disabled && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => onImage(null)}
            aria-label="Убрать изображение"
          >
            <X className="h-4 w-4" />
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
        "flex h-56 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 text-center transition-colors",
        "hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragging && "border-primary bg-muted/60",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <ImageUp className="h-8 w-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Перетащите скриншот или нажмите, чтобы выбрать</p>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ClipboardPaste className="h-3.5 w-3.5" />
          или вставьте из буфера: <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Ctrl/⌘ + V</kbd>
        </p>
      </div>
    </button>
  );
}
