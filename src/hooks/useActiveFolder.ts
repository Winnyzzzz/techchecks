import { useCallback, useEffect, useState } from 'react';

const ACTIVE_KEY = 'active_folder';
const FOLDERS_KEY = 'known_folders';
const ACTIVE_EVENT = 'active-folder-changed';
const FOLDERS_EVENT = 'known-folders-changed';

const loadFolders = (): string[] => {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(s => typeof s === 'string' && s.trim()) : [];
  } catch {
    return [];
  }
};

const saveFolders = (list: string[]) => {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(FOLDERS_EVENT));
  } catch {
    // ignore
  }
};

const writeActive = (cleaned: string) => {
  try {
    localStorage.setItem(ACTIVE_KEY, cleaned);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(ACTIVE_EVENT, { detail: cleaned }));
  } catch {
    // ignore
  }
};

export function useActiveFolder() {
  const [activeFolder, setActiveFolderState] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [folders, setFoldersState] = useState<string[]>(() => loadFolders());

  // Sync across all hook instances in the same tab + across tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_KEY) setActiveFolderState(e.newValue || '');
      if (e.key === FOLDERS_KEY) setFoldersState(loadFolders());
    };
    const onActiveChanged = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setActiveFolderState(typeof detail === 'string' ? detail : (localStorage.getItem(ACTIVE_KEY) || ''));
    };
    const onFoldersChanged = () => setFoldersState(loadFolders());

    window.addEventListener('storage', onStorage);
    window.addEventListener(ACTIVE_EVENT, onActiveChanged as EventListener);
    window.addEventListener(FOLDERS_EVENT, onFoldersChanged);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(ACTIVE_EVENT, onActiveChanged as EventListener);
      window.removeEventListener(FOLDERS_EVENT, onFoldersChanged);
    };
  }, []);

  const setActiveFolder = useCallback((name: string) => {
    const cleaned = name.trim();
    writeActive(cleaned);
    setActiveFolderState(cleaned);
  }, []);

  const addFolder = useCallback((name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return false;
    setFoldersState(prev => {
      if (prev.some(f => f.toLowerCase() === cleaned.toLowerCase())) return prev;
      const next = [...prev, cleaned].sort((a, b) => a.localeCompare(b, 'vi'));
      saveFolders(next);
      return next;
    });
    return true;
  }, []);

  const removeFolder = useCallback((name: string) => {
    setFoldersState(prev => {
      const next = prev.filter(f => f !== name);
      saveFolders(next);
      return next;
    });
    setActiveFolderState(prev => {
      if (prev === name) {
        writeActive('');
        return '';
      }
      return prev;
    });
  }, []);

  return { activeFolder, setActiveFolder, folders, addFolder, removeFolder };
}
