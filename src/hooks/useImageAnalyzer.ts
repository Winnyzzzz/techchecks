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

export interface FailedImage {
  fileName: string;
  previewUrl: string;
  error: string;
}

export function useImageAnalyzer(onResult: (result: AIExtractionResult) => Promise<boolean>) {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    current: 0,
    total: 0,
  });
  const [failedImages, setFailedImages] = useState<FailedImage[]>([]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const clearFailedImages = useCallback(() => {
    setFailedImages(prev => {
      prev.forEach(img => URL.revokeObjectURL(img.previewUrl));
      return [];
    });
  }, []);

  const removeFailedImage = useCallback((index: number) => {
    setFailedImages(prev => {
      const newList = [...prev];
      URL.revokeObjectURL(newList[index].previewUrl);
      newList.splice(index, 1);
      return newList;
    });
  }, []);

  const analyzeImages = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // Clear previous failed images
    clearFailedImages();

    setProcessingState({
      isProcessing: true,
      current: 0,
      total: files.length,
    });

    let successCount = 0;
    const newFailedImages: FailedImage[] = [];

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

        if (error) {
          console.error('Edge function error:', error);
          newFailedImages.push({
            fileName: file.name,
            previewUrl: imageUrl,
            error: error.message || 'Lỗi khi gọi AI phân tích'
          });
          continue;
        }

        let foundAccount = false;
        if (data.results && Array.isArray(data.results)) {
          for (const result of data.results) {
            if (result.fullName && result.accountNumber) {
              const success = await onResult(result);
              if (success) {
                successCount++;
                foundAccount = true;
              }
            }
          }
        }

        // If no account found in this image, mark as failed
        if (!foundAccount) {
          newFailedImages.push({
            fileName: file.name,
            previewUrl: imageUrl,
            error: 'Không tìm thấy thông tin tài khoản trong ảnh'
          });
        } else {
          URL.revokeObjectURL(imageUrl);
        }
      } catch (error) {
        console.error('Error analyzing image:', error);
        newFailedImages.push({
          fileName: file.name,
          previewUrl: imageUrl,
          error: error instanceof Error ? error.message : 'Lỗi không xác định'
        });
      }
    }

    setProcessingState({
      isProcessing: false,
      current: 0,
      total: 0,
    });

    setFailedImages(newFailedImages);

    if (successCount > 0) {
      toast.success(`Đã trích xuất ${successCount} tài khoản thành công`);
    }
    if (newFailedImages.length > 0) {
      toast.error(`${newFailedImages.length} ảnh không thể phân tích`);
    }
    if (successCount === 0 && newFailedImages.length === 0) {
      toast.info('Không tìm thấy thông tin tài khoản trong các ảnh');
    }
  }, [onResult, clearFailedImages]);

  return {
    processingState,
    analyzeImages,
    failedImages,
    removeFailedImage,
    clearFailedImages,
  };
}
