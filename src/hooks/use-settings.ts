"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PROVIDER_ID,
  defaultProfile,
  getPreset,
  toConfig,
  type ProviderProfile,
} from "@/lib/providers";

const KEY = "snap-to-code:settings:v2";

interface Stored {
  provider: string;
  profiles: Record<string, ProviderProfile>;
}

const INITIAL: Stored = { provider: DEFAULT_PROVIDER_ID, profiles: {} };

/**
 * Settings (including BYOK API keys) live only in this browser's localStorage.
 * Each provider keeps its own key, model and base URL, so switching back and forth loses nothing.
 */
export function useSettings() {
  const [stored, setStored] = useState<Stored>(INITIAL);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount
      if (raw) setStored({ ...INITIAL, ...JSON.parse(raw) });
    } catch {
      /* storage unavailable: keep defaults */
    }
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

  const setProvider = useCallback((id: string) => save((p) => ({ ...p, provider: id })), [save]);
  const patch = useCallback(
    (change: Partial<ProviderProfile>) =>
      save((p) => {
        const id = getPreset(p.provider).id;
        return { ...p, profiles: { ...p.profiles, [id]: { ...defaultProfile(id), ...p.profiles[id], ...change } } };
      }),
    [save],
  );

  return { providerId, profile, config, setProvider, patch };
}
