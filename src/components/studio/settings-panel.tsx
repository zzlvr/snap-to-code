"use client";

import { KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MODEL_PRESETS } from "@/hooks/use-settings";
import type { LLMConfig, Provider } from "@/lib/types";

const PROVIDER_ITEMS = [
  { value: "gemini", label: "Gemini Vision (облако, есть free tier)" },
  { value: "ollama", label: "Ollama (локально)" },
];

interface Props {
  settings: LLMConfig;
  disabled?: boolean;
  onChange: (patch: Partial<LLMConfig>) => void;
}

export function SettingsPanel({ settings, disabled, onChange }: Props) {
  const isGemini = settings.provider === "gemini";

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="provider">Модель</Label>
        <Select
          items={PROVIDER_ITEMS}
          value={settings.provider}
          onValueChange={(v) => onChange({ provider: v as Provider, model: MODEL_PRESETS[v as Provider][0] })}
        >
          <SelectTrigger id="provider" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_ITEMS.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isGemini ? (
        <div className="space-y-1.5">
          <Label htmlFor="apikey" className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> Gemini API key
          </Label>
          <Input
            id="apikey"
            type="password"
            autoComplete="off"
            placeholder="AIza…"
            value={settings.apiKey}
            onChange={(e) => onChange({ apiKey: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Ключ хранится только в вашем браузере и отправляется напрямую в Google. Получить бесплатно:{" "}
            <a
              className="underline underline-offset-2"
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
            >
              Google AI Studio
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="ollama-url">Адрес Ollama</Label>
          <Input
            id="ollama-url"
            value={settings.ollamaUrl}
            onChange={(e) => onChange({ ollamaUrl: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Нужна vision-модель (например <code>ollama pull qwen2.5vl:7b</code>). С задеплоенного сайта запустите Ollama
            с <code>OLLAMA_ORIGINS=&quot;*&quot;</code>.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="model">Название модели</Label>
        <Input
          id="model"
          list="model-presets"
          value={settings.model}
          onChange={(e) => onChange({ model: e.target.value })}
        />
        <datalist id="model-presets">
          {MODEL_PRESETS[settings.provider].map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
    </fieldset>
  );
}
