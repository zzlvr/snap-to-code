"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Settings2, Sparkles, Square, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useImageIntake } from "@/hooks/use-image-intake";
import { useSettings } from "@/hooks/use-settings";
import { filesToImageData } from "@/lib/image";
import { detectLocalModels, type LocalModels } from "@/lib/local-detect";
import { runPipeline } from "@/lib/pipeline";
import { getPreset, validateConfig } from "@/lib/providers";
import type { Analysis, GeneratedFile, ImageData, Stage } from "@/lib/types";
import { AnalysisView } from "./analysis-view";
import { CodeViewer } from "./code-viewer";
import { CompareView, OriginalStage } from "./compare-view";
import { Dropzone } from "./dropzone";
import { ModelDialog } from "./model-dialog";
import { PreviewFrame } from "./preview-frame";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  analyzing: "Step 1 of 2: reading the interface structure…",
  generating: "Step 2 of 2: writing components…",
  done: "Done. Drag the handle to compare.",
  error: "",
};

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-center text-sm text-muted-foreground">{children}</p>;
}

export function Studio() {
  const { providerId, profile, config, loaded, touched, setProvider, patch, setKey, applyLocal } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [finding, setFinding] = useState(false);
  const probed = useRef(false);
  const [image, setImage] = useState<ImageData | null>(null);
  // The screenshots the page is built from, in order. Kept in a ref too so quick consecutive pastes never race.
  const [sourceCount, setSourceCount] = useState(0);
  const sources = useRef<File[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const addInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [tab, setTab] = useState("compare");
  const abortRef = useRef<AbortController | null>(null);

  const busy = stage === "analyzing" || stage === "generating";
  const configProblem = validateConfig(providerId, config);
  const resultReady = stage === "done" && files.length > 0;

  function resetResult() {
    setStage("idle");
    setAnalysis(null);
    setFiles([]);
    setTab("compare");
  }

  /** Rebuilds the page from a new list of screenshots. Calls run one after another. */
  function setSources(change: (current: File[]) => File[]) {
    queue.current = queue.current.then(async () => {
      const next = change(sources.current);
      if (next.length === 0) {
        sources.current = [];
        setSourceCount(0);
        setImage(null);
        resetResult();
        return;
      }
      try {
        const img = await filesToImageData(next);
        sources.current = next;
        setSourceCount(next.length);
        setImage(img);
        resetResult();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not read the image");
      }
    });
  }
  const accept = useImageIntake((files) => setSources((cur) => [...cur, ...files]), busy);

  function announceFound(found: LocalModels) {
    applyLocal(found);
    toast.success(`Found ${found.models[0]} on ${found.label}. No API key needed.`);
  }

  async function findLocal() {
    setFinding(true);
    const found = await detectLocalModels();
    setFinding(false);
    if (found.length === 0) {
      toast.error(
        "No local vision models found. Start Ollama (or LM Studio) with a vision model, " +
          'and for Ollama on a deployed site set OLLAMA_ORIGINS="*".',
      );
      return;
    }
    announceFound(found[0]);
  }

  // First visit on a developer machine: if a local vision model is already running, just use it.
  // Only on localhost, so a deployed site never probes visitors' local ports unprompted.
  useEffect(() => {
    if (!loaded || touched || probed.current) return;
    probed.current = true;
    if (!["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) return;
    void detectLocalModels().then((found) => {
      if (found[0]) {
        applyLocal(found[0]);
        toast.success(`Found ${found[0].models[0]} on ${found[0].label}. No API key needed.`);
      }
    });
  }, [loaded, touched, applyLocal]);

  async function generate() {
    if (!image) return;
    if (configProblem) {
      setSettingsOpen(true); // a missing key is fixed in the settings dialog, not by an error toast
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAnalysis(null);
    setFiles([]);
    setTab("compare");
    try {
      const result = await runPipeline(
        config,
        image,
        {
          onStage: (s) => {
            setStage(s);
            if (s === "generating") setTab("code");
          },
          onAnalysis: setAnalysis,
          onFiles: setFiles,
        },
        ctrl.signal,
      );
      setFiles(result);
      setStage("done");
      setTab("compare");
    } catch (e) {
      if (ctrl.signal.aborted) {
        setStage("idle");
        return;
      }
      setStage("error");
      toast.error(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  }

  const modelLabel = loaded ? `${getPreset(providerId).label.replace(/ \(.*\)$/, "")} · ${config.model || "no model"}` : "Model";

  return (
    <div id="studio" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-12">
      <header className="flex items-center justify-between gap-4 pt-8">
        <div className="flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 36 36" fill="none" aria-hidden="true">
            <path d="M3 11V3h8M25 3h8v8M33 25v8h-8M11 33H3v-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
            <rect x="14" y="14" width="8" height="8" fill="var(--lime)" />
          </svg>
          <h1 translate="no" className="font-heading text-2xl font-bold leading-none tracking-tight">
            Snap to Code
          </h1>
        </div>
        <Button variant="outline" onClick={() => setSettingsOpen(true)} aria-haspopup="dialog" className="max-w-[60vw]">
          <Settings2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{modelLabel}</span>
          {loaded && configProblem && (
            <span className="shrink-0 rounded-full bg-lime px-2 py-0.5 text-xs font-semibold text-foreground">Set up</span>
          )}
        </Button>
      </header>

      {!image ? (
        <section aria-labelledby="hero" className="space-y-6 pt-4">
          <div className="space-y-2">
            <h2 id="hero" className="font-heading text-4xl font-bold leading-tight tracking-tight text-balance sm:text-5xl">
              Paste a screenshot.
              <br />
              Get React components.
            </h2>
            <p className="max-w-xl text-muted-foreground">
              Tailwind and shadcn/ui, split into files, with a live side-by-side check against your original. Bring your own
              model: your key and images never leave the browser.
            </p>
          </div>
          <Dropzone onFiles={accept} />
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex min-h-5 items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
              {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {STAGE_LABEL[stage]}
              {stage === "idle" &&
                !configProblem &&
                `Ready. ${sourceCount > 1 ? `${sourceCount} screenshots stacked top to bottom. ` : ""}${
                  image.parts.length > 1 ? `The model will see them in ${image.parts.length} parts. ` : ""
                }Generate code from this ${sourceCount > 1 ? "page" : "screenshot"}.`}
              {stage === "idle" && configProblem && configProblem}
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={addInput}
                type="file"
                name="more-screenshots"
                accept="image/*"
                multiple
                className="hidden"
                tabIndex={-1}
                onChange={(e) => {
                  accept(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button variant="outline" disabled={busy} onClick={() => addInput.current?.click()}>
                <ImagePlus className="h-4 w-4" aria-hidden="true" /> Add part
              </Button>
              {sourceCount > 1 && (
                <Button variant="outline" disabled={busy} onClick={() => setSources((cur) => cur.slice(0, -1))}>
                  <Undo2 className="h-4 w-4" aria-hidden="true" /> Undo last
                </Button>
              )}
              <Button variant="outline" disabled={busy} onClick={() => setSources(() => [])}>
                New screenshot
              </Button>
              {busy ? (
                <Button variant="outline" onClick={() => abortRef.current?.abort()}>
                  <Square className="h-4 w-4" aria-hidden="true" /> Stop
                </Button>
              ) : (
                <Button
                  className="border border-foreground/15 bg-lime font-semibold text-foreground hover:bg-lime/80"
                  onClick={generate}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> {resultReady ? "Regenerate" : "Generate code"}
                </Button>
              )}
            </div>
          </div>

          <section aria-label="Result" className="min-w-0 rounded-md border bg-card p-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="compare">Compare</TabsTrigger>
                <TabsTrigger value="live" disabled={!resultReady}>
                  Live preview
                </TabsTrigger>
                <TabsTrigger value="code">Code{files.length > 0 && ` (${files.length})`}</TabsTrigger>
                <TabsTrigger value="analysis">Structure</TabsTrigger>
              </TabsList>
              <TabsContent value="compare" className="mt-4">
                {resultReady ? (
                  <CompareView image={image} files={files} />
                ) : (
                  <OriginalStage image={image} scanning={stage === "analyzing"} />
                )}
              </TabsContent>
              <TabsContent value="live" className="mt-4">
                {resultReady ? <PreviewFrame files={files} /> : <Empty>The live preview appears once the code is ready.</Empty>}
              </TabsContent>
              <TabsContent value="code" className="mt-4">
                <CodeViewer files={files} busy={busy} />
              </TabsContent>
              <TabsContent value="analysis" className="mt-4">
                <AnalysisView analysis={analysis} />
              </TabsContent>
            </Tabs>
          </section>
        </>
      )}

      <ModelDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        problem={settingsOpen ? configProblem : null}
        busy={busy}
        providerId={providerId}
        profile={profile}
        finding={finding}
        onProvider={setProvider}
        onChange={patch}
        onKey={setKey}
        onFindLocal={() => void findLocal()}
      />
    </div>
  );
}
