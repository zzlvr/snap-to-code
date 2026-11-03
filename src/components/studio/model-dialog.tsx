"use client";

import { useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsPanel } from "./settings-panel";

type PanelProps = Omit<React.ComponentProps<typeof SettingsPanel>, "disabled">;

interface Props extends PanelProps {
  open: boolean;
  onClose: () => void;
  /** Why generation cannot start yet (e.g. a missing key). Shown inline at the top. */
  problem: string | null;
  busy: boolean;
}

/** Model settings in a native <dialog>: focus trap, Esc to close and backdrop come from the browser. */
export function ModelDialog({ open, onClose, problem, busy, ...panel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="model-dialog-title"
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto max-h-[90vh] w-[min(92vw,460px)] overflow-y-auto overscroll-contain rounded-md border bg-card p-0 text-foreground backdrop:bg-foreground/40"
    >
      <div className="space-y-4 p-5">
        <h2 id="model-dialog-title" className="font-heading text-lg font-semibold">
          Model settings
        </h2>
        {problem && (
          <p role="alert" className="rounded-md border border-lime bg-lime/20 px-3 py-2 text-sm">
            {problem}
          </p>
        )}
        <SettingsPanel {...panel} disabled={busy} />
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Your key and images never leave the browser except to reach the model you chose. There is no backend.
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </dialog>
  );
}
