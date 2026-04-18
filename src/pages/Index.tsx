import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Scan, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUploader } from '@/components/ImageUploader';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { AccountTable } from '@/components/AccountTable';
import { ExportButtons } from '@/components/ExportButtons';
import { ImportExcelButton } from '@/components/ImportExcelButton';
import { AddAccountButton } from '@/components/AddAccountButton';
import { FailedImagesList } from '@/components/FailedImagesList';
import { ShareButton } from '@/components/ShareButton';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useAccounts } from '@/hooks/useAccounts';
import { useImageAnalyzer } from '@/hooks/useImageAnalyzer';
import { useShareLink } from '@/hooks/useShareLink';
import { toast } from 'sonner';

const Index = () => {
  const { deviceId, setSharedDeviceId, getShareCodeFromUrl } = useDeviceId();
  const { accounts, isLoading, addAccount, updateAccount, deleteAccount, clearAllAccounts } = useAccounts(deviceId);
  const { processingState, analyzeImages, failedImages, removeFailedImage, clearFailedImages } = useImageAnalyzer(addAccount, accounts);
  const { shareCode, isGenerating, generateShareLink, getDeviceIdFromCode } = useShareLink(deviceId);
  const [isLoadingShared, setIsLoadingShared] = useState(false);

  const CORRECT_REFERRAL = 'PAPER202214';
  const referralStats = useMemo(() => {
    const missingList: typeof accounts = [];
    const wrongList: typeof accounts = [];
    accounts.forEach(a => {
      const code = (a.referral_code || '').trim();
      if (!code) missingList.push(a);
      else if (code.toUpperCase() !== CORRECT_REFERRAL) wrongList.push(a);
    });
    return {
      missing: missingList.length,
      wrong: wrongList.length,
      total: missingList.length + wrongList.length,
      missingList,
      wrongList,
    };
  }, [accounts]);

  // Handle shared link on mount
  useEffect(() => {
    const handleSharedLink = async () => {
      const code = getShareCodeFromUrl();
      if (!code) return;

      setIsLoadingShared(true);
      const sharedDeviceId = await getDeviceIdFromCode(code);
      
      if (sharedDeviceId) {
        setSharedDeviceId(sharedDeviceId);
        toast.success('Đã kết nối với dữ liệu được chia sẻ');
      } else {
        toast.error('Mã chia sẻ không hợp lệ hoặc đã hết hạn');
      }
      setIsLoadingShared(false);
    };

    if (deviceId) {
      handleSharedLink();
    }
  }, [deviceId, getShareCodeFromUrl, getDeviceIdFromCode, setSharedDeviceId]);
  return (
    <div className="min-h-screen bg-background">

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Tải ảnh lên
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUploader 
              onImagesSelected={analyzeImages} 
              isProcessing={processingState.isProcessing} 
            />
          </CardContent>
        </Card>

        {/* Processing Status */}
        {processingState.isProcessing && (
          <ProcessingStatus
            current={processingState.current}
            total={processingState.total}
            currentImageUrl={processingState.currentImageUrl}
          />
        )}

        {/* Referral code warning */}
        {referralStats.total > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900 rounded-lg p-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 dark:text-amber-200">
              <div className="font-medium">
                {referralStats.total} tài khoản có mã giới thiệu không hợp lệ
              </div>
              <div className="text-xs mt-0.5 text-amber-800 dark:text-amber-300">
                {referralStats.missing > 0 && <span>Thiếu mã: <strong>{referralStats.missing}</strong>. </span>}
                {referralStats.wrong > 0 && <span>Sai mã (khác "{CORRECT_REFERRAL}"): <strong>{referralStats.wrong}</strong>.</span>}
              </div>

              <div className="mt-2 space-y-2">
                {referralStats.wrongList.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
                      Sai mã giới thiệu:
                    </div>
                    <ul className="space-y-0.5 max-h-40 overflow-auto pr-2">
                      {referralStats.wrongList.map(a => (
                        <li
                          key={a.id}
                          className="text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-baseline gap-x-2"
                          data-testid={`text-wrong-referral-${a.id}`}
                        >
                          <span className="font-medium">{a.full_name}</span>
                          <span className="font-mono opacity-80">{a.account_number}</span>
                          <span className="opacity-80">— mã hiện tại: <span className="font-mono">"{a.referral_code}"</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {referralStats.missingList.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
                      Thiếu mã giới thiệu:
                    </div>
                    <ul className="space-y-0.5 max-h-40 overflow-auto pr-2">
                      {referralStats.missingList.map(a => (
                        <li
                          key={a.id}
                          className="text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-baseline gap-x-2"
                          data-testid={`text-missing-referral-${a.id}`}
                        >
                          <span className="font-medium">{a.full_name}</span>
                          <span className="font-mono opacity-80">{a.account_number}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Failed Images List */}
        <FailedImagesList
          failedImages={failedImages}
          onRemove={removeFailedImage}
          onClearAll={clearFailedImages}
        />

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span>Danh sách tài khoản ({accounts.length})</span>
              <div className="flex flex-wrap items-center gap-2">
                <ShareButton
                  shareCode={shareCode}
                  isGenerating={isGenerating}
                  onGenerateLink={generateShareLink}
                />
                <AddAccountButton existingAccounts={accounts} onAdd={addAccount} />
                <ImportExcelButton existingAccounts={accounts} onImport={addAccount} />
                <ExportButtons accounts={accounts} onClearAll={clearAllAccounts} />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Đang tải dữ liệu...
              </div>
            ) : (
              <AccountTable
                accounts={accounts}
                onUpdate={updateAccount}
                onDelete={deleteAccount}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Index;
