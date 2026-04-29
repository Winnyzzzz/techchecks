import { useState, useEffect, useCallback, useRef } from 'react';
import { ExtractedAccount, AIExtractionResult } from '@/types/account';
import { toast } from 'sonner';
import { deleteImage } from '@/lib/imageStorage';
import { useActiveFolder } from '@/hooks/useActiveFolder';

export function useAccounts(deviceId: string, dataset: string) {
  const folderScope = deviceId && dataset ? `${deviceId}:${dataset}` : '';
  const { activeFolder, addFolder } = useActiveFolder(folderScope);
  const activeFolderRef = useRef(activeFolder);
  useEffect(() => { activeFolderRef.current = activeFolder; }, [activeFolder]);
  const [accounts, setAccounts] = useState<ExtractedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Reset list immediately when scope changes so the user never sees the
  // previous dataset's rows briefly.
  useEffect(() => {
    setAccounts([]);
    setIsLoading(true);
  }, [deviceId, dataset]);

  // Fetch with an AbortController + version guard so a slow request from a
  // previous (deviceId, dataset) can't overwrite the current selection.
  useEffect(() => {
    if (!deviceId || !dataset) {
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/accounts/${deviceId}?dataset=${encodeURIComponent(dataset)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        if (!cancelled) setAccounts(data as ExtractedAccount[]);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Error fetching accounts:', error);
        toast.error('Không thể tải danh sách');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [deviceId, dataset]);

  const addAccount = useCallback(async (result: AIExtractionResult): Promise<ExtractedAccount | null> => {
    if (!deviceId || !dataset) return null;
    try {
      const folder = activeFolderRef.current || '';
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          dataset,
          fullName: result.fullName,
          accountNumber: result.accountNumber.replace(/\s/g, ''),
          referralCode: result.referralCode || '',
          senderName: result.senderName || result.fullName || '',
          imageTime: result.imageTime || '',
          folder,
        }),
      });
      if (!res.ok) throw new Error('Failed to add');
      const data = await res.json() as ExtractedAccount;
      setAccounts(prev => [data, ...prev]);
      // Remember folder name in known folders list when an account is created with one
      if (data.folder) addFolder(data.folder);
      return data;
    } catch (error) {
      console.error('Error adding account:', error);
      return null;
    }
  }, [deviceId, dataset, addFolder]);

  const updateAccount = useCallback(async (id: string, fullName: string, accountNumber: string, referralCode: string, senderName: string) => {
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, accountNumber, referralCode, senderName }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setAccounts(prev => prev.map(acc =>
        acc.id === id ? { ...acc, full_name: fullName, account_number: accountNumber, referral_code: referralCode, sender_name: senderName } : acc
      ));
      toast.success('Đã cập nhật thành công');
    } catch (error) {
      console.error('Error updating account:', error);
      toast.error('Không thể cập nhật');
    }
  }, []);

  const deleteAccount = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setAccounts(prev => prev.filter(acc => acc.id !== id));
      deleteImage(id);
      toast.success('Đã xóa thành công');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Không thể xóa');
    }
  }, []);

  const clearAllAccounts = useCallback(async () => {
    if (!deviceId || !dataset) return;
    try {
      const res = await fetch(
        `/api/accounts/device/${deviceId}?dataset=${encodeURIComponent(dataset)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Failed to clear');
      // Best-effort: drop original images only for accounts in the cleared dataset.
      // (Other datasets on this device still own their images in IndexedDB.)
      accounts.forEach(a => { try { deleteImage(a.id); } catch { /* ignore */ } });
      setAccounts([]);
      toast.success('Đã xóa tất cả trong tập này');
    } catch (error) {
      console.error('Error clearing accounts:', error);
      toast.error('Không thể xóa');
    }
  }, [deviceId, dataset, accounts]);

  return {
    accounts,
    isLoading,
    addAccount,
    updateAccount,
    deleteAccount,
    clearAllAccounts,
  };
}
