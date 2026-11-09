import { streamLLM } from "./llm";
import { replaceBrandIcons } from "./icons";
import { parseAnalysis, parseFiles } from "./parse";
import type { DesignSystem } from "./design-system";
import { ANALYSIS_SYSTEM, GENERATION_SYSTEM, analysisPrompt, generationPrompt, withDesignSystem } from "./prompts";
import type { Analysis, GeneratedFile, ImageData, LLMConfig } from "./types";

interface Callbacks {
  onStage: (s: "analyzing" | "generating") => void;
  onAnalysis: (a: Analysis) => void;
  onFiles: (f: GeneratedFile[]) => void;
  /** The model was busy; the same request is being tried again. */
  onRetry?: (attempt: number, attempts: number) => void;
}

/** Two-step generation: 1) analyse UI structure, 2) generate component files. */
export async function runPipeline(
  cfg: LLMConfig,
  image: ImageData,
  cb: Callbacks,
  signal: AbortSignal,
  options: { retryDelays?: number[]; designSystem?: DesignSystem | null } = {},
): Promise<GeneratedFile[]> {
  cb.onStage("analyzing");
  let text = "";
  for await (const chunk of streamLLM(cfg, {
    system: ANALYSIS_SYSTEM,
    prompt: analysisPrompt(image.parts.length),
    images: image.parts,
    json: true,
    signal,
    onRetry: cb.onRetry,
    retryDelays: options.retryDelays,
  })) {
    text += chunk;
  }
  const analysis = parseAnalysis(text);
  cb.onAnalysis(analysis);

  cb.onStage("generating");
  text = "";
  let last = 0;
  for await (const chunk of streamLLM(cfg, {
    system: withDesignSystem(GENERATION_SYSTEM, options.designSystem),
    prompt: generationPrompt(analysis, image.parts.length),
    images: image.parts,
    signal,
    onRetry: cb.onRetry,
    retryDelays: options.retryDelays,
  })) {
    text += chunk;
    const now = Date.now();
    if (now - last > 150) {
      last = now;
      cb.onFiles(replaceBrandIcons(parseFiles(text)));
    }
  }
  const files = replaceBrandIcons(parseFiles(text));
  if (files.length === 0) {
    throw new Error("The model returned no files. Try again or pick a different model.");
  }
  cb.onFiles(files);
  return files;
}
