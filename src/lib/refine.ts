import { replaceBrandIcons } from "./icons";
import { streamLLM } from "./llm";
import { parseFiles } from "./parse";
import type { DesignSystem } from "./design-system";
import { REFINE_SYSTEM, refinePrompt, withDesignSystem } from "./prompts";
import type { GeneratedFile, ImagePart, LLMConfig } from "./types";

/** Puts changed files over the current ones: same path replaces, a new path is added. Order of the current files is kept. */
export function mergeFiles(current: GeneratedFile[], changes: GeneratedFile[]): GeneratedFile[] {
  const byPath = new Map(changes.map((f) => [f.path, f]));
  const merged = current.map((f) => byPath.get(f.path) ?? f);
  const known = new Set(current.map((f) => f.path));
  for (const f of changes) if (!known.has(f.path)) merged.push(f);
  return merged;
}

export interface RefineResult {
  files: GeneratedFile[];
  /** Paths that were changed or added. Empty means the model found nothing to fix. */
  changed: string[];
}

/** Reads the model's answer to a correction round. The "nothing to fix" reply, empty files and unchanged files count as no change. */
export function applyRefinement(current: GeneratedFile[], text: string): RefineResult {
  const changes = replaceBrandIcons(parseFiles(text).filter((f) => f.code.trim() !== ""));
  const changed = changes.filter((f) => current.find((c) => c.path === f.path)?.code !== f.code).map((f) => f.path);
  if (changed.length === 0) return { files: current, changed: [] };
  return { files: mergeFiles(current, changes), changed };
}

/**
 * One correction round: the model sees the design and a picture of the current render and returns the files to change.
 * `render` is the picture of the page, already cut into parts of at most the model's image size.
 */
export async function refineOnce(
  cfg: LLMConfig,
  design: ImagePart[],
  render: ImagePart[],
  files: GeneratedFile[],
  signal: AbortSignal,
  designSystem?: DesignSystem | null,
): Promise<RefineResult> {
  let text = "";
  for await (const chunk of streamLLM(cfg, {
    system: withDesignSystem(REFINE_SYSTEM, designSystem),
    prompt: refinePrompt(files, design.length, render.length),
    images: [...design, ...render],
    signal,
    // A failed correction must not hold the finished result back for long.
    retryDelays: [3],
  })) {
    text += chunk;
  }
  return applyRefinement(files, text);
}
