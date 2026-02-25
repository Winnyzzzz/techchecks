import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ExtractedAccount, AIExtractionResult } from '@/types/account';
import { toast } from 'sonner';

export function useAccounts(deviceId: string) {
  const [accounts, setAccounts] = useState<ExtractedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    if (!deviceId) return;
    try {
      const { data, error } = await supabase
        .from('extracted_accounts')
        .select('*')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAccounts((data || []) as ExtractedAccount[]);
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

  const addAccount = useCallback(async (result: AIExtractionResult): Promise<boolean> => {
    if (!deviceId) return false;
    try {
      const { data, error } = await supabase
        .from('extracted_accounts')
        .insert({
          device_id: deviceId,
          full_name: result.fullName,
          account_number: result.accountNumber.replace(/\s/g, ''),
          referral_code: result.referralCode || '',
          sender_name: result.senderName || result.fullName || '',
          status: 'verified'
        })
        .select()
        .single();
      if (error) throw error;
      setAccounts(prev => [data as ExtractedAccount, ...prev]);
      return true;
    } catch (error) {
      console.error('Error adding account:', error);
      return false;
    }
  }, [deviceId]);

  const updateAccount = useCallback(async (id: string, fullName: string, accountNumber: string, referralCode: string, senderName: string) => {
    try {
      const { error } = await supabase
        .from('extracted_accounts')
        .update({ full_name: fullName, account_number: accountNumber.replace(/\s/g, ''), referral_code: referralCode, sender_name: senderName })
        .eq('id', id);
      if (error) throw error;
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
      const { error } = await supabase
        .from('extracted_accounts')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setAccounts(prev => prev.filter(acc => acc.id !== id));
      toast.success('Đã xóa thành công');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Không thể xóa');
    }
  }, []);

  const clearAllAccounts = useCallback(async () => {
    if (!deviceId) return;
    try {
      const { error } = await supabase
        .from('extracted_accounts')
        .delete()
        .eq('device_id', deviceId);
      if (error) throw error;
      setAccounts([]);
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
