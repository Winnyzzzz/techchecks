import { useCallback, useEffect, useState } from 'react';

export type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'mistral';

export interface ProviderConfig {
  id: string;
  providerId: ProviderId;
  apiKey: string;
  model: string;
  enabled: boolean;
  label?: string;
}

const STORAGE_KEY = 'ai_providers_config';
const EVENT = 'ai-providers-changed';

const load = (): ProviderConfig[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (p) =>
        p &&
        typeof p === 'object' &&
        typeof p.id === 'string' &&
        typeof p.providerId === 'string' &&
        typeof p.apiKey === 'string' &&
        typeof p.model === 'string' &&
        typeof p.enabled === 'boolean',
    );
  } catch {
    return [];
  }
};

const save = (list: ProviderConfig[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // ignore
  }
};

export function useAIProviders() {
  const [providers, setProviders] = useState<ProviderConfig[]>(() => load());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setProviders(load());
    };
    const onChanged = () => setProviders(load());
    window.addEventListener('storage', onStorage);
    window.addEventListener(EVENT, onChanged);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(EVENT, onChanged);
    };
  }, []);

  const persist = useCallback((next: ProviderConfig[]) => {
    save(next);
    setProviders(next);
  }, []);

  const addProvider = useCallback(
    (p: Omit<ProviderConfig, 'id'>) => {
      const id = `${p.providerId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      persist([...load(), { ...p, id }]);
      return id;
    },
    [persist],
  );

  const updateProvider = useCallback(
    (id: string, patch: Partial<Omit<ProviderConfig, 'id'>>) => {
      persist(load().map((p) => (p.id === id ? { ...p, ...patch } : p)));
    },
    [persist],
  );

  const removeProvider = useCallback(
    (id: string) => {
      persist(load().filter((p) => p.id !== id));
    },
    [persist],
  );

  const reorderProviders = useCallback(
    (next: ProviderConfig[]) => {
      // Validate that all ids match the current set; otherwise ignore.
      const current = load();
      if (
        next.length !== current.length ||
        !next.every((p) => current.some((c) => c.id === p.id))
      ) {
        return;
      }
      persist(next);
    },
    [persist],
  );

  return {
    providers,
    addProvider,
    updateProvider,
    removeProvider,
    reorderProviders,
  };
}

export function getActiveProviderConfigs(): ProviderConfig[] {
  return load().filter((p) => p.enabled && p.apiKey.trim());
}
