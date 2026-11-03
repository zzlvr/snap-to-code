"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { fileToImageData } from "@/lib/image";
import type { ImageData } from "@/lib/types";

/**
 * Turns image files into `ImageData`: used by drop, file picker and Ctrl/Cmd+V paste.
 * Returns `accept(file)`. The window-level paste listener is registered once and always
 * calls the latest callback through a ref.
 */
export function useImageIntake(onImage: (img: ImageData) => void, disabled?: boolean) {
  const accept = useCallback(
    async (file: File | undefined | null) => {
      if (!file || disabled) return;
      try {
        onImage(await fileToImageData(file));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not read the image");
      }
    },
    [onImage, disabled],
  );

  const acceptRef = useRef(accept);
  useEffect(() => {
    acceptRef.current = accept;
  });

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (!item) return; // plain-text paste is never touched
      e.preventDefault();
      void acceptRef.current(item.getAsFile());
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return accept;
}
