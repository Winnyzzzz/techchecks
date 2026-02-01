import { useState, useEffect, useCallback } from 'react';

const DEVICE_ID_KEY = 'device_id';

export function useDeviceId() {
  const [deviceId, setDeviceId] = useState<string>('');
  const [isSharedSession, setIsSharedSession] = useState(false);

  useEffect(() => {
    // Check for share code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      // Will be handled by the parent component
      setIsSharedSession(true);
    }

    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    setDeviceId(id);
  }, []);

  const setSharedDeviceId = useCallback((sharedId: string) => {
    localStorage.setItem(DEVICE_ID_KEY, sharedId);
    setDeviceId(sharedId);
    // Remove code from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    window.history.replaceState({}, '', url.toString());
  }, []);

  const getShareCodeFromUrl = useCallback((): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('code');
  }, []);

  return { deviceId, isSharedSession, setSharedDeviceId, getShareCodeFromUrl };
}
