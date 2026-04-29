import { useCallback, useEffect, useState } from 'react';

const ACTIVE_PREFIX = 'active_folder';
const FOLDERS_PREFIX = 'known_folders';
const ACTIVE_EVENT = 'active-folder-changed';
const FOLDERS_EVENT = 'known-folders-changed';

const activeKey = (scope: string) => (scope ? `${ACTIVE_PREFIX}:${scope}` : ACTIVE_PREFIX);
const foldersKey = (scope: string) => (scope ? `${FOLDERS_PREFIX}:${scope}` : FOLDERS_PREFIX);

const loadFolders = (scope: string): string[] => {
  try {
    const raw = localStorage.getItem(foldersKey(scope));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s: unknown): s is string => typeof s === 'string' && !!s.trim()) : [];
  } catch {
    return [];
  }
};

const saveFolders = (scope: string, list: string[]) => {
  try {
    localStorage.setItem(foldersKey(scope), JSON.stringify(list));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(FOLDERS_EVENT, { detail: scope }));
  } catch {
    // ignore
  }
};

const writeActive = (scope: string, cleaned: string) => {
  try {
    localStorage.setItem(activeKey(scope), cleaned);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(ACTIVE_EVENT, { detail: { scope, value: cleaned } }));
  } catch {
    // ignore
  }
};

export function useActiveFolder(scope: string = '') {
  const [activeFolder, setActiveFolderState] = useState<string>(() => {
    try {
      return localStorage.getItem(activeKey(scope)) || '';
    } catch {
      return '';
    }
  });
  const [folders, setFoldersState] = useState<string[]>(() => loadFolders(scope));

  // Reload state when scope changes
  useEffect(() => {
    try {
      setActiveFolderState(localStorage.getItem(activeKey(scope)) || '');
    } catch {
      setActiveFolderState('');
    }
    setFoldersState(loadFolders(scope));
  }, [scope]);

  // Sync across all hook instances in the same tab + across tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === activeKey(scope)) setActiveFolderState(e.newValue || '');
      if (e.key === foldersKey(scope)) setFoldersState(loadFolders(scope));
    };
    const onActiveChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ scope: string; value: string }>).detail;
      if (!detail || detail.scope !== scope) return;
      setActiveFolderState(typeof detail.value === 'string' ? detail.value : '');
    };
    const onFoldersChanged = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string' && detail !== scope) return;
      setFoldersState(loadFolders(scope));
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(ACTIVE_EVENT, onActiveChanged as EventListener);
    window.addEventListener(FOLDERS_EVENT, onFoldersChanged as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(ACTIVE_EVENT, onActiveChanged as EventListener);
      window.removeEventListener(FOLDERS_EVENT, onFoldersChanged as EventListener);
    };
  }, [scope]);

  const setActiveFolder = useCallback((name: string) => {
    const cleaned = name.trim();
    writeActive(scope, cleaned);
    setActiveFolderState(cleaned);
  }, [scope]);

  const addFolder = useCallback((name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return false;
    setFoldersState(prev => {
      if (prev.some(f => f.toLowerCase() === cleaned.toLowerCase())) return prev;
      const next = [...prev, cleaned].sort((a, b) => a.localeCompare(b, 'vi'));
      saveFolders(scope, next);
      return next;
    });
    return true;
  }, [scope]);

  const removeFolder = useCallback((name: string) => {
    setFoldersState(prev => {
      const next = prev.filter(f => f !== name);
      saveFolders(scope, next);
      return next;
    });
    setActiveFolderState(prev => {
      if (prev === name) {
        writeActive(scope, '');
        return '';
      }
      return prev;
    });
  }, [scope]);

  return { activeFolder, setActiveFolder, folders, addFolder, removeFolder };
}
