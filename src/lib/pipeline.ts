import { streamLLM } from "./llm";
import { parseAnalysis, parseFiles } from "./parse";
import { ANALYSIS_SYSTEM, GENERATION_SYSTEM, generationPrompt } from "./prompts";
import type { Analysis, GeneratedFile, ImageData, LLMConfig } from "./types";

interface Callbacks {
  onStage: (s: "analyzing" | "generating") => void;
  onAnalysis: (a: Analysis) => void;
  onFiles: (f: GeneratedFile[]) => void;
}

/** Two-step generation: 1) analyse UI structure, 2) generate component files. */
export async function runPipeline(
  cfg: LLMConfig,
  image: ImageData,
  cb: Callbacks,
  signal: AbortSignal,
): Promise<GeneratedFile[]> {
  cb.onStage("analyzing");
  let text = "";
  for await (const chunk of streamLLM(cfg, {
    system: ANALYSIS_SYSTEM,
    prompt: "Analyse this UI screenshot.",
    image,
    json: true,
    signal,
  })) {
    text += chunk;
  }
  const analysis = parseAnalysis(text);
  cb.onAnalysis(analysis);

  cb.onStage("generating");
  text = "";
  let last = 0;
  for await (const chunk of streamLLM(cfg, {
    system: GENERATION_SYSTEM,
    prompt: generationPrompt(analysis),
    image,
    signal,
  })) {
    text += chunk;
    const now = Date.now();
    if (now - last > 150) {
      last = now;
      cb.onFiles(parseFiles(text));
    }
  }
  const files = parseFiles(text);
  if (files.length === 0) {
    throw new Error("The model returned no files. Try again or pick a different model.");
  }
  cb.onFiles(files);
  return files;
}
