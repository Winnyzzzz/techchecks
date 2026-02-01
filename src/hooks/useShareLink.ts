import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function useShareLink(deviceId: string) {
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateShareLink = useCallback(async () => {
    if (!deviceId) return null;

    setIsGenerating(true);
    try {
      // Check if share link already exists for this device
      const { data: existing } = await supabase
        .from('share_links')
        .select('share_code')
        .eq('device_id', deviceId)
        .single();

      if (existing) {
        setShareCode(existing.share_code);
        return existing.share_code;
      }

      // Generate new share code
      let newCode = generateShortCode();
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        const { error } = await supabase
          .from('share_links')
          .insert({ device_id: deviceId, share_code: newCode });

        if (!error) {
          setShareCode(newCode);
          return newCode;
        }

        // If duplicate, try another code
        if (error.code === '23505') {
          newCode = generateShortCode();
          attempts++;
        } else {
          throw error;
        }
      }

      throw new Error('Không thể tạo mã chia sẻ');
    } catch (error) {
      console.error('Error generating share link:', error);
      toast.error('Không thể tạo link chia sẻ');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [deviceId]);

  const getDeviceIdFromCode = useCallback(async (code: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('share_links')
        .select('device_id')
        .eq('share_code', code.toUpperCase())
        .single();

      if (error || !data) {
        return null;
      }

      return data.device_id;
    } catch (error) {
      console.error('Error getting device from code:', error);
      return null;
    }
  }, []);

  const copyShareLink = useCallback(async () => {
    const code = shareCode || await generateShareLink();
    if (!code) return;

    const url = `${window.location.origin}?code=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Đã sao chép link chia sẻ');
    } catch {
      toast.error('Không thể sao chép');
    }
  }, [shareCode, generateShareLink]);

  return {
    shareCode,
    isGenerating,
    generateShareLink,
    getDeviceIdFromCode,
    copyShareLink,
  };
}
