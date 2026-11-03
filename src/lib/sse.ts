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

/** Extracts the most useful message from an error response body. */
export function errorMessageFrom(status: number, bodyText: string): string {
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
          ? " Rate limit reached: wait a moment or use another model."
          : "";
  return `The model API returned ${status}: ${detail}${hint}`.trim();
}

/**
 * The Gemini SDK throws errors whose message is JSON, sometimes JSON inside JSON.
 * Unwraps it down to one readable sentence plus a hint for the usual causes.
 */
export function geminiErrorMessage(err: unknown): string {
  let message = err instanceof Error ? err.message : String(err);
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
  const hint =
    code === 401 || code === 403
      ? " Check the API key."
      : code === 404
        ? " Pick another model in the model settings."
        : code === 429
          ? " Rate limit or free-tier quota reached: wait a while, or choose another model."
          : "";
  return code ? `Gemini returned ${code}: ${message}${hint}` : message;
}
