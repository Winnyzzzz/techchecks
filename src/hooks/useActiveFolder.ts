import { useCallback, useEffect, useState } from 'react';

const ACTIVE_KEY = 'active_folder';
const FOLDERS_KEY = 'known_folders';

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

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_KEY) setActiveFolderState(e.newValue || '');
      if (e.key === FOLDERS_KEY) setFoldersState(loadFolders());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setActiveFolder = useCallback((name: string) => {
    const cleaned = name.trim();
    try {
      localStorage.setItem(ACTIVE_KEY, cleaned);
    } catch {
      // ignore
    }
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
    setActiveFolderState(prev => (prev === name ? '' : prev));
    try {
      const cur = localStorage.getItem(ACTIVE_KEY);
      if (cur === name) localStorage.setItem(ACTIVE_KEY, '');
    } catch {
      // ignore
    }
  }, []);

  return { activeFolder, setActiveFolder, folders, addFolder, removeFolder };
}
