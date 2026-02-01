import { useState } from 'react';
import { AlertTriangle, X, Eye } from 'lucide-react';
import { FailedImage } from '@/hooks/useImageAnalyzer';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FailedImagesListProps {
  failedImages: FailedImage[];
  onRemove: (index: number) => void;
  onClearAll: () => void;
}

export function FailedImagesList({ failedImages, onRemove, onClearAll }: FailedImagesListProps) {
  const [previewImage, setPreviewImage] = useState<FailedImage | null>(null);

  if (failedImages.length === 0) return null;

  return (
    <>
      <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">
              {failedImages.length} ảnh không thể phân tích
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-muted-foreground hover:text-foreground"
          >
            Xóa tất cả
          </Button>
        </div>
        
        <div className="space-y-2">
          {failedImages.map((image, index) => (
            <div
              key={index}
              className="flex items-center gap-3 bg-background/50 rounded-md p-2"
            >
              <button
                onClick={() => setPreviewImage(image)}
                className="w-12 h-12 flex-shrink-0 rounded overflow-hidden hover:ring-2 ring-primary transition-all cursor-pointer"
              >
                <img
                  src={image.previewUrl}
                  alt={image.fileName}
                  className="w-full h-full object-cover"
                />
              </button>
              
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => setPreviewImage(image)}
                  className="text-sm font-medium text-foreground hover:text-primary truncate block w-full text-left"
                  title={image.fileName}
                >
                  {image.fileName}
                </button>
                <p className="text-xs text-muted-foreground truncate" title={image.error}>
                  {image.error}
                </p>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewImage(image)}
                  className="h-8 w-8"
                  title="Xem ảnh"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(index)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  title="Xóa"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="truncate pr-8" title={previewImage?.fileName}>
              {previewImage?.fileName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="bg-muted/50 rounded-lg p-2 overflow-auto max-h-[60vh]">
              <img
                src={previewImage?.previewUrl}
                alt={previewImage?.fileName}
                className="w-full h-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{previewImage?.error}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
