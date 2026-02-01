import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ProcessingStatusProps {
  current: number;
  total: number;
  currentImageUrl?: string;
}

export function ProcessingStatus({ current, total, currentImageUrl }: ProcessingStatusProps) {
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
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="font-medium text-foreground">
              Đang phân tích ảnh {current}/{total}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">
            AI đang đọc và trích xuất thông tin từ ảnh...
          </p>
        </div>
      </div>
    </div>
  );
}
