import { useState, useCallback } from 'react';
import { AIExtractionResult, ExtractedAccount } from '@/types/account';
import { toast } from 'sonner';
import { saveImage } from '@/lib/imageStorage';
import { getActiveProviderConfigs } from '@/hooks/useAIProviders';

export interface ProviderUsedInfo {
  providerId: string;
  label: string;
  model: string;
  keyLabel?: string;
}

interface ProcessingState {
  isProcessing: boolean;
  current: number;
  total: number;
  currentImageUrl?: string;
  providerUsed?: ProviderUsedInfo;
}

export interface FailedImage {
  fileName: string;
  previewUrl: string;
  error: string;
  duplicateOf?: {
    fullName: string;
    accountNumber: string;
    source: 'batch' | 'existing';
    fileName?: string;
  };
}

const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const normalizeAccount = (s: string) => s.replace(/\s/g, '');
const dupKey = (fullName: string, accountNumber: string) =>
  `${normalizeName(fullName)}|${normalizeAccount(accountNumber)}`;

export function useImageAnalyzer(
  onResult: (result: AIExtractionResult) => Promise<ExtractedAccount | null>,
  existingAccounts: ExtractedAccount[] = []
) {
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

    clearFailedImages();

    setProcessingState({
      isProcessing: true,
      current: 0,
      total: files.length,
    });

    let successCount = 0;
    let duplicateCount = 0;
    const newFailedImages: FailedImage[] = [];

    // Track (fullName + accountNumber) seen in this batch and existing DB
    const seenInBatch = new Map<string, string>(); // key -> fileName
    const existingMap = new Map<string, ExtractedAccount>(
      existingAccounts.map(a => [dupKey(a.full_name, a.account_number), a])
    );

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

        const activeProviders = getActiveProviderConfigs().map(p => ({
          providerId: p.providerId,
          apiKey: p.apiKey,
          model: p.model,
          keyLabel: p.label,
        }));

        const response = await fetch('/api/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, providers: activeProviders }),
        });
        const data = await response.json();

        if (data?.providerUsed) {
          setProcessingState(prev => ({ ...prev, providerUsed: data.providerUsed }));
          const failovers = Array.isArray(data.failovers) ? data.failovers : [];
          const skipped = Array.isArray(data.skipped) ? data.skipped : [];
          if (failovers.length > 0 || skipped.length > 0) {
            const usedLabel = `${data.providerUsed.label}${data.providerUsed.keyLabel ? ` (${data.providerUsed.keyLabel})` : ''}`;
            const failedNames = failovers
              .map((a: any) => `${a.label}${a.keyLabel ? ` (${a.keyLabel})` : ''}`)
              .join(', ');
            const skippedNames = skipped
              .map((a: any) => {
                const wait = a.retryAfterMs ? ` còn ${Math.ceil(a.retryAfterMs / 1000)}s` : '';
                return `${a.label}${a.keyLabel ? ` (${a.keyLabel})` : ''}${wait}`;
              })
              .join(', ');
            const description = [
              failovers.length > 0 ? `Lỗi: ${failedNames}` : '',
              skipped.length > 0 ? `Đang nghỉ: ${skippedNames}` : '',
            ]
              .filter(Boolean)
              .join(' · ');
            toast.info(`Đang dùng ${usedLabel}`, {
              description,
              duration: 4500,
            });
          }
        }

        if (!response.ok) {
          console.error('API error:', response.status, data);
          newFailedImages.push({
            fileName: file.name,
            previewUrl: imageUrl,
            error: data.error || 'Lỗi khi gọi AI phân tích'
          });
          continue;
        }

        let foundAccount = false;
        let duplicateMessage: string | null = null;
        let duplicateInfo: FailedImage['duplicateOf'] | undefined;

        if (data.results && Array.isArray(data.results)) {
          for (const result of data.results) {
            if (result.fullName && result.accountNumber) {
              result.referralCode = result.referralCode || '';
              result.senderName = result.senderName || '';
              result.imageTime = result.imageTime || '';

              const key = dupKey(result.fullName, result.accountNumber);
              const prevFile = seenInBatch.get(key);

              if (prevFile) {
                duplicateCount++;
                duplicateMessage = `Trùng với ảnh "${prevFile}": ${result.fullName} - ${result.accountNumber}`;
                duplicateInfo = {
                  fullName: result.fullName,
                  accountNumber: result.accountNumber,
                  source: 'batch',
                  fileName: prevFile,
                };
                toast.warning(`Trùng: "${file.name}" và "${prevFile}"`, {
                  description: `${result.fullName} - ${result.accountNumber}`,
                  duration: 6000,
                });
                continue;
              }
              const existing = existingMap.get(key);
              if (existing) {
                duplicateCount++;
                duplicateMessage = `Đã có sẵn: ${existing.full_name} - ${existing.account_number}`;
                duplicateInfo = {
                  fullName: existing.full_name,
                  accountNumber: existing.account_number,
                  source: 'existing',
                };
                toast.warning(`Ảnh "${file.name}" trùng với tài khoản đã có`, {
                  description: `${existing.full_name} - ${existing.account_number}`,
                  duration: 6000,
                });
                continue;
              }

              const account = await onResult(result);
              if (account) {
                successCount++;
                foundAccount = true;
                seenInBatch.set(key, file.name);
                existingMap.set(key, account);
                // Save the original image to IndexedDB so it can be viewed later
                saveImage(account.id, file).catch(() => {/* non-fatal */});
              }
            }
          }
        }

        if (!foundAccount) {
          newFailedImages.push({
            fileName: file.name,
            previewUrl: imageUrl,
            error: duplicateMessage || 'Không tìm thấy thông tin tài khoản trong ảnh',
            duplicateOf: duplicateInfo,
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
    if (duplicateCount > 0) {
      toast.warning(`Tổng cộng ${duplicateCount} ảnh trùng tên + STK đã được bỏ qua`);
    }
    if (newFailedImages.length > 0) {
      toast.error(`${newFailedImages.length} ảnh không thể phân tích`);
    }
    if (successCount === 0 && duplicateCount === 0 && newFailedImages.length === 0) {
      toast.info('Không tìm thấy thông tin tài khoản trong các ảnh');
    }
  }, [onResult, clearFailedImages, existingAccounts]);

  return {
    processingState,
    analyzeImages,
    failedImages,
    removeFailedImage,
    clearFailedImages,
  };
}
