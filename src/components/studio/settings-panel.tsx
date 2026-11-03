"use client";

import { KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPreset, PROVIDERS, type ProviderProfile } from "@/lib/providers";

const PROVIDER_ITEMS = PROVIDERS.map((p) => ({ value: p.id, label: p.label }));

interface Props {
  providerId: string;
  profile: ProviderProfile;
  disabled?: boolean;
  onProvider: (id: string) => void;
  onChange: (patch: Partial<ProviderProfile>) => void;
}

export function SettingsPanel({ providerId, profile, disabled, onProvider, onChange }: Props) {
  const preset = getPreset(providerId);

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-4">
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

      {(preset.needsKey || preset.id === "custom") && (
        <div className="space-y-1.5">
          <Label htmlFor="apikey" className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            API key{!preset.needsKey && " (optional)"}
          </Label>
          <Input
            id="apikey"
            name="api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste your key…"
            value={profile.apiKey}
            onChange={(e) => onChange({ apiKey: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
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
                . Restrict it to your site&apos;s domain (HTTP referrer) if the provider allows it.
              </>
            )}
          </p>
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
          placeholder="Any vision-capable model…"
          value={profile.model}
          onChange={(e) => onChange({ model: e.target.value })}
        />
        <datalist id="model-presets">
          {preset.models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <p className="text-xs text-muted-foreground">
          {preset.hint ?? "Pick a suggestion or type any model name. It must be able to read images."}
        </p>
      </div>
    </fieldset>
  );
}
