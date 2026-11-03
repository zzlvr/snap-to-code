"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * Listens for messages posted by the sandboxed preview iframe.
 * `ready` stays false while the CDN scripts load and the code compiles (a few seconds on a cold cache),
 * so the UI can show progress instead of an empty white box.
 */
export function usePreviewStatus(frameRef: RefObject<HTMLIFrameElement | null>) {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      // The iframe has an opaque origin, so identify it by its window instead of by origin.
      if (e.source !== frameRef.current?.contentWindow) return;
      if (e.data?.type === "preview-error") setError(String(e.data.message));
      if (e.data?.type === "preview-ok") {
        setError(null);
        setReady(true);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameRef]);

  const reset = useCallback(() => {
    setError(null);
    setReady(false);
  }, []);

  return { error, ready, reset };
}
