import { CreditCard, Scan } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUploader } from '@/components/ImageUploader';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { AccountTable } from '@/components/AccountTable';
import { ExportButtons } from '@/components/ExportButtons';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useAccounts } from '@/hooks/useAccounts';
import { useImageAnalyzer } from '@/hooks/useImageAnalyzer';

const Index = () => {
  const deviceId = useDeviceId();
  const { accounts, isLoading, addAccount, updateAccount, deleteAccount, clearAllAccounts } = useAccounts(deviceId);
  const { processingState, analyzeImages } = useImageAnalyzer(addAccount);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Scan className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Trích xuất Tài khoản</h1>
                <p className="text-sm text-muted-foreground">
                  Tải ảnh lên để AI trích xuất họ tên và số tài khoản
                </p>
              </div>
            </div>
            <ExportButtons accounts={accounts} onClearAll={clearAllAccounts} />
          </div>
        </div>
      </header>

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

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Danh sách tài khoản ({accounts.length})</span>
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
