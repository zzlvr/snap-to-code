"use client";

import { useState } from "react";
import { ChevronDown, KeyRound, Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPreset, PROVIDERS, type ProviderProfile } from "@/lib/providers";

const PROVIDER_ITEMS = PROVIDERS.map((p) => ({ value: p.id, label: p.label }));

interface Props {
  providerId: string;
  profile: ProviderProfile;
  disabled?: boolean;
  finding?: boolean;
  onProvider: (id: string) => void;
  onChange: (patch: Partial<ProviderProfile>) => void;
  onKey: (key: string) => void;
  onFindLocal: () => void;
}

export function SettingsPanel({ providerId, profile, disabled, finding, onProvider, onChange, onKey, onFindLocal }: Props) {
  const preset = getPreset(providerId);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isLocal = preset.id === "ollama";
  const isCustom = preset.id === "custom";
  // Self-hosted setups need the extra fields, so they are never hidden.
  const advancedShown = advancedOpen || preset.editableBaseUrl;
  const recognised = !preset.editableBaseUrl && profile.apiKey.trim() !== "";

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-4">
      {isLocal ? (
        <p className="rounded-md border bg-secondary/50 px-3 py-2 text-sm">
          Using a local Ollama model: no key needed. Details are in Advanced settings.
        </p>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="apikey" className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            API key{isCustom && " (optional)"}
          </Label>
          <Input
            id="apikey"
            name="api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste your API key…"
            value={profile.apiKey}
            onChange={(e) => onKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {recognised ? (
              <>
                Detected <strong className="text-foreground">{preset.label.replace(/ \(.*\)$/, "")}</strong>, using{" "}
                <code>{profile.model}</code>.{" "}
              </>
            ) : (
              <>Works with Gemini, OpenAI, Anthropic and OpenRouter keys. </>
            )}
            Stored only in this browser and sent straight to the provider.
            {preset.keyUrl && (
              <>
                {" "}
                Get a key at{" "}
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href={preset.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {new URL(preset.keyUrl).hostname}
                </a>
                .
              </>
            )}
          </p>
        </div>
      )}

      <details
        open={advancedShown}
        onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
        className="group rounded-md border bg-card"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Advanced settings
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-4 border-t p-3">
          <div className="space-y-1.5">
            <Label htmlFor="provider">Provider</Label>
            <Select items={PROVIDER_ITEMS} value={providerId} onValueChange={(v) => v && onProvider(v)}>
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

          {preset.editableBaseUrl && (
            <div className="space-y-1.5">
              <Label htmlFor="base-url">Base URL</Label>
              <Input
                id="base-url"
                name="base-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder={preset.defaultBaseUrl}
                value={profile.baseUrl}
                onChange={(e) => onChange({ baseUrl: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              name="model"
              list="model-presets"
              autoComplete="off"
              spellCheck={false}
              placeholder="Vision-capable model name…"
              value={profile.model}
              onChange={(e) => onChange({ model: e.target.value })}
            />
            <datalist id="model-presets">
              {preset.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              {preset.hint ?? "Pick a suggestion or type a model name. It must be able to read images."}
            </p>
          </div>

          <Button type="button" variant="outline" size="sm" className="w-full" onClick={onFindLocal} disabled={finding}>
            {finding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <ScanSearch className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Find local models (Ollama, LM Studio)
          </Button>
        </div>
      </details>
    </fieldset>
  );
}
