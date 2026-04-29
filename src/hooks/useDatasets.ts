import { useCallback, useEffect, useState } from 'react';

const DEFAULT_DATASET = 'default';
const LIST_KEY = (deviceId: string) => `datasets:${deviceId}`;
const CURRENT_KEY = (deviceId: string) => `current_dataset:${deviceId}`;
const CHANGED_EVENT = 'datasets-changed';

const loadList = (deviceId: string): string[] => {
  if (!deviceId) return [DEFAULT_DATASET];
  try {
    const raw = localStorage.getItem(LIST_KEY(deviceId));
    if (!raw) return [DEFAULT_DATASET];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [DEFAULT_DATASET];
    const cleaned = arr
      .map((s: unknown) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean);
    return cleaned.includes(DEFAULT_DATASET) ? cleaned : [DEFAULT_DATASET, ...cleaned];
  } catch {
    return [DEFAULT_DATASET];
  }
};

const saveList = (deviceId: string, list: string[]) => {
  if (!deviceId) return;
  try {
    localStorage.setItem(LIST_KEY(deviceId), JSON.stringify(list));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
  } catch {
    // ignore
  }
};

const loadCurrent = (deviceId: string): string => {
  if (!deviceId) return DEFAULT_DATASET;
  try {
    return localStorage.getItem(CURRENT_KEY(deviceId)) || DEFAULT_DATASET;
  } catch {
    return DEFAULT_DATASET;
  }
};

const saveCurrent = (deviceId: string, name: string) => {
  if (!deviceId) return;
  try {
    localStorage.setItem(CURRENT_KEY(deviceId), name);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
  } catch {
    // ignore
  }
};

export function useDatasets(deviceId: string) {
  const [datasets, setDatasets] = useState<string[]>(() => loadList(deviceId));
  const [currentDataset, setCurrentDatasetState] = useState<string>(() => loadCurrent(deviceId));

  // Reload from storage when deviceId changes or another instance dispatches the event
  useEffect(() => {
    setDatasets(loadList(deviceId));
    setCurrentDatasetState(loadCurrent(deviceId));
  }, [deviceId]);

  useEffect(() => {
    const onChanged = () => {
      setDatasets(loadList(deviceId));
      setCurrentDatasetState(loadCurrent(deviceId));
    };
    window.addEventListener(CHANGED_EVENT, onChanged);
    window.addEventListener('storage', onChanged);
    return () => {
      window.removeEventListener(CHANGED_EVENT, onChanged);
      window.removeEventListener('storage', onChanged);
    };
  }, [deviceId]);

  // Sync with server: pull dataset names that already have data on this device
  // (covers the case where localStorage was cleared but DB still has data)
  useEffect(() => {
    if (!deviceId) return;
    let cancelled = false;
    fetch(`/api/datasets/${deviceId}`)
      .then(r => (r.ok ? r.json() : []))
      .then((serverList: unknown) => {
        if (cancelled || !Array.isArray(serverList)) return;
        const local = loadList(deviceId);
        const merged = Array.from(
          new Set<string>([
            DEFAULT_DATASET,
            ...local,
            ...serverList.filter((s): s is string => typeof s === 'string' && !!s.trim()),
          ]),
        );
        if (merged.length !== local.length || merged.some((v, i) => v !== local[i])) {
          saveList(deviceId, merged);
          setDatasets(merged);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  const setCurrentDataset = useCallback(
    (name: string) => {
      const cleaned = (name || '').trim() || DEFAULT_DATASET;
      saveCurrent(deviceId, cleaned);
      setCurrentDatasetState(cleaned);
    },
    [deviceId],
  );

  const addDataset = useCallback(
    (name: string): { ok: boolean; error?: string } => {
      const cleaned = (name || '').trim();
      if (!cleaned) return { ok: false, error: 'Tên không được để trống' };
      if (datasets.some(d => d.toLowerCase() === cleaned.toLowerCase())) {
        return { ok: false, error: 'Tên này đã tồn tại' };
      }
      const next = [...datasets, cleaned];
      saveList(deviceId, next);
      setDatasets(next);
      return { ok: true };
    },
    [datasets, deviceId],
  );

  const renameDataset = useCallback(
    async (oldName: string, newName: string): Promise<{ ok: boolean; error?: string; moved?: number }> => {
      const oldCleaned = (oldName || '').trim();
      const newCleaned = (newName || '').trim();
      if (!oldCleaned || !newCleaned) return { ok: false, error: 'Tên không được để trống' };
      if (oldCleaned === DEFAULT_DATASET) return { ok: false, error: 'Không thể đổi tên tập "default"' };
      if (oldCleaned === newCleaned) return { ok: true, moved: 0 };
      const isMerge = datasets.some(d => d.toLowerCase() === newCleaned.toLowerCase());
      try {
        const res = await fetch(`/api/datasets/${deviceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: oldCleaned, to: newCleaned }),
        });
        if (!res.ok) throw new Error('rename failed');
        const data = await res.json();
        const next = isMerge
          ? datasets.filter(d => d.toLowerCase() !== oldCleaned.toLowerCase())
          : datasets.map(d => (d === oldCleaned ? newCleaned : d));
        // Always keep "default" present
        if (!next.includes(DEFAULT_DATASET)) next.unshift(DEFAULT_DATASET);
        saveList(deviceId, next);
        setDatasets(next);
        if (currentDataset === oldCleaned) {
          saveCurrent(deviceId, newCleaned);
          setCurrentDatasetState(newCleaned);
        }
        return { ok: true, moved: data?.moved ?? 0 };
      } catch (e) {
        return { ok: false, error: 'Không thể đổi tên trên máy chủ' };
      }
    },
    [datasets, deviceId, currentDataset],
  );

  const removeDataset = useCallback(
    (name: string): { ok: boolean; error?: string } => {
      const cleaned = (name || '').trim();
      if (cleaned === DEFAULT_DATASET) {
        return { ok: false, error: 'Không thể xoá tập "default"' };
      }
      const next = datasets.filter(d => d !== cleaned);
      if (!next.includes(DEFAULT_DATASET)) next.unshift(DEFAULT_DATASET);
      saveList(deviceId, next);
      setDatasets(next);
      if (currentDataset === cleaned) {
        saveCurrent(deviceId, DEFAULT_DATASET);
        setCurrentDatasetState(DEFAULT_DATASET);
      }
      return { ok: true };
    },
    [datasets, deviceId, currentDataset],
  );

  return {
    datasets,
    currentDataset,
    setCurrentDataset,
    addDataset,
    renameDataset,
    removeDataset,
  };
}

export const DEFAULT_DATASET_NAME = DEFAULT_DATASET;
