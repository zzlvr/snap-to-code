import { getPreset, validateConfig } from "./providers";
import type { GeneratedFile, LLMConfig } from "./types";

export const MAX_ARENA = 4;

/** One model in the comparison. The key comes from the settings of its provider. */
export interface ArenaEntry {
  id: string;
  providerId: string;
  model: string;
}

export type ArenaStatus = "waiting" | "running" | "done" | "error";

export interface ArenaRun {
  status: ArenaStatus;
  stage: "analyzing" | "generating" | null;
  files: GeneratedFile[];
  /** Time from start to finish, in milliseconds. */
  ms: number | null;
  error: string | null;
}

export const idleRun = (): ArenaRun => ({ status: "waiting", stage: null, files: [], ms: null, error: null });

/** "Anthropic Claude · claude-haiku-5-5" */
export function entryLabel(entry: ArenaEntry): string {
  return `${getPreset(entry.providerId).label.replace(/ \(.*\)$/, "")} · ${entry.model || "no model"}`;
}

export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export function summarizeFiles(files: GeneratedFile[]): { files: number; lines: number } {
  return { files: files.length, lines: files.reduce((n, f) => n + f.code.split("\n").filter((l) => l.trim() !== "").length, 0) };
}

/** Why this entry cannot run, or null. Two entries with the same provider and model would only repeat each other. */
export function entryProblem(entry: ArenaEntry, cfg: LLMConfig, all: ArenaEntry[]): string | null {
  const problem = validateConfig(entry.providerId, cfg);
  if (problem) return problem;
  const twin = all.find((o) => o.id !== entry.id && o.providerId === entry.providerId && o.model.trim() === entry.model.trim());
  if (twin && all.indexOf(twin) < all.indexOf(entry)) return "The same model is already in the list.";
  return null;
}

export interface ArenaCallbacks {
  onStage: (stage: "analyzing" | "generating") => void;
  onFiles: (files: GeneratedFile[]) => void;
}

export type ArenaRunner = (cfg: LLMConfig, cb: ArenaCallbacks, signal: AbortSignal) => Promise<GeneratedFile[]>;

/**
 * Runs every entry at the same time and reports each one's progress. One model failing never stops the others.
 * `now` is injectable for tests.
 */
export async function runArena(
  entries: ArenaEntry[],
  configFor: (entry: ArenaEntry) => LLMConfig,
  run: ArenaRunner,
  onUpdate: (id: string, patch: Partial<ArenaRun>) => void,
  signal: AbortSignal,
  now: () => number = Date.now,
): Promise<void> {
  await Promise.all(
    entries.map(async (entry) => {
      const cfg = configFor(entry);
      const problem = entryProblem(entry, cfg, entries);
      if (problem) {
        onUpdate(entry.id, { status: "error", error: problem });
        return;
      }
      const start = now();
      onUpdate(entry.id, { status: "running", stage: "analyzing", files: [], ms: null, error: null });
      try {
        const files = await run(
          cfg,
          {
            onStage: (stage) => onUpdate(entry.id, { stage }),
            onFiles: (f) => onUpdate(entry.id, { files: f }),
          },
          signal,
        );
        onUpdate(entry.id, { status: "done", stage: null, files, ms: now() - start });
      } catch (e) {
        onUpdate(entry.id, {
          status: "error",
          stage: null,
          ms: now() - start,
          error: signal.aborted ? "Stopped." : e instanceof Error ? e.message : "Something went wrong.",
        });
      }
    }),
  );
}
