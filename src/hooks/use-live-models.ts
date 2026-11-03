"use client";

import { useEffect, useRef, useState } from "react";
import { bestModel, fetchModelIds, LIVE_MODEL_PROVIDERS } from "@/lib/models";
import { getPreset } from "@/lib/providers";
import type { LLMConfig } from "@/lib/types";

/**
 * Asks the provider which models the entered key can use (after a short pause in typing).
 * While the model is still the untouched preset default, it is replaced by the best live model,
 * so the app keeps working when the provider retires a name. A model the user chose is never changed.
 */
export function useLiveModels(providerId: string, config: LLMConfig, onUseModel: (model: string) => void) {
  const [found, setFound] = useState<{ key: string; ids: string[] }>({ key: "", ids: [] });
  const key = `${providerId}|${config.baseUrl}|${config.apiKey}`;

  const latest = useRef({ model: config.model, onUseModel });
  useEffect(() => {
    latest.current = { model: config.model, onUseModel };
  });

  useEffect(() => {
    if (!LIVE_MODEL_PROVIDERS.has(providerId) || !config.apiKey.trim()) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      void fetchModelIds(providerId, config, ctrl.signal).then((ids) => {
        if (ctrl.signal.aborted || ids.length === 0) return;
        setFound({ key, ids });
        const best = bestModel(providerId, ids);
        const untouched = latest.current.model === getPreset(providerId).models[0];
        if (best && untouched && best !== latest.current.model) latest.current.onUseModel(best);
      });
    }, 600);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // `config` is covered by `key` (provider, base URL, key); the model is read through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, providerId]);

  return found.key === key ? found.ids : [];
}
