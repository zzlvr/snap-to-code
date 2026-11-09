"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Palette, Settings2, Sparkles, Square, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useArena } from "@/hooks/use-arena";
import { useImageIntake } from "@/hooks/use-image-intake";
import { useLiveModels } from "@/hooks/use-live-models";
import { MAX_ROUNDS, useRounds } from "@/hooks/use-rounds";
import { useSettings } from "@/hooks/use-settings";
import { captureRender } from "@/lib/capture";
import { extractDesignSystem, hasDesignSystem, type DesignSystem, type InputFile } from "@/lib/design-system";
import { filesToImageData, pictureToParts } from "@/lib/image";
import { detectLocalModels, type LocalModels } from "@/lib/local-detect";
import { bestModel, fetchModelIds, lighterModel } from "@/lib/models";
import { runPipeline } from "@/lib/pipeline";
import { getPreset, validateConfig } from "@/lib/providers";
import { refineOnce } from "@/lib/refine";
import { ApiError } from "@/lib/sse";
import type { LLMConfig } from "@/lib/types";
import type { Analysis, GeneratedFile, ImageData, Stage } from "@/lib/types";
import { AnalysisView } from "./analysis-view";
import { CodeViewer } from "./code-viewer";
import { CompareView, OriginalStage } from "./compare-view";
import { Dropzone } from "./dropzone";
import { ModelDialog } from "./model-dialog";
import { PreviewFrame } from "./preview-frame";
import { ArenaView } from "./arena-view";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  analyzing: "Step 1 of 2: reading the interface structure…",
  generating: "Step 2 of 2: writing components…",
  refining: "Checking the result against your screenshot…",
  done: "Done. Drag the handle to compare.",
  error: "",
};

/** Tabs wrap on a narrow screen and are tall enough to tap. */
const TAB = "h-9 flex-none px-3";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-center text-sm text-muted-foreground">{children}</p>;
}

