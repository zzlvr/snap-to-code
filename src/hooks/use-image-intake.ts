"use client";

import { useCallback, useEffect, useRef } from "react";

const isImage = (f: File) => f.type.startsWith("image/");

/**
 * Collects image files from drop, the file picker and Ctrl/Cmd+V paste and hands them over as a list.
 * Returns `accept(files)`. The window-level paste listener is registered once and always
 * calls the latest callback through a ref.
 */
export function useImageIntake(onFiles: (files: File[]) => void, disabled?: boolean) {
  const accept = useCallback(
    (files: FileList | File[] | null | undefined) => {
      if (!files || disabled) return;
      const images = [...files].filter(isImage);
      // Not an image at all (a text file, say): let the loader explain it with its own message.
      onFiles(images.length > 0 ? images : [...files].slice(0, 1));
    },
    [onFiles, disabled],
  );

  const acceptRef = useRef(accept);
  useEffect(() => {
    acceptRef.current = accept;
  });

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const files = [...(e.clipboardData?.items ?? [])]
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length === 0) return; // plain-text paste is never touched
      e.preventDefault();
      acceptRef.current(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return accept;
}
