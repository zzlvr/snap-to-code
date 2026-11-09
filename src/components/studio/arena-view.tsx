"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Square, Swords, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreviewStatus } from "@/hooks/use-preview-status";
import { MAX_ARENA, entryLabel, entryProblem, formatDuration, summarizeFiles, type ArenaEntry, type ArenaRun } from "@/lib/arena";
import type { DesignSystem } from "@/lib/design-system";
import { buildPreviewHtml } from "@/lib/preview-html";
import { PROVIDERS, getPreset } from "@/lib/providers";
import type { GeneratedFile, ImageData, LLMConfig } from "@/lib/types";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A finished result drawn at the screenshot width and scaled down to the card. */
function ScaledPreview({ files, image, designSystem }: { files: GeneratedFile[]; image: ImageData; designSystem: DesignSystem | null }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.3);
  const { error, ready } = usePreviewStatus(frameRef);
  const html = useMemo(() => buildPreviewHtml(files, { designSystem }), [files, designSystem]);
  const width = clamp(image.width, 360, 1920);
  const height = Math.round((image.height * width) / image.width);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div>
      <div ref={boxRef} className="relative w-full overflow-hidden rounded-md border bg-white" style={{ aspectRatio: `${width} / ${height}` }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ width, height, transform: `scale(${scale})` }}>
          <iframe
            ref={frameRef}
            title="Result preview"
            sandbox="allow-scripts"
            srcDoc={html}
            tabIndex={-1}
            className="block h-full w-full border-0 bg-white"
          />
        </div>
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/70">
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          The page has an error and may not render fully.
        </p>
      )}
    </div>
  );
}

function statusText(run: ArenaRun): string {
  if (run.status === "running") {
    const n = run.files.length;
    return run.stage === "analyzing" ? "Reading the structure…" : `Writing code…${n > 0 ? ` ${n} file${n === 1 ? "" : "s"}` : ""}`;
  }
  if (run.status === "done") return `Done in ${formatDuration(run.ms ?? 0)}`;
  if (run.status === "error") return "Failed";
  return "Waiting";
}

interface ArenaViewProps {
  image: ImageData;
  designSystem: DesignSystem | null;
  entries: ArenaEntry[];
  runs: Record<string, ArenaRun>;
  running: boolean;
  /** Blocks starting while the main generation is working. */
  disabled: boolean;
  configFor: (entry: ArenaEntry) => LLMConfig;
  onAdd: () => void;
  onChange: (id: string, change: Partial<ArenaEntry>) => void;
  onRemove: (id: string) => void;
  onStart: () => void;
  onStop: () => void;
  onUse: (files: GeneratedFile[], label: string) => void;
}

export function ArenaView(props: ArenaViewProps) {
  const { image, designSystem, entries, runs, running, disabled, configFor, onAdd, onChange, onRemove, onStart, onStop, onUse } = props;
  const problems = Object.fromEntries(entries.map((e) => [e.id, entryProblem(e, configFor(e), entries)]));
  const blocked = entries.length < 2 || entries.some((e) => problems[e.id]);
  const shown = entries.filter((e) => runs[e.id]);

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Run the same screenshot through up to {MAX_ARENA} models at once and compare the results. Every model does both steps with the key you saved for its
        provider, so the cost is the sum of the runs. Each result is the first version: the fix pass is not run. Keys are set in the model settings (top right).
      </p>

      <ul className="space-y-2" aria-label="Models to compare">
        {entries.map((e, i) => (
          <li key={e.id} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label={`Provider of model ${i + 1}`}
                value={e.providerId}
                disabled={running}
                onChange={(ev) => onChange(e.id, { providerId: ev.target.value, model: getPreset(ev.target.value).models[0] ?? "" })}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label.replace(/ \(.*\)$/, "")}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Model name ${i + 1}`}
                list={`models-${e.id}`}
                value={e.model}
                disabled={running}
                spellCheck={false}
                autoComplete="off"
                onChange={(ev) => onChange(e.id, { model: ev.target.value })}
                placeholder="model name"
                className="h-9 min-w-40 flex-1 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xs"
              />
              <datalist id={`models-${e.id}`}>
                {getPreset(e.providerId).models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <Button variant="outline" size="icon" disabled={running} onClick={() => onRemove(e.id)} aria-label={`Remove model ${i + 1}`}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            {problems[e.id] && <p className="text-xs text-destructive">{problems[e.id]}</p>}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={running || entries.length >= MAX_ARENA} onClick={onAdd}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add model
        </Button>
        {running ? (
          <Button variant="outline" onClick={onStop}>
            <Square className="h-4 w-4" aria-hidden="true" /> Stop
          </Button>
        ) : (
          <Button
            className="border border-foreground/15 bg-lime font-semibold text-foreground hover:bg-lime/80"
            disabled={blocked || disabled}
            onClick={onStart}
          >
            <Swords className="h-4 w-4" aria-hidden="true" /> Run {entries.length} models
          </Button>
        )}
        {entries.length < 2 && <span className="text-xs text-muted-foreground">Add at least two models.</span>}
      </div>

      {shown.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-md border p-3">
            <h2 className="text-sm font-semibold">Original</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.dataUrl} width={image.width} height={image.height} alt="Original screenshot" className="block h-auto w-full rounded-md border" />
          </div>
          {shown.map((e) => {
            const run = runs[e.id];
            const sum = summarizeFiles(run.files);
            return (
              <div key={e.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 break-words text-sm font-semibold">{entryLabel(e)}</h2>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground" role="status">
                    {run.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    {statusText(run)}
                  </span>
                </div>
                {run.status === "done" && run.files.length > 0 && <ScaledPreview files={run.files} image={image} designSystem={designSystem} />}
                {run.status === "error" && (
                  <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {run.error}
                  </p>
                )}
                {run.status === "done" && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {sum.files} files, {sum.lines} lines
                    </span>
                    <Button variant="outline" onClick={() => onUse(run.files, entryLabel(e))}>
                      Use this result
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
