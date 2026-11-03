"use client";

import { useCallback, useEffect, useState } from "react";
import type { LLMConfig } from "@/lib/types";

const KEY = "snap-to-code:settings:v1";

export const DEFAULT_SETTINGS: LLMConfig = {
  provider: "gemini",
  apiKey: "",
  model: "gemini-2.5-flash",
  ollamaUrl: "http://localhost:11434",
};

export const MODEL_PRESETS: Record<LLMConfig["provider"], string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"],
  ollama: ["qwen2.5vl:7b", "llama3.2-vision", "gemma3:12b", "minicpm-v"],
};

/** Settings (including the BYOK API key) live only in this browser's localStorage. */
export function useSettings() {
  const [settings, setSettings] = useState<LLMConfig>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {
      /* storage unavailable: keep defaults */
    }
  }, []);

  const update = useCallback((patch: Partial<LLMConfig>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { settings, update };
}
