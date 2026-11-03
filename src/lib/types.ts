export type Provider = "gemini" | "ollama";

export interface LLMConfig {
  provider: Provider;
  apiKey: string;
  model: string;
  ollamaUrl: string;
}

export interface ImageData {
  mimeType: string;
  base64: string;
  /** data: URL for displaying in the UI */
  dataUrl: string;
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
