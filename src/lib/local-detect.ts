/** Finds vision models served by Ollama or LM Studio on this machine. */

export interface LocalModels {
  providerId: "ollama" | "custom";
  label: string;
  baseUrl: string;
  /** Vision-capable models only, best guess first. */
  models: string[];
}

export interface DetectOptions {
  ollamaUrl?: string;
  lmStudioUrl?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

// Fallback when a server does not report capabilities: well-known vision model families.
const VISION_NAME =
  /vision|llava|(^|[-:_/.\d])vl([-:_]|\d|$)|minicpm-v|moondream|bakllava|pixtral|gemma-?3|llama-?4|mistral-small-?3|internvl|molmo|smolvlm|phi-?4-multimodal/i;

export function looksLikeVision(name: string): boolean {
  return VISION_NAME.test(name);
}

async function getJson(url: string, init: RequestInit | undefined, o: DetectOptions): Promise<unknown | null> {
  const timeout = AbortSignal.timeout(o.timeoutMs ?? 1500);
  const signal = o.signal ? AbortSignal.any([timeout, o.signal]) : timeout;
  try {
    const res = await fetch(url, { ...init, signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null; // not running, blocked by CORS, or timed out: treat as "not found"
  }
}

async function detectOllama(o: DetectOptions): Promise<LocalModels | null> {
  const base = (o.ollamaUrl ?? "http://localhost:11434").replace(/\/+$/, "");
  const tags = (await getJson(`${base}/api/tags`, undefined, o)) as { models?: { name: string }[] } | null;
  const names = (tags?.models ?? []).map((m) => m.name).slice(0, 30);
  if (names.length === 0) return null;

  const flags = await Promise.all(
    names.map(async (name) => {
      const info = (await getJson(
        `${base}/api/show`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: name }) },
        o,
      )) as { capabilities?: string[] } | null;
      // Newer Ollama reports capabilities; older versions do not, so fall back to the name.
      return info?.capabilities ? info.capabilities.includes("vision") : looksLikeVision(name);
    }),
  );
  const models = names.filter((_, i) => flags[i]);
  return models.length ? { providerId: "ollama", label: "Ollama", baseUrl: base, models } : null;
}

async function detectLMStudio(o: DetectOptions): Promise<LocalModels | null> {
  const root = (o.lmStudioUrl ?? "http://localhost:1234").replace(/\/+$/, "");
  // LM Studio's REST API labels vision models as "vlm".
  const v0 = (await getJson(`${root}/api/v0/models`, undefined, o)) as { data?: { id: string; type?: string }[] } | null;
  let models = (v0?.data ?? []).filter((m) => m.type === "vlm").map((m) => m.id);
  if (!v0) {
    const v1 = (await getJson(`${root}/v1/models`, undefined, o)) as { data?: { id: string }[] } | null;
    models = (v1?.data ?? []).map((m) => m.id).filter(looksLikeVision);
  }
  return models.length ? { providerId: "custom", label: "LM Studio", baseUrl: `${root}/v1`, models } : null;
}

/** Probes the usual local ports in parallel. Ollama is listed first. Never throws. */
export async function detectLocalModels(o: DetectOptions = {}): Promise<LocalModels[]> {
  const found = await Promise.all([detectOllama(o), detectLMStudio(o)]);
  return found.filter((f): f is LocalModels => f !== null);
}
