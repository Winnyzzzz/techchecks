import { Loader2, Bot } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface ProviderUsedInfo {
  providerId: string;
  label: string;
  model: string;
  keyLabel?: string;
}

interface ProcessingStatusProps {
  current: number;
  total: number;
  currentImageUrl?: string;
  providerUsed?: ProviderUsedInfo;
}

export function ProcessingStatus({
  current,
  total,
  currentImageUrl,
  providerUsed,
}: ProcessingStatusProps) {
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center gap-4">
        {currentImageUrl && (
          <div className="w-20 h-20 flex-shrink-0">
            <img
              src={currentImageUrl}
              alt="Processing"
              className="w-full h-full object-cover rounded-lg"
            />
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="font-medium text-foreground">
              Đang phân tích ảnh {current}/{total}
            </span>
            {providerUsed && (
              <Badge
                variant="secondary"
                className="ml-auto inline-flex items-center gap-1"
                data-testid="badge-provider-used"
              >
                <Bot className="w-3 h-3" />
                {providerUsed.label}
                {providerUsed.keyLabel ? ` · ${providerUsed.keyLabel}` : ''}
              </Badge>
            )}
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">
            {providerUsed
              ? `${providerUsed.label} (${providerUsed.model}) đang đọc và trích xuất thông tin...`
              : 'AI đang đọc và trích xuất thông tin từ ảnh...'}
          </p>
        </div>
      </div>
    </div>
  );
}
