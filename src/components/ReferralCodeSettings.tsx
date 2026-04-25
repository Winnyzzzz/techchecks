import { useEffect, useState } from 'react';
import { Settings, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useReferralConfig } from '@/hooks/useReferralConfig';

export function ReferralCodeSettings() {
  const { referralCode, setReferralCode, resetReferralCode, defaultReferralCode } = useReferralConfig();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(referralCode);

  useEffect(() => {
    if (open) setDraft(referralCode);
  }, [open, referralCode]);

  const handleSave = () => {
    const cleaned = draft.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleaned) {
      toast.error('Mã giới thiệu không được để trống');
      return;
    }
    setReferralCode(cleaned);
    toast.success(`Đã đặt mã giới thiệu: ${cleaned}`);
    setOpen(false);
  };

  const handleReset = () => {
    resetReferralCode();
    setDraft(defaultReferralCode);
    toast.success(`Đã khôi phục mã mặc định: ${defaultReferralCode}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-open-referral-settings">
          <Settings className="w-4 h-4 mr-2" />
          Mã giới thiệu
          <span className="ml-2 font-mono text-xs text-muted-foreground hidden sm:inline">
            {referralCode}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cài đặt mã giới thiệu</DialogTitle>
          <DialogDescription>
            Đặt mã giới thiệu chuẩn dùng để kiểm tra. Các tài khoản có mã khác hoặc thiếu mã sẽ được cảnh báo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="referral-input">Mã giới thiệu chuẩn</Label>
            <Input
              id="referral-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="VD: PAPER202214"
              autoComplete="off"
              className="font-mono uppercase"
              data-testid="input-referral-code"
            />
            <p className="text-xs text-muted-foreground">
              Mã sẽ được lưu trên trình duyệt của bạn (không gửi lên máy chủ).
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            Mã hiện tại: <span className="font-mono font-medium text-foreground">{referralCode}</span>
            {referralCode !== defaultReferralCode && (
              <span className="ml-2">
                (mặc định: <span className="font-mono">{defaultReferralCode}</span>)
              </span>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={handleReset}
            data-testid="button-reset-referral"
            className="mr-auto"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Khôi phục mặc định
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-referral">
            Hủy
          </Button>
          <Button onClick={handleSave} data-testid="button-save-referral">
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
