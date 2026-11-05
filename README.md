# Snap to Code

Turn a screenshot of a UI into React + Tailwind CSS + shadcn/ui code, split into components (`Sidebar.tsx`, `Header.tsx`, `DataTable.tsx`, ...). Bring your own vision model and API key.

**Live demo: https://snap-to-code.vercel.app**

![Paste a screenshot, generate components, drag the divider to compare](docs/demo-v2.gif)

<sub>Recorded run. The input is a screenshot of [ui.shadcn.com](https://ui.shadcn.com).</sub>

## What you get

Snap to Code builds the look of one page: a starting point for the front end that you finish by hand.

- Static React components with the same layout, colours and structure, filled with placeholder data.
- No logic, working forms, backend, database, authentication or routing between pages.
- Images and logos become placeholders. Fonts, spacing and colours are approximations.
- Simple pages come out well; dense or unusual layouts need more manual work.

Use it on your own designs, mock-ups and sites you have the right to reuse, or to learn from a layout. Don't publish a copy of someone else's site under its own brand, text and images.

## Features

- **Paste, drop or pick**: `Ctrl/⌘ + V`, drag and drop, or choose files.
- **Long pages**: add several screenshots of one page, or one tall capture.
- **Two steps**: the model first reads the structure (*Structure* tab), then writes one file per component, streamed live.
- **Stack**: Tailwind utility classes, shadcn/ui components, lucide-react icons; `app/page.tsx` composes the page.
- **Before / after**: your screenshot and the result side by side with one draggable divider (mouse, touch or arrow keys).
- **Live preview**: sandboxed iframe with Desktop / Tablet / Mobile widths.
- **Export**: copy all files, download a ZIP, or copy the `npx shadcn@latest add ...` command.
- **Your own model**: Gemini, OpenAI, Anthropic, OpenRouter, Ollama, or any OpenAI-compatible server.

## Long pages

Everything you add is treated as one page, top to bottom.

- Paste screenshots one after another, pick several files, or press *Add part*. They are stacked in the order added. *Undo last* removes the last one, *New screenshot* starts over. Up to 8.
- A full-page capture works too.
- Images sent to the model are at most 1568 px on a side, because some providers shrink larger ones until small text is unreadable. A tall page is cut into slices of at most 1568 px that overlap by 48 px, and the model is told they belong to one page. A normal single screenshot, phone screenshots included, is sent as one image.
- A page taller than 12,000 px once scaled is refused: split it into two runs.
- More slices mean more image tokens, so long pages cost more and reach free-tier limits sooner.
- When capturing, scroll one screen at a time. Small overlaps are fine; avoid large repeats.

## Supported models

Any model that accepts images and has an API. The model name is free text, so new models work as soon as they ship.

Chat subscriptions (ChatGPT Plus, Claude Pro and similar) don't include an API key and can't be used here. You need an API key from the provider (billed per use), a free-tier key such as Gemini's, or a local model. Free tiers have low limits and are served last, so at busy hours you may get "model is busy": wait a minute, pick the lighter model, or use a paid key or a local model.

| Provider | Protocol | Key | Notes |
| --- | --- | --- | --- |
| Google Gemini | Gemini SDK | yes | Free tier in [Google AI Studio](https://aistudio.google.com/apikey) |
| OpenAI | OpenAI chat completions | yes | |
| Anthropic Claude | Anthropic Messages | yes | Called from the browser with Anthropic's browser-access header |
| OpenRouter | OpenAI chat completions | yes | Many models behind one key |
| Ollama | Ollama `/api/chat` | no | Local. Run `ollama pull qwen2.5vl:7b` |
| Custom | OpenAI chat completions | optional | Any server with a base URL: LM Studio, vLLM, llama.cpp, Groq, Together, Mistral, DeepSeek, xAI, LiteLLM, Azure, ... |

Not supported: text-only models, services without a public API, and APIs that block browser requests (CORS) and aren't OpenAI-compatible. Requests go straight from your browser to the provider, so the provider has to allow CORS. Most hosted APIs do; for local servers see below.

### Model names

Providers rename and retire models, so the app doesn't depend on a fixed list.

- With a Gemini, OpenAI, Anthropic or OpenRouter key it asks the provider which models your key can use and fills the suggestions from that. Until you pick a model yourself, it uses the newest suitable one.
- If a request fails because the model no longer exists (404), it fetches the list, switches to the best remaining model, tells you, and retries once.
- A model you picked is never replaced beforehand.
- The built-in list in `src/lib/providers.ts` is only a fallback for when the provider's list can't be fetched.

Rate limits (429) and temporary server errors (500, 502, 503, 504) are handled too: the app retries server errors on its own (a try that gets no answer within 45 seconds counts as failed), then tries the provider's lighter model once for that run (your setting stays as it is). If that fails too, it shows how long to wait and offers the lighter model.

### Ollama and other local servers

```bash
ollama pull qwen2.5vl:7b
# Needed only for a deployed (HTTPS) copy of the app:
OLLAMA_ORIGINS="*" ollama serve
```

Local models are noticeably weaker than hosted ones, and complex layouts usually need a stronger model.

## Privacy

The app is client-side and has no backend. API keys are stored in your browser's `localStorage` (one profile per provider) and sent only to the provider you choose. Images go straight to that provider too.

## Security

Generated code is untrusted: text inside a screenshot can steer the model.

- **Sandboxed preview**: `iframe sandbox="allow-scripts"` without `allow-same-origin`, with a CSP of `connect-src 'none'` (code can't send data out) and scripts only from three CDNs, four of them pinned with SRI hashes.
- **Code scanner**: warns about `fetch`, `eval`, `dangerouslySetInnerHTML`, storage access and imports outside an allow-list. It's a heuristic, not a guarantee: review the code.
- **File paths** from the model are sanitised (no `..`, no absolute paths), so a ZIP can't write outside its folder.
- **API keys** sit in `localStorage`. If the provider supports it, restrict the key to your site's domain (HTTP referrer).
- Response headers: `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000, paste an API key, then paste a screenshot.

- **Paste a key and go.** The provider is detected from the key (`AIza...` Gemini, `sk-ant-...` Anthropic, `sk-or-...` OpenRouter, `sk-...` OpenAI) and a default model is chosen. Provider, base URL and model are under *Advanced settings*.
- **No key?** If Ollama or LM Studio is running with a vision model, the app finds it on first launch (on `localhost` only). On a deployed site, press *Find local models* in Advanced settings.

```bash
npm test
npm run lint
npm run build
```

## Deploy

Push to GitHub and import the repo in Vercel. No environment variables are needed.

## How it works

| File | Role |
| --- | --- |
| `src/lib/pipeline.ts` | analyse, then generate |
| `src/lib/providers.ts` | provider presets, config validation |
| `src/lib/models.ts` | live model lists, picking the best model |
| `src/lib/llm.ts` | streaming clients for the four protocols, retries |
| `src/lib/sse.ts` | Server-Sent Events reader, error messages |
| `src/lib/image.ts` | stacking and slicing screenshots |
| `src/lib/prompts.ts` | system prompts and code rules |
| `src/lib/parse.ts` | parses the JSON analysis and `=== FILE: path ===` blocks |
| `src/lib/scan.ts` | scanner for suspicious generated code |
| `src/lib/preview-html.ts` | preview runtime: Babel plus small shadcn/lucide stand-ins in the iframe |
| `src/lib/export.ts` | copy, ZIP, shadcn components needed |

## Limitations

- The preview uses simplified shadcn/ui components (Button, Card, Table, Tabs, ...). Complex ones (dropdown, dialog) render as plain blocks. It loads Tailwind and React from a CDN, so it needs internet access.
- Output quality depends on the model. Review the code before using it.

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## License

[MIT](LICENSE)
