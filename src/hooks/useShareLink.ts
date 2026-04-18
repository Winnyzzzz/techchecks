import { useState, useCallback } from 'react';
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
      const existingRes = await fetch(`/api/share-links/${deviceId}`);
      if (existingRes.ok) {
        const existing = await existingRes.json();
        if (existing?.shareCode) {
          setShareCode(existing.shareCode);
          return existing.shareCode;
        }
      }

      // Generate new share code
      let newCode = generateShortCode();
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        const res = await fetch('/api/share-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, shareCode: newCode }),
        });

        if (res.ok) {
          setShareCode(newCode);
          return newCode;
        }

        const err = await res.json();
        if (err.code === '23505') {
          newCode = generateShortCode();
          attempts++;
        } else {
          throw new Error(err.error || 'Unknown error');
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
      const res = await fetch(`/api/share-links/code/${code.toUpperCase()}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data?.deviceId || null;
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
