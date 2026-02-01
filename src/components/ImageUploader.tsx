import { useCallback, useState } from 'react';
import { Upload, Image as ImageIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ImageUploaderProps {
  onImagesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

export function ImageUploader({ onImagesSelected, isProcessing }: ImageUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [previewImages, setPreviewImages] = useState<{ file: File; url: string }[]>([]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    
    const validFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/') && 
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    );

    if (validFiles.length > 0) {
      const newPreviews = validFiles.map(file => ({
        file,
        url: URL.createObjectURL(file)
      }));
      setPreviewImages(prev => [...prev, ...newPreviews]);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    e.target.value = '';
  }, [processFiles]);

  const removeImage = useCallback((index: number) => {
    setPreviewImages(prev => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index].url);
      newPreviews.splice(index, 1);
      return newPreviews;
    });
  }, []);

  const handleStartProcessing = useCallback(() => {
    onImagesSelected(previewImages.map(p => p.file));
    previewImages.forEach(p => URL.revokeObjectURL(p.url));
    setPreviewImages([]);
  }, [previewImages, onImagesSelected]);

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          isProcessing && "opacity-50 pointer-events-none"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />
        <div className="flex flex-col items-center justify-center text-center">
          <Upload className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">
            Kéo thả ảnh vào đây
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            hoặc click để chọn file (JPG, PNG, WEBP)
          </p>
        </div>
      </div>

      {previewImages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {previewImages.length} ảnh đã chọn
            </p>
            <Button 
              onClick={handleStartProcessing}
              disabled={isProcessing}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              Bắt đầu phân tích
            </Button>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {previewImages.map((preview, index) => (
              <div key={index} className="relative group aspect-square">
                <img
                  src={preview.url}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