export function Studio() {
  const { providerId, profile, config, configFor, loaded, touched, setProvider, patch, setKey, applyLocal } = useSettings();
  const arena = useArena();
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
  const [notice, setNotice] = useState<string | null>(null);
  // The model that actually produced the result: it can differ from the setting after a fallback or a retired model.
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { rounds, setRounds } = useRounds();
  // The project's own styling (theme CSS, Tailwind config, UI components), read from files the user adds. Stays in this tab.
  const [designFiles, setDesignFiles] = useState<InputFile[]>([]);
  const designSystem = useMemo<DesignSystem | null>(() => (designFiles.length > 0 ? extractDesignSystem(designFiles) : null), [designFiles]);
  const designInput = useRef<HTMLInputElement>(null);
  // The files as first written, kept while corrections are applied so they can be undone.
  const [uncorrected, setUncorrected] = useState<GeneratedFile[] | null>(null);

  const busy = stage === "analyzing" || stage === "generating" || stage === "refining";
  const liveModels = useLiveModels(providerId, config, (model) => patch({ model }));
  const configProblem = validateConfig(providerId, config);
  const resultReady = stage === "done" && files.length > 0;

  function resetResult() {
    setStage("idle");
    setAnalysis(null);
    setFiles([]);
    setUncorrected(null);
    arena.clearResults();
    setTab("compare");
  }

  /** Two models to start the comparison with: the current one and a neighbour from the same provider. */
  function seedArena() {
    const ids = liveModels.length > 0 ? liveModels : getPreset(providerId).models;
    const other = lighterModel(providerId, ids, config.model) ?? ids.find((m) => m !== config.model) ?? "";
    arena.addEntry(providerId, config.model);
    arena.addEntry(providerId, other);
  }

  function loadArenaResult(result: GeneratedFile[], label: string) {
    setFiles(result);
    setUsedModel(label);
    setUncorrected(null);
    setStage("done");
    setTab("compare");
    toast.success(`Loaded the result of ${label}. It is now in Compare, Live preview and Code.`);
  }

  /**
   * Correction rounds: draws the page, shows the model the design next to the picture, and applies the files it changes.
   * Never fails the run: on any problem the version written so far is kept.
   */
  async function correct(cfg: LLMConfig, start: GeneratedFile[], img: ImageData, ctrl: AbortController): Promise<GeneratedFile[]> {
    let current = start;
    for (let round = 1; round <= rounds; round++) {
      if (ctrl.signal.aborted) break;
      setStage("refining");
      setNotice(`Checking the result against your screenshot (round ${round} of ${rounds})…`);
      try {
        const shot = await captureRender(current, { width: Math.max(320, img.width), height: Math.min(img.height, 1600) }, ctrl.signal, designSystem);
        const render = await pictureToParts(shot.dataUrl, shot.width, shot.height);
        const result = await refineOnce(cfg, img.parts, render, current, ctrl.signal, designSystem);
        if (result.changed.length === 0) break;
        current = result.files;
        setFiles(current);
        setUncorrected((prev) => prev ?? start);
      } catch (e) {
        if (!ctrl.signal.aborted) {
          toast.info(`Could not check the result against the screenshot: ${(e instanceof Error ? e.message : "unknown error").replace(/\.+$/, "")}. Kept the first version.`);
        }
        break;
      }
    }
    setNotice(null);
    return current;
  }

  async function addDesignFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    const read = await Promise.all(picked.map(async (f) => ({ name: f.name, text: await f.text() })));
    // Files added later join the earlier ones; a file with the same name replaces its older copy.
    const next = [...designFiles.filter((old) => !read.some((r) => r.name === old.name)), ...read];
    const ds = extractDesignSystem(next);
    if (!hasDesignSystem(ds)) {
      toast.error("No styling found. Add your globals.css, tailwind.config and the files from components/ui.");
      return;
    }
    setDesignFiles(next);
    toast.success(`Using your design system (${ds.sources.join(", ")}). Generate again to apply it.`);
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

  /**
   * The provider says the model does not exist (it was retired or renamed): ask it what is available,
   * switch to the best model and report it. Returns the new config, or null if there is nothing better.
   */
  async function recoverModel(cfg: LLMConfig): Promise<LLMConfig | null> {
    const ids = await fetchModelIds(providerId, cfg);
    const next = bestModel(providerId, ids, cfg.model);
    if (!next) return null;
    patch({ model: next });
    toast.info(`${cfg.model} is not available for your key. Switched to ${next} and trying again.`);
    return { ...cfg, model: next };
  }

  async function generate(cfg: LLMConfig = config, retried = false, fellBack = false) {
    if (!image) return;
    if (configProblem) {
      setSettingsOpen(true); // a missing key is fixed in the settings dialog, not by an error toast
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAnalysis(null);
    setFiles([]);
    setNotice(null);
    setUsedModel(null);
    setUncorrected(null);
    setTab("compare");
    // With a lighter model to fall back on, one retry is enough: waiting on a busy model rarely helps.
    const fallback = fellBack ? null : lighterModel(providerId, liveModels.length > 0 ? liveModels : getPreset(providerId).models, cfg.model);
    try {
      const result = await runPipeline(
        cfg,
        image,
        {
          onStage: (s) => {
            setNotice(null);
            setStage(s);
            if (s === "generating") setTab("code");
          },
          onAnalysis: (a) => {
            setNotice(null);
            setAnalysis(a);
          },
          onFiles: (f) => {
            setNotice(null);
            setFiles(f);
          },
          onRetry: (attempt, attempts) => setNotice(`The model is busy. Trying again (try ${attempt} of ${attempts})…`),
        },
        ctrl.signal,
        { retryDelays: fallback ? [3] : undefined, designSystem },
      );
      setFiles(result);
      setUsedModel(cfg.model);
      const final = rounds > 0 ? await correct(cfg, result, image, ctrl) : result;
      setFiles(final);
      setStage("done");
      setTab("compare");
    } catch (e) {
      if (ctrl.signal.aborted) {
        setStage("idle");
        return;
      }
      if (!retried && e instanceof ApiError && e.status === 404) {
        const next = await recoverModel(cfg);
        if (next) return generate(next, true);
      }
      // The model stayed busy or out of quota: try the lighter one once, for this run only. Your setting is not changed.
      if (fallback && e instanceof ApiError && (e.status === 429 || e.status >= 500)) {
        toast.info(`${cfg.model} is busy. Trying ${fallback} for this run.`);
        return generate({ ...cfg, model: fallback }, retried, true);
      }
      setNotice(null);
      setStage("error");
      const message = e instanceof Error ? e.message : "Something went wrong. Try again.";
      // Out of quota: offer the lighter model in one tap, since its limits are usually more generous.
      const lighter =
        e instanceof ApiError && (e.status === 429 || e.status >= 500)
          ? lighterModel(providerId, liveModels.length > 0 ? liveModels : getPreset(providerId).models, cfg.model)
          : null;
      toast.error(message, {
        duration: e instanceof ApiError && (e.status === 429 || e.status >= 500) ? 15000 : undefined,
        action: lighter
          ? {
              label: `Use ${lighter}`,
              onClick: () => {
                patch({ model: lighter });
                toast.info(`Switched to ${lighter}. Press Generate code to try again.`);
              },
            }
          : undefined,
      });
    }
  }

  const modelLabel = loaded ? `${getPreset(providerId).label.replace(/ \(.*\)$/, "")} · ${config.model || "no model"}` : "Model";

  return (
    <div id="studio" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-12">
      <header className="flex items-center justify-between gap-4 pt-8">
        <div className="flex shrink-0 items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 36 36" fill="none" aria-hidden="true">
            <path d="M3 11V3h8M25 3h8v8M33 25v8h-8M11 33H3v-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
            <rect x="14" y="14" width="8" height="8" fill="var(--lime)" />
          </svg>
          <h1 translate="no" className="font-heading text-2xl font-bold leading-none tracking-tight whitespace-nowrap">
            Snap to Code
          </h1>
        </div>
        <Button variant="outline" onClick={() => setSettingsOpen(true)} aria-haspopup="dialog" className="min-w-0 shrink max-w-[60vw]">
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
              {busy && notice ? notice : stage === "done" && usedModel ? `Done with ${usedModel}${uncorrected ? ", then corrected against your screenshot" : ""}. Drag the handle to compare.` : STAGE_LABEL[stage]}
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
              {resultReady && uncorrected && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFiles(uncorrected);
                    setUncorrected(null);
                    toast.info("Went back to the version before the corrections.");
                  }}
                >
                  <Undo2 className="h-4 w-4" aria-hidden="true" /> Undo corrections
                </Button>
              )}
              <input
                ref={designInput}
                type="file"
                name="design-files"
                accept=".css,.js,.cjs,.mjs,.ts,.tsx,.jsx"
                multiple
                className="hidden"
                tabIndex={-1}
                onChange={(e) => {
                  void addDesignFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => designInput.current?.click()}
                title={
                  designSystem
                    ? `In use: ${designSystem.sources.join(", ")}. Click to add more files.`
                    : "Add your globals.css, tailwind.config and files from components/ui so the code uses your colours and components."
                }
              >
                <Palette className="h-4 w-4" aria-hidden="true" />
                {designSystem ? `Your design (${designSystem.sources.length})` : "Add your design"}
              </Button>
              {designSystem && (
                <Button variant="outline" size="icon" disabled={busy} onClick={() => setDesignFiles([])} aria-label="Remove your design system">
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
              <select
                aria-label="Correction rounds after generating"
                title="After the code is written, the page is drawn, compared with your screenshot, and the model fixes the differences. Each round is one more model call."
                value={rounds}
                disabled={busy}
                onChange={(e) => setRounds(Number(e.target.value))}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value={0}>Fix pass: off</option>
                {Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    Fix pass: {n} {n === 1 ? "round" : "rounds"}
                  </option>
                ))}
              </select>
              {busy ? (
                <Button variant="outline" onClick={() => abortRef.current?.abort()}>
                  <Square className="h-4 w-4" aria-hidden="true" /> Stop
                </Button>
              ) : (
                <Button
                  className="border border-foreground/15 bg-lime font-semibold text-foreground hover:bg-lime/80"
                  disabled={arena.running}
                  onClick={() => void generate()}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> {resultReady ? "Regenerate" : "Generate code"}
                </Button>
              )}
            </div>
          </div>

          <section aria-label="Result" className="min-w-0 rounded-md border bg-card p-4">
            <Tabs
              value={tab}
              onValueChange={(value) => {
                setTab(value);
                if (value === "arena" && arena.entries.length === 0) seedArena();
              }}
            >
              <TabsList className="h-auto! max-w-full flex-wrap justify-start">
                <TabsTrigger className={TAB} value="compare">Compare</TabsTrigger>
                <TabsTrigger className={TAB} value="live" disabled={!resultReady}>
                  Live preview
                </TabsTrigger>
                <TabsTrigger className={TAB} value="code">Code{files.length > 0 && ` (${files.length})`}</TabsTrigger>
                <TabsTrigger className={TAB} value="analysis">Structure</TabsTrigger>
                <TabsTrigger className={TAB} value="arena">Compare models</TabsTrigger>
              </TabsList>
              <TabsContent value="compare" className="mt-4">
                {resultReady ? (
                  <CompareView image={image} files={files} designSystem={designSystem} />
                ) : (
                  <OriginalStage image={image} scanning={stage === "analyzing"} />
                )}
              </TabsContent>
              <TabsContent value="live" className="mt-4">
                {resultReady ? <PreviewFrame files={files} designWidth={image.width} designSystem={designSystem} /> : <Empty>The live preview appears once the code is ready.</Empty>}
              </TabsContent>
              <TabsContent value="code" className="mt-4">
                <CodeViewer files={files} busy={busy} />
              </TabsContent>
              <TabsContent value="analysis" className="mt-4">
                <AnalysisView analysis={analysis} />
              </TabsContent>
              <TabsContent value="arena" className="mt-4">
                <ArenaView
                  image={image}
                  designSystem={designSystem}
                  entries={arena.entries}
                  runs={arena.runs}
                  running={arena.running}
                  disabled={busy}
                  configFor={(e) => ({ ...configFor(e.providerId), model: e.model.trim() })}
                  onAdd={() => arena.addEntry(providerId, "")}
                  onChange={arena.changeEntry}
                  onRemove={arena.removeEntry}
                  onStart={() => void arena.start(image, (e) => ({ ...configFor(e.providerId), model: e.model.trim() }), designSystem)}
                  onStop={arena.stop}
                  onUse={loadArenaResult}
                />
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
        liveModels={liveModels}
        onProvider={setProvider}
        onChange={patch}
        onKey={setKey}
        onFindLocal={() => void findLocal()}
      />
    </div>
  );
}
