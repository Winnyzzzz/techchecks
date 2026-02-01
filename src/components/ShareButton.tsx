import { Share2, Loader2, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { toast } from 'sonner';

interface ShareButtonProps {
  shareCode: string | null;
  isGenerating: boolean;
  onGenerateLink: () => Promise<string | null>;
}

export function ShareButton({ shareCode, isGenerating, onGenerateLink }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareCode ? `${window.location.origin}?code=${shareCode}` : '';

  const handleOpen = async (open: boolean) => {
    setIsOpen(open);
    if (open && !shareCode) {
      await onGenerateLink();
    }
  };

  const copyToClipboard = async () => {
    if (!shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Đã sao chép link');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Share2 className="w-4 h-4 mr-2" />
          Chia sẻ
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chia sẻ dữ liệu</DialogTitle>
          <DialogDescription>
            Sử dụng link này để truy cập dữ liệu từ trình duyệt hoặc thiết bị khác.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {isGenerating ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Đang tạo link...</span>
            </div>
          ) : shareCode ? (
            <>
              <div className="flex items-center gap-2">
                <Input 
                  value={shareUrl} 
                  readOnly 
                  className="flex-1 font-mono text-sm"
                />
                <Button size="icon" variant="outline" onClick={copyToClipboard}>
                  {copied ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <div className="text-center">
                <span className="text-xs text-muted-foreground">Mã truy cập: </span>
                <span className="font-mono font-bold text-lg tracking-widest">{shareCode}</span>
              </div>
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Không thể tạo link chia sẻ
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
