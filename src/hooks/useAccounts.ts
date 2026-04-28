import { useState, useEffect, useCallback, useRef } from 'react';
import { ExtractedAccount, AIExtractionResult } from '@/types/account';
import { toast } from 'sonner';
import { deleteImage, clearAllImages } from '@/lib/imageStorage';
import { useActiveFolder } from '@/hooks/useActiveFolder';

export function useAccounts(deviceId: string) {
  const { activeFolder, addFolder } = useActiveFolder();
  const activeFolderRef = useRef(activeFolder);
  useEffect(() => { activeFolderRef.current = activeFolder; }, [activeFolder]);
  const [accounts, setAccounts] = useState<ExtractedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    if (!deviceId) return;
    try {
      const res = await fetch(`/api/accounts/${deviceId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAccounts(data as ExtractedAccount[]);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Không thể tải danh sách');
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const addAccount = useCallback(async (result: AIExtractionResult): Promise<ExtractedAccount | null> => {
    if (!deviceId) return null;
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          fullName: result.fullName,
          accountNumber: result.accountNumber.replace(/\s/g, ''),
          referralCode: result.referralCode || '',
          senderName: result.senderName || result.fullName || '',
          imageTime: result.imageTime || '',
          folder: activeFolderRef.current || '',
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
  }, [deviceId, addFolder]);

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
    if (!deviceId) return;
    try {
      const res = await fetch(`/api/accounts/device/${deviceId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear');
      setAccounts([]);
      clearAllImages();
      toast.success('Đã xóa tất cả');
    } catch (error) {
      console.error('Error clearing accounts:', error);
      toast.error('Không thể xóa');
    }
  }, [deviceId]);

  return {
    accounts,
    isLoading,
    addAccount,
    updateAccount,
    deleteAccount,
    clearAllAccounts,
  };
}
