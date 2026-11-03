"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LocalModels } from "@/lib/local-detect";
import {
  DEFAULT_PROVIDER_ID,
  defaultProfile,
  detectProviderFromKey,
  getPreset,
  toConfig,
  type ProviderProfile,
} from "@/lib/providers";

const KEY = "snap-to-code:settings:v2";
// The first version stored a plaintext API key under this name. Delete it so no stale key lingers.
const LEGACY_KEY = "snap-to-code:settings:v1";

interface Stored {
  provider: string;
  profiles: Record<string, ProviderProfile>;
  /** True once the user (or a detected local model) has configured something. */
  touched?: boolean;
}

const INITIAL: Stored = { provider: DEFAULT_PROVIDER_ID, profiles: {} };

/**
 * Settings (including BYOK API keys) live only in this browser's localStorage.
 * Each provider keeps its own key, model and base URL, so switching back and forth loses nothing.
 */
export function useSettings() {
  const [stored, setStored] = useState<Stored>(INITIAL);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_KEY);
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount
      if (raw) setStored({ ...INITIAL, ...JSON.parse(raw) });
    } catch {
      /* storage unavailable: keep defaults */
    }
    setLoaded(true);
  }, []);

  const save = useCallback((fn: (prev: Stored) => Stored) => {
    setStored((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const providerId = getPreset(stored.provider).id;
  const profile: ProviderProfile = useMemo(
    () => ({ ...defaultProfile(providerId), ...stored.profiles[providerId] }),
    [providerId, stored.profiles],
  );
  const config = useMemo(() => toConfig(providerId, profile), [providerId, profile]);
  const touched = Boolean(stored.touched) || Object.values(stored.profiles).some((p) => p.apiKey);

  const setProvider = useCallback((id: string) => save((p) => ({ ...p, provider: id, touched: true })), [save]);

  const patch = useCallback(
    (change: Partial<ProviderProfile>) =>
      save((p) => {
        const id = getPreset(p.provider).id;
        return {
          ...p,
          touched: true,
          profiles: { ...p.profiles, [id]: { ...defaultProfile(id), ...p.profiles[id], ...change } },
        };
      }),
    [save],
  );

  /**
   * Sets the API key. For hosted providers the provider is inferred from the key, so a newcomer
   * only has to paste a key. Self-hosted/custom endpoints are never switched away automatically.
   */
  const setKey = useCallback(
    (key: string) =>
      save((p) => {
        const current = getPreset(p.provider);
        const detected = current.editableBaseUrl ? null : detectProviderFromKey(key);
        const target = detected ?? current.id;
        const profiles = { ...p.profiles };
        if (target !== current.id) {
          // Do not leave a half-typed or misrouted key behind on the provider we are leaving.
          profiles[current.id] = { ...defaultProfile(current.id), ...profiles[current.id], apiKey: "" };
        }
        profiles[target] = { ...defaultProfile(target), ...profiles[target], apiKey: key };
        return { ...p, provider: target, profiles, touched: true };
      }),
    [save],
  );

  /** Selects a model found on this machine (Ollama / LM Studio). */
  const applyLocal = useCallback(
    (found: LocalModels) =>
      save((p) => ({
        ...p,
        provider: found.providerId,
        touched: true,
        profiles: {
          ...p.profiles,
          [found.providerId]: {
            ...defaultProfile(found.providerId),
            ...p.profiles[found.providerId],
            baseUrl: found.baseUrl,
            model: found.models[0],
          },
        },
      })),
    [save],
  );

  return { providerId, profile, config, loaded, touched, setProvider, patch, setKey, applyLocal };
}
