"use client";

import { useCallback, useRef, useState } from "react";
import { MAX_ARENA, idleRun, runArena, type ArenaEntry, type ArenaRun } from "@/lib/arena";
import type { DesignSystem } from "@/lib/design-system";
import { runPipeline } from "@/lib/pipeline";
import type { ImageData, LLMConfig } from "@/lib/types";

let counter = 0;
const newEntry = (providerId: string, model: string): ArenaEntry => ({ id: `m${(counter += 1)}`, providerId, model });

/** The state of a model comparison. It lives above the tab, so switching tabs does not lose results or stop a run. */
export function useArena() {
  const [entries, setEntries] = useState<ArenaEntry[]>([]);
  const [runs, setRuns] = useState<Record<string, ArenaRun>>({});
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const update = useCallback((id: string, patch: Partial<ArenaRun>) => {
    setRuns((prev) => ({ ...prev, [id]: { ...(prev[id] ?? idleRun()), ...patch } }));
  }, []);

  const addEntry = useCallback((providerId: string, model: string) => {
    setEntries((prev) => (prev.length >= MAX_ARENA ? prev : [...prev, newEntry(providerId, model)]));
  }, []);

  const changeEntry = useCallback((id: string, change: Partial<ArenaEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...change } : e)));
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setRuns((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id)));
  }, []);

  const start = useCallback(
    async (image: ImageData, configFor: (e: ArenaEntry) => LLMConfig, designSystem: DesignSystem | null) => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setRunning(true);
      setRuns(Object.fromEntries(entries.map((e) => [e.id, idleRun()])));
      try {
        await runArena(
          entries,
          configFor,
          (cfg, cb, signal) => runPipeline(cfg, image, { ...cb, onAnalysis: () => {} }, signal, { retryDelays: [3], designSystem }),
          update,
          ctrl.signal,
        );
      } finally {
        setRunning(false);
      }
    },
    [entries, update],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  /** A new screenshot makes the old results meaningless; the list of models stays. */
  const clearResults = useCallback(() => {
    abortRef.current?.abort();
    setRuns({});
  }, []);

  return { entries, runs, running, addEntry, changeEntry, removeEntry, start, stop, clearResults };
}
