/** Wire protocol spoken to the model. Many providers share one (e.g. "openai"). */
export type Protocol = "gemini" | "openai" | "anthropic" | "ollama";

export interface LLMConfig {
  protocol: Protocol;
  apiKey: string;
  model: string;
  /** Unused for the Gemini SDK. */
  baseUrl: string;
}

/** One image as sent to the model. */
export interface ImagePart {
  mimeType: string;
  base64: string;
}

/**
 * A screenshot of one page. `dataUrl`, `width` and `height` describe the whole page (for the UI);
 * `parts` are the images sent to the model, top to bottom. A tall page, or several screenshots of
 * one page, becomes several parts so the model never has to shrink it.
 */
export interface ImageData extends ImagePart {
  /** data: URL for displaying in the UI */
  dataUrl: string;
  width: number;
  height: number;
  parts: ImagePart[];
}

export interface AnalysisComponent {
  name: string;
  role: string;
  description: string;
  shadcn: string[];
}

export interface Analysis {
  summary: string;
  style: string;
  layout: string;
  components: AnalysisComponent[];
}

export interface GeneratedFile {
  path: string;
  code: string;
}

export type Stage = "idle" | "analyzing" | "generating" | "done" | "error";
