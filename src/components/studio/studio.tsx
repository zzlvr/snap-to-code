"use client";

import { useRef, useState } from "react";
import { Loader2, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/hooks/use-settings";
import { runPipeline } from "@/lib/pipeline";
import type { Analysis, GeneratedFile, ImageData, Stage } from "@/lib/types";
import { AnalysisView } from "./analysis-view";
import { CodeViewer } from "./code-viewer";
import { Dropzone } from "./dropzone";
import { PreviewFrame } from "./preview-frame";
import { SettingsPanel } from "./settings-panel";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  analyzing: "Шаг 1/2: анализирую структуру интерфейса…",
  generating: "Шаг 2/2: генерирую компоненты…",
  done: "Готово",
  error: "",
};

export function Studio() {
  const { settings, update } = useSettings();
  const [image, setImage] = useState<ImageData | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [tab, setTab] = useState("preview");
  const abortRef = useRef<AbortController | null>(null);

  const busy = stage === "analyzing" || stage === "generating";

  async function generate() {
    if (!image) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAnalysis(null);
    setFiles([]);
    setTab("analysis");
    try {
      const result = await runPipeline(
        settings,
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
      toast.error(e instanceof Error ? e.message : "Что-то пошло не так");
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 pb-10 lg:grid-cols-[360px_1fr]">
      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Скриншот</CardTitle>
          </CardHeader>
          <CardContent>
            <Dropzone image={image} disabled={busy} onImage={setImage} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Модель</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsPanel settings={settings} disabled={busy} onChange={update} />
          </CardContent>
        </Card>

        {busy ? (
          <Button size="lg" variant="outline" className="w-full" onClick={() => abortRef.current?.abort()}>
            <Square className="h-4 w-4" /> Остановить
          </Button>
        ) : (
          <Button size="lg" className="w-full" disabled={!image} onClick={generate}>
            <Sparkles className="h-4 w-4" /> Сгенерировать код
          </Button>
        )}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> {STAGE_LABEL[stage]}
          </p>
        )}
      </aside>

      <section className="min-w-0">
        <Card className="h-full">
          <CardContent className="pt-6">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="preview" disabled={files.length === 0 || busy}>
                  Превью
                </TabsTrigger>
                <TabsTrigger value="code">Код{files.length > 0 && ` (${files.length})`}</TabsTrigger>
                <TabsTrigger value="analysis">Структура</TabsTrigger>
              </TabsList>
              <TabsContent value="preview" className="mt-4">
                {files.length > 0 && !busy && <PreviewFrame files={files} />}
              </TabsContent>
              <TabsContent value="code" className="mt-4">
                <CodeViewer files={files} busy={busy} />
              </TabsContent>
              <TabsContent value="analysis" className="mt-4">
                <AnalysisView analysis={analysis} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
