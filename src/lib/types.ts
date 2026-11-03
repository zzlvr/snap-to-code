/** Wire protocol spoken to the model. Many providers share one (e.g. "openai"). */
export type Protocol = "gemini" | "openai" | "anthropic" | "ollama";

export interface LLMConfig {
  protocol: Protocol;
  apiKey: string;
  model: string;
  /** Unused for the Gemini SDK. */
  baseUrl: string;
}

export interface ImageData {
  mimeType: string;
  base64: string;
  /** data: URL for displaying in the UI */
  dataUrl: string;
  width: number;
  height: number;
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
