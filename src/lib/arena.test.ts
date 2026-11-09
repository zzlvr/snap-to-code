import { describe, expect, it } from "vitest";
import { entryLabel, entryProblem, formatDuration, runArena, summarizeFiles, type ArenaEntry, type ArenaRun } from "./arena";
import type { GeneratedFile, LLMConfig } from "./types";

const entry = (id: string, providerId = "anthropic", model = "claude-haiku-5-5"): ArenaEntry => ({ id, providerId, model });
const cfg = (e: ArenaEntry, apiKey = "key"): LLMConfig => ({ protocol: "anthropic", apiKey, model: e.model, baseUrl: "https://api.anthropic.com" });
const file = (path: string): GeneratedFile => ({ path, code: "a\n\nb\n" });

function collect() {
  const runs: Record<string, ArenaRun[]> = {};
  const onUpdate = (id: string, patch: Partial<ArenaRun>) => {
    const list = (runs[id] ??= []);
    list.push({ status: "waiting", stage: null, files: [], ms: null, error: null, ...(list.at(-1) ?? {}), ...patch });
  };
  return { runs, onUpdate, last: (id: string) => runs[id].at(-1)! };
}

describe("helpers", () => {
  it("labels an entry with provider and model", () => {
    expect(entryLabel(entry("a"))).toBe("Anthropic Claude · claude-haiku-5-5");
    expect(entryLabel(entry("a", "openrouter", ""))).toBe("OpenRouter · no model");
  });

  it("formats time and counts non-empty lines", () => {
    expect(formatDuration(14231)).toBe("14.2 s");
    expect(summarizeFiles([file("a.tsx"), file("b.tsx")])).toEqual({ files: 2, lines: 4 });
  });

  it("reports a missing key and a repeated model", () => {
    const a = entry("a");
    const b = entry("b");
    expect(entryProblem(a, cfg(a, ""), [a])).toContain("API key");
    expect(entryProblem(a, cfg(a), [a, b])).toBeNull();
    expect(entryProblem(b, cfg(b), [a, b])).toBe("The same model is already in the list.");
  });
});

describe("runArena", () => {
  it("runs all models and keeps one failure from stopping the others", async () => {
    const entries = [entry("a", "anthropic", "m1"), entry("b", "anthropic", "m2")];
    const { onUpdate, last } = collect();
    let tick = 0;
    await runArena(
      entries,
      (e) => cfg(e),
      async (c, cb) => {
        cb.onStage("generating");
        if (c.model === "m2") throw new Error("model is busy");
        cb.onFiles([file("x.tsx")]);
        return [file("x.tsx"), file("app/page.tsx")];
      },
      onUpdate,
      new AbortController().signal,
      () => (tick += 1000),
    );
    expect(last("a").status).toBe("done");
    expect(last("a").files).toHaveLength(2);
    expect(last("a").ms).toBeGreaterThan(0);
    expect(last("b")).toMatchObject({ status: "error", error: "model is busy" });
  });

  it("does not call a model that has a problem", async () => {
    const entries = [entry("a")];
    const { onUpdate, last } = collect();
    let called = false;
    await runArena(entries, (e) => cfg(e, ""), async () => ((called = true), []), onUpdate, new AbortController().signal);
    expect(called).toBe(false);
    expect(last("a").status).toBe("error");
    expect(last("a").error).toContain("API key");
  });

  it("reports a stop as stopped, not as a failure of the model", async () => {
    const ctrl = new AbortController();
    const { onUpdate, last } = collect();
    await runArena(
      [entry("a")],
      (e) => cfg(e),
      async () => {
        ctrl.abort();
        throw new Error("aborted");
      },
      onUpdate,
      ctrl.signal,
    );
    expect(last("a")).toMatchObject({ status: "error", error: "Stopped." });
  });
});
