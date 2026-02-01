import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AIExtractionResult } from '@/types/account';
import { toast } from 'sonner';

interface ProcessingState {
  isProcessing: boolean;
  current: number;
  total: number;
  currentImageUrl?: string;
}

export function useImageAnalyzer(onResult: (result: AIExtractionResult) => Promise<boolean>) {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    current: 0,
    total: 0,
  });

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const analyzeImages = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setProcessingState({
      isProcessing: true,
      current: 0,
      total: files.length,
    });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imageUrl = URL.createObjectURL(file);

      setProcessingState(prev => ({
        ...prev,
        current: i + 1,
        currentImageUrl: imageUrl,
      }));

      try {
        const base64 = await fileToBase64(file);
        
        const { data, error } = await supabase.functions.invoke('analyze-image', {
          body: { imageBase64: base64 }
        });

        URL.revokeObjectURL(imageUrl);

        if (error) {
          console.error('Edge function error:', error);
          errorCount++;
          continue;
        }

        if (data.results && Array.isArray(data.results)) {
          for (const result of data.results) {
            if (result.fullName && result.accountNumber) {
              const success = await onResult(result);
              if (success) successCount++;
            }
          }
        }
      } catch (error) {
        console.error('Error analyzing image:', error);
        URL.revokeObjectURL(imageUrl);
        errorCount++;
      }
    }

    setProcessingState({
      isProcessing: false,
      current: 0,
      total: 0,
    });

    if (successCount > 0) {
      toast.success(`Đã trích xuất ${successCount} tài khoản thành công`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} ảnh không thể phân tích`);
    }
    if (successCount === 0 && errorCount === 0) {
      toast.info('Không tìm thấy thông tin tài khoản trong các ảnh');
    }
  }, [onResult]);

  return {
    processingState,
    analyzeImages,
  };
}
