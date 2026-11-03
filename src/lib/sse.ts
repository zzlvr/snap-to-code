/** Yields the payload of each `data:` line of a Server-Sent Events stream. */
export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).replace(/\r$/, "");
      buf = buf.slice(nl + 1);
      if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  }
  const tail = buf.replace(/\r$/, "");
  if (tail.startsWith("data:")) yield tail.slice(5).trim();
}

/** Text delta of one OpenAI-style streaming chunk (`choices[0].delta.content`). */
export function openaiDelta(json: unknown): string {
  const c = (json as { choices?: { delta?: { content?: unknown } }[] })?.choices?.[0]?.delta?.content;
  if (typeof c === "string") return c;
  // Some servers send content as an array of parts.
  if (Array.isArray(c)) {
    return c.map((p) => (typeof p === "string" ? p : ((p as { text?: string })?.text ?? ""))).join("");
  }
  return "";
}

/** Text delta of one Anthropic streaming event; throws on an `error` event. */
export function anthropicDelta(json: unknown): string {
  const e = json as { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } };
  if (e?.type === "error") throw new Error(e.error?.message ?? "Anthropic stream error");
  if (e?.type === "content_block_delta" && e.delta?.type === "text_delta") return e.delta.text ?? "";
  return "";
}

/** Ends a sentence the provider left open, so a hint can follow it. */
const endSentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** Shown after the automatic retries for a 5xx have also failed. */
const OVERLOADED_HINT = " The provider is overloaded or having trouble, which is usually temporary. Try again in a minute or switch to another model.";

/** An HTTP error from a model API. `status` lets callers react: a retired model (404), a rate limit (429). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Seconds the provider asked us to wait, when it said so. */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Seconds to wait, from a Retry-After header or from the provider's own wording ("retry in 34.5s", retryDelay "34s"). */
export function retrySeconds(...sources: (string | null | undefined)[]): number | undefined {
  for (const text of sources) {
    if (!text) continue;
    // "retry in 34.5s" is more exact than the whole-second retryDelay "34s", so it is tried first.
    const m =
      text.match(/retry in (\d+(?:\.\d+)?)\s?s/i) ??
      text.match(/retryDelay\W{1,8}(\d+(?:\.\d+)?)s/i) ??
      text.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return undefined;
}

/** What to tell the user after a 429. A daily limit cannot be waited out in seconds, so it is told apart. */
export function rateLimitHint(raw: string, retryAfter?: number): string {
  const daily = /PerDay/i.test(raw);
  const when = daily
    ? " The daily limit looks used up; free-tier limits reset around midnight Pacific time."
    : retryAfter
      ? ` Try again in about ${Math.ceil(retryAfter)} s.`
      : " Wait a moment.";
  return ` Rate limit or quota reached.${when} Or switch to a lighter model.`;
}

/** Extracts the most useful message from an error response body. */
export function errorMessageFrom(status: number, bodyText: string, retryAfterHeader?: string | null): string {
  let detail = bodyText.slice(0, 300);
  try {
    const j = JSON.parse(bodyText);
    detail = j?.error?.message ?? j?.error ?? j?.message ?? detail;
    if (typeof detail !== "string") detail = JSON.stringify(detail);
  } catch {
    /* keep raw text */
  }
  const hint =
    status === 401 || status === 403
      ? " Check the API key."
      : status === 404
        ? " Check the model name and base URL."
        : status === 429
          ? rateLimitHint(bodyText, retrySeconds(retryAfterHeader, bodyText))
          : status >= 500
            ? OVERLOADED_HINT
            : "";
  return `The model API returned ${status}: ${hint ? endSentence(detail) : detail}${hint}`.trim();
}

/**
 * The Gemini SDK throws errors whose message is JSON, sometimes JSON inside JSON.
 * Unwraps it down to one readable sentence plus a hint for the usual causes.
 */
export function parseGeminiError(err: unknown): ApiError | Error {
  const raw = err instanceof Error ? err.message : String(err);
  let message = raw;
  const statusProp = (err as { status?: unknown } | null)?.status;
  let code = typeof statusProp === "number" ? statusProp : 0;
  for (let depth = 0; depth < 3; depth++) {
    try {
      const parsed = JSON.parse(message);
      const inner = parsed?.error ?? parsed;
      if (!code && typeof inner?.code === "number") code = inner.code;
      if (typeof inner?.message === "string") {
        message = inner.message.trim();
        continue;
      }
    } catch {
      /* not JSON any more: this is the readable part */
    }
    break;
  }
  message = message.replace(/\s+/g, " ").slice(0, 400);
  const retryAfter = code === 429 ? retrySeconds(raw) : undefined;
  const hint =
    code === 401 || code === 403
      ? " Check the API key."
      : code === 404
        ? " Pick another model in the model settings."
        : code === 429
          ? rateLimitHint(raw, retryAfter)
          : code >= 500
            ? OVERLOADED_HINT
            : "";
  return code ? new ApiError(`Gemini returned ${code}: ${hint ? endSentence(message) : message}${hint}`, code, retryAfter) : new Error(message);
}

export const geminiErrorMessage = (err: unknown): string => parseGeminiError(err).message;
