import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExtractedAccount, AIExtractionResult } from '@/types/account';
import { toast } from 'sonner';

interface AddAccountButtonProps {
  existingAccounts: ExtractedAccount[];
  onAdd: (result: AIExtractionResult) => Promise<unknown>;
}

const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const normalizeAccount = (s: string) => s.replace(/\s/g, '');

export function AddAccountButton({ existingAccounts, onAdd }: AddAccountButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [senderName, setSenderName] = useState('');

  const reset = () => {
    setFullName('');
    setAccountNumber('');
    setReferralCode('');
    setSenderName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = fullName.trim();
    const account = normalizeAccount(accountNumber);

    if (!name) {
      toast.error('Vui lòng nhập họ và tên');
      return;
    }
    if (!account) {
      toast.error('Vui lòng nhập số tài khoản');
      return;
    }

    const dup = existingAccounts.find(
      a =>
        normalizeName(a.full_name) === normalizeName(name) &&
        normalizeAccount(a.account_number) === account
    );
    if (dup) {
      toast.warning('Tài khoản này đã có trong danh sách', {
        description: `${dup.full_name} - ${dup.account_number}`,
      });
      return;
    }

    setSubmitting(true);
    const ok = await onAdd({
      fullName: name,
      accountNumber: account,
      referralCode: referralCode.trim(),
      senderName: senderName.trim() || name,
    });
    setSubmitting(false);

    if (ok) {
      toast.success('Đã thêm tài khoản');
      reset();
      setOpen(false);
    } else {
      toast.error('Không thể thêm tài khoản');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-add-manual">
          <Plus className="w-4 h-4 mr-2" />
          Thêm thủ công
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm tài khoản thủ công</DialogTitle>
          <DialogDescription>
            Nhập thông tin tài khoản. Họ tên và số tài khoản là bắt buộc.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual-fullname">
              Họ và tên <span className="text-destructive">*</span>
            </Label>
            <Input
              id="manual-fullname"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              autoFocus
              data-testid="input-manual-fullname"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-account">
              Số tài khoản <span className="text-destructive">*</span>
            </Label>
            <Input
              id="manual-account"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="0123456789"
              inputMode="numeric"
              data-testid="input-manual-account"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-referral">Mã giới thiệu</Label>
            <Input
              id="manual-referral"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              placeholder="Tùy chọn"
              data-testid="input-manual-referral"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-sender">Tên người gửi</Label>
            <Input
              id="manual-sender"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Tùy chọn (mặc định = Họ tên)"
              data-testid="input-manual-sender"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
              data-testid="button-manual-cancel"
            >
              Hủy
            </Button>
            <Button type="submit" disabled={submitting} data-testid="button-manual-submit">
              {submitting ? 'Đang lưu...' : 'Thêm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
