"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/hooks/use-settings";
import { detectLocalModels, type LocalModels } from "@/lib/local-detect";
import { runPipeline } from "@/lib/pipeline";
import { validateConfig } from "@/lib/providers";
import type { Analysis, GeneratedFile, ImageData, Stage } from "@/lib/types";
import { AnalysisView } from "./analysis-view";
import { CodeViewer } from "./code-viewer";
import { Dropzone } from "./dropzone";
import { PreviewFrame } from "./preview-frame";
import { SettingsPanel } from "./settings-panel";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  analyzing: "Step 1 of 2: reading the interface structure…",
  generating: "Step 2 of 2: writing components…",
  done: "Done",
  error: "",
};

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-center text-sm text-muted-foreground">{children}</p>;
}

export function Studio() {
  const { providerId, profile, config, loaded, touched, setProvider, patch, setKey, applyLocal } = useSettings();
  const [finding, setFinding] = useState(false);
  const probed = useRef(false);
  const [image, setImage] = useState<ImageData | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [tab, setTab] = useState("preview");
  const abortRef = useRef<AbortController | null>(null);

  const busy = stage === "analyzing" || stage === "generating";
  const configProblem = validateConfig(providerId, config);

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
      toast.error(configProblem);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAnalysis(null);
    setFiles([]);
    setTab("analysis");
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
      setTab("preview");
    } catch (e) {
      if (ctrl.signal.aborted) {
        setStage("idle");
        return;
      }
      setStage("error");
      toast.error(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  }

  return (
    <div id="studio" className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-4 pb-12 lg:grid-cols-[360px_1fr]">
      <aside className="space-y-6">
        <section aria-labelledby="step-shot" className="space-y-3">
          <h2 id="step-shot" className="font-heading text-lg font-semibold">
            <span className="mr-2 text-muted-foreground">1</span>Screenshot
          </h2>
          <Dropzone image={image} disabled={busy} scanning={stage === "analyzing"} onImage={setImage} />
        </section>

        <section aria-labelledby="step-model" className="space-y-3 border-t pt-6">
          <h2 id="step-model" className="font-heading text-lg font-semibold">
            <span className="mr-2 text-muted-foreground">2</span>Model
          </h2>
          {/* Hidden until saved settings are read, so the default provider never flashes before the real one. */}
          <div className={loaded ? undefined : "invisible"} aria-busy={!loaded}>
            <SettingsPanel
              providerId={providerId}
              profile={profile}
              disabled={busy}
              finding={finding}
              onProvider={setProvider}
              onChange={patch}
              onKey={setKey}
              onFindLocal={() => void findLocal()}
            />
          </div>
        </section>

        <div className="space-y-3 border-t pt-6">
          {busy ? (
            <Button size="lg" variant="outline" className="w-full" onClick={() => abortRef.current?.abort()}>
              <Square className="h-4 w-4" aria-hidden="true" /> Stop
            </Button>
          ) : (
            <Button
              size="lg"
              className="w-full border border-foreground/15 bg-lime font-semibold text-foreground hover:bg-lime/80"
              disabled={!image}
              onClick={generate}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Generate code
            </Button>
          )}
          <p className="flex min-h-5 items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
            {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {STAGE_LABEL[stage]}
            {!busy && !image && stage === "idle" && "Add a screenshot to get started."}
            {!busy && image && stage === "idle" && configProblem}
          </p>
        </div>
      </aside>

      <section aria-label="Result" className="min-w-0 rounded-md border bg-card p-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="preview" disabled={files.length === 0 || busy}>
              Preview
            </TabsTrigger>
            <TabsTrigger value="code">Code{files.length > 0 && ` (${files.length})`}</TabsTrigger>
            <TabsTrigger value="analysis">Structure</TabsTrigger>
          </TabsList>
          <TabsContent value="preview" className="mt-4">
            {files.length > 0 && !busy ? (
              <PreviewFrame files={files} />
            ) : (
              <Empty>The live preview appears here once the code is ready.</Empty>
            )}
          </TabsContent>
          <TabsContent value="code" className="mt-4">
            <CodeViewer files={files} busy={busy} />
          </TabsContent>
          <TabsContent value="analysis" className="mt-4">
            <AnalysisView analysis={analysis} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
