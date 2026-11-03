import type { LLMConfig } from "./types";

/**
 * Model names change faster than this app does, so nothing here relies on a fixed list:
 * the provider is asked which models the key can use, and the best one is picked by rule.
 * The presets in providers.ts are only a fallback for when the list cannot be fetched.
 */

/** Providers whose model list can be fetched straight from the browser with the user's key. */
export const LIVE_MODEL_PROVIDERS = new Set(["gemini", "openai", "anthropic", "openrouter"]);

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";

/** Ids that are not chat-with-images models. */
const NOT_A_VISION_CHAT_MODEL =
  /embed|tts|audio|realtime|transcribe|image|imagen|veo|live|moderation|search|whisper|dall|davinci|babbage|instruct|codex|computer|robotics|aqa|learnlm|native|guard|safety/i;

/** Per provider: families in order of preference. Within a family the highest version wins. */
const FAMILIES: Record<string, RegExp[]> = {
  gemini: [/^gemini-[\d.]+-flash$/, /^gemini-[\d.]+-flash-lite$/, /^gemini-[\d.]+-pro$/],
  openai: [/^gpt-\d+(\.\d+)?$/, /^gpt-\d+o$/, /^gpt-[\d.]+o?-mini$/],
  anthropic: [/sonnet/, /opus/, /haiku/],
};

/** Every number in an id, in order: "gemini-3.8-flash" → [3, 8], "claude-sonnet-5-5" → [5, 5]. */
export function versionOf(id: string): number[] {
  return (id.match(/\d+/g) ?? []).map(Number);
}

function compareVersions(a: string, b: string): number {
  const va = versionOf(a);
  const vb = versionOf(b);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const d = (va[i] ?? -1) - (vb[i] ?? -1);
    if (d !== 0) return d;
  }
  // Same version: a stable name beats a preview or experimental one.
  const unstable = (s: string) => /preview|exp|beta/i.test(s);
  return Number(unstable(b)) - Number(unstable(a));
}

/**
 * The model to use by default: the newest model of the most preferred family.
 * Returns null when the provider has no rule (OpenRouter, custom servers) or nothing fits.
 * `exclude` skips a model that just failed.
 */
export function bestModel(providerId: string, ids: string[], exclude?: string): string | null {
  const families = FAMILIES[providerId];
  if (!families) return null;
  const usable = ids.filter((id) => id !== exclude && !NOT_A_VISION_CHAT_MODEL.test(id));
  for (const family of families) {
    const hit = usable.filter((id) => family.test(id)).sort((a, b) => compareVersions(b, a))[0];
    if (hit) return hit;
  }
  return usable.sort((a, b) => compareVersions(b, a))[0] ?? null;
}

interface GeminiList {
  models?: { name?: string; supportedGenerationMethods?: string[] }[];
}
interface OpenAIList {
  data?: { id?: string; architecture?: { input_modalities?: string[] } }[];
}

export function parseGeminiModels(json: GeminiList): string[] {
  return (json.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter(Boolean);
}

/** OpenAI-style lists. OpenRouter also states each model's input types, so image-only models are dropped. */
export function parseOpenAIModels(json: OpenAIList): string[] {
  return (json.data ?? [])
    .filter((m) => !m.architecture?.input_modalities || m.architecture.input_modalities.includes("image"))
    .map((m) => m.id ?? "")
    .filter(Boolean);
}

/**
 * Asks the provider which models this key can use. Returns [] on any failure
 * (offline, blocked, bad key): callers then fall back to the presets.
 */
export async function fetchModelIds(providerId: string, cfg: LLMConfig, signal?: AbortSignal): Promise<string[]> {
  if (!LIVE_MODEL_PROVIDERS.has(providerId) || !cfg.apiKey.trim()) return [];
  try {
    switch (cfg.protocol) {
      case "gemini": {
        const res = await fetch(`${GEMINI_API}/models?pageSize=200`, { headers: { "x-goog-api-key": cfg.apiKey }, signal });
        return res.ok ? parseGeminiModels(await res.json()) : [];
      }
      case "openai": {
        const res = await fetch(`${cfg.baseUrl}/models`, { headers: { Authorization: `Bearer ${cfg.apiKey}` }, signal });
        return res.ok ? parseOpenAIModels(await res.json()) : [];
      }
      case "anthropic": {
        const res = await fetch(`${cfg.baseUrl}/v1/models?limit=100`, {
          headers: {
            "x-api-key": cfg.apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          signal,
        });
        return res.ok ? parseOpenAIModels(await res.json()) : [];
      }
      default:
        return [];
    }
  } catch {
    return [];
  }
}
