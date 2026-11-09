import type { DesignSystem } from "./design-system";
import { buildPreviewHtml } from "./preview-html";
import type { GeneratedFile } from "./types";

export interface Capture {
  dataUrl: string;
  width: number;
  height: number;
}

const TIMEOUT_MS = 25_000;

/**
 * Renders the generated page in a hidden sandboxed iframe at the given size and returns a picture of it.
 * Used to compare the result with the screenshot. Rejects if the page fails to render or takes too long
 * (for example when the CDN scripts cannot be loaded).
 */
export function captureRender(
  files: GeneratedFile[],
  size: { width: number; height: number },
  signal?: AbortSignal,
  designSystem?: DesignSystem | null,
): Promise<Capture> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.title = "Capture frame";
    Object.assign(iframe.style, {
      position: "fixed",
      left: "-100000px",
      top: "0",
      width: `${size.width}px`,
      height: `${size.height}px`,
      border: "0",
      opacity: "0",
      pointerEvents: "none",
    });

    const done = (finish: () => void) => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      signal?.removeEventListener("abort", onAbort);
      iframe.remove();
      finish();
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      const d = e.data;
      if (d?.type === "preview-capture" && typeof d.dataUrl === "string") {
        done(() => resolve({ dataUrl: d.dataUrl, width: Number(d.width), height: Number(d.height) }));
      } else if (d?.type === "preview-capture-error" || d?.type === "preview-error") {
        done(() => reject(new Error(String(d.message))));
      }
    };
    const onAbort = () => done(() => reject(new DOMException("Aborted", "AbortError")));
    const timer = setTimeout(() => done(() => reject(new Error("The preview took too long to render."))), TIMEOUT_MS);

    window.addEventListener("message", onMessage);
    signal?.addEventListener("abort", onAbort);
    iframe.srcdoc = buildPreviewHtml(files, { capture: true, designSystem });
    document.body.appendChild(iframe);
  });
}
