import type { LLMConfig, Protocol } from "./types";

export interface ProviderPreset {
  id: string;
  label: string;
  protocol: Protocol;
  defaultBaseUrl: string;
  /** Show the base URL field (self-hosted and custom endpoints). */
  editableBaseUrl: boolean;
  needsKey: boolean;
  models: string[];
  keyUrl?: string;
  hint?: string;
}

/**
 * Any vision-capable model with an API works: pick a preset, or use "Custom" with an
 * OpenAI-compatible endpoint (LM Studio, vLLM, llama.cpp, Groq, Together, Mistral,
 * DeepSeek, xAI, LiteLLM, Azure, ...). The model name is always free text.
 * Chat subscriptions (ChatGPT Plus, Claude Pro) do not include API access.
 */
export const PROVIDERS: ProviderPreset[] = [
  {
    id: "gemini",
    label: "Google Gemini (free tier)",
    protocol: "gemini",
    defaultBaseUrl: "",
    editableBaseUrl: false,
    needsKey: true,
    models: ["gemini-3.8-flash", "gemini-3.5-flash-lite"],
    keyUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "openai",
    label: "OpenAI",
    protocol: "openai",
    defaultBaseUrl: "https://api.openai.com/v1",
    editableBaseUrl: false,
    needsKey: true,
    models: ["gpt-4.1", "gpt-4o", "gpt-4o-mini"],
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    protocol: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    editableBaseUrl: false,
    needsKey: true,
    models: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"],
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openrouter",
    label: "OpenRouter (hundreds of models)",
    protocol: "openai",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    editableBaseUrl: false,
    needsKey: true,
    models: ["google/gemini-2.5-flash", "openai/gpt-4o", "qwen/qwen2.5-vl-72b-instruct"],
    keyUrl: "https://openrouter.ai/keys",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    protocol: "ollama",
    defaultBaseUrl: "http://localhost:11434",
    editableBaseUrl: true,
    needsKey: false,
    models: ["qwen2.5vl:7b", "llama3.2-vision", "gemma3:12b", "minicpm-v"],
    hint: 'Needs a vision model, e.g. "ollama pull qwen2.5vl:7b". From a deployed site, start Ollama with OLLAMA_ORIGINS="*".',
  },
  {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    protocol: "openai",
    defaultBaseUrl: "http://localhost:1234/v1",
    editableBaseUrl: true,
    needsKey: false,
    models: [],
    hint: "Any server that speaks the OpenAI chat-completions API: LM Studio, vLLM, llama.cpp, Groq, Together, Mistral, DeepSeek, xAI, LiteLLM, Azure. The model must accept images.",
  },
];

/**
 * Models this app used to pick silently as a default and that the provider has since retired for new keys.
 * A saved profile still holding one of them is moved to the current default. Models the user typed
 * themselves are never touched.
 */
const RETIRED_DEFAULTS: Record<string, string> = { gemini: "gemini-2.5-flash" };

export function migrateProfile(providerId: string, profile: ProviderProfile): ProviderProfile {
  if (RETIRED_DEFAULTS[providerId] && profile.model === RETIRED_DEFAULTS[providerId]) {
    return { ...profile, model: getPreset(providerId).models[0] ?? profile.model };
  }
  return profile;
}

export const DEFAULT_PROVIDER_ID = "gemini";

/**
 * Guesses the provider from the shape of an API key, so a newcomer only has to paste a key.
 * Returns null when the key is not recognised (the current provider is kept).
 */
export function detectProviderFromKey(key: string): string | null {
  const k = key.trim();
  if (k.startsWith("sk-ant-")) return "anthropic";
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("AIza")) return "gemini";
  if (k.startsWith("sk-")) return "openai";
  return null;
}

export function getPreset(id: string): ProviderPreset {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export interface ProviderProfile {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export function defaultProfile(id: string): ProviderProfile {
  const p = getPreset(id);
  return { apiKey: "", model: p.models[0] ?? "", baseUrl: p.defaultBaseUrl };
}

export function toConfig(id: string, profile: ProviderProfile): LLMConfig {
  const p = getPreset(id);
  return {
    protocol: p.protocol,
    apiKey: profile.apiKey.trim(),
    model: profile.model.trim(),
    baseUrl: (p.editableBaseUrl ? profile.baseUrl : p.defaultBaseUrl).trim().replace(/\/+$/, ""),
  };
}

/** Returns a user-facing problem with the configuration, or null when it is usable. */
export function validateConfig(id: string, cfg: LLMConfig): string | null {
  const p = getPreset(id);
  if (p.needsKey && !cfg.apiKey) return `Enter your ${p.label.replace(/ \(.*\)$/, "")} API key first.`;
  if (!cfg.model) return "Enter a model name. It must be a vision-capable model.";
  if (cfg.protocol !== "gemini") {
    try {
      const u = new URL(cfg.baseUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
    } catch {
      return "The base URL is not valid. Example: http://localhost:11434";
    }
  }
  return null;
}
