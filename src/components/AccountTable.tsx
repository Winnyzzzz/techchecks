import { useState, useEffect } from 'react';
import { Pencil, Trash2, Check, X, Search, BadgeCheck, Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getImage } from '@/lib/imageStorage';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ExtractedAccount } from '@/types/account';
import { toast } from 'sonner';

interface AccountTableProps {
  accounts: ExtractedAccount[];
  onUpdate: (id: string, fullName: string, accountNumber: string, referralCode: string, senderName: string) => void;
  onDelete: (id: string) => void;
}

export function AccountTable({ accounts, onUpdate, onDelete }: AccountTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [editAccount, setEditAccount] = useState('');
  const [editReferral, setEditReferral] = useState('');
  const [editSender, setEditSender] = useState('');
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [swappedIds, setSwappedIds] = useState<string[]>([]);
  const [previewAccount, setPreviewAccount] = useState<ExtractedAccount | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!previewAccount) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    let revoked = false;
    setPreviewLoading(true);
    getImage(previewAccount.id).then(blob => {
      if (revoked) return;
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
      setPreviewLoading(false);
    });
    return () => { revoked = true; };
  }, [previewAccount]);

  // Compute duplicate keys for highlighting (in case API returned dups)
  const dupCount = new Map<string, number>();
  accounts.forEach(a => {
    const k = `${a.full_name.trim().toLowerCase().replace(/\s+/g, ' ')}|${a.account_number.replace(/\s/g, '')}`;
    dupCount.set(k, (dupCount.get(k) || 0) + 1);
  });
  const isDuplicate = (a: ExtractedAccount) => {
    const k = `${a.full_name.trim().toLowerCase().replace(/\s+/g, ' ')}|${a.account_number.replace(/\s/g, '')}`;
    return (dupCount.get(k) || 0) > 1;
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('vi-VN', { hour12: false });
    } catch {
      return iso;
    }
  };

  const filteredAccounts = accounts.filter(account =>
    account.account_number.includes(searchTerm) ||
    account.referral_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.sender_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startEditing = (account: ExtractedAccount) => {
    setEditingId(account.id);
    setEditAccount(account.account_number);
    setEditReferral(account.referral_code);
    setEditSender(account.sender_name);
  };

  const saveEdit = () => {
    if (editingId && editAccount.trim()) {
      const account = accounts.find(a => a.id === editingId);
      onUpdate(editingId, account?.full_name || '', editAccount.trim(), editReferral.trim(), editSender.trim());
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge variant="default">Đã xác nhận</Badge>;
      case 'error':
        return <Badge variant="destructive">Lỗi</Badge>;
      default:
        return <Badge variant="secondary">Chờ xử lý</Badge>;
    }
  };

  const handleDragStart = (e: React.DragEvent, account: ExtractedAccount) => {
    setDragSourceId(account.id);
    e.dataTransfer.setData('text/plain', account.sender_name || '');
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent, accountId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropTargetId(accountId);
  };

  const handleDragLeave = () => {
    setDropTargetId(null);
  };

  const handleDrop = (e: React.DragEvent, targetAccount: ExtractedAccount) => {
    e.preventDefault();
    if (dragSourceId && dragSourceId !== targetAccount.id) {
      const sourceAccount = accounts.find(a => a.id === dragSourceId);
      if (sourceAccount) {
        const sourceName = sourceAccount.sender_name;
        const targetName = targetAccount.sender_name;
        onUpdate(targetAccount.id, targetAccount.full_name, targetAccount.account_number, targetAccount.referral_code, sourceName);
        onUpdate(dragSourceId, sourceAccount.full_name, sourceAccount.account_number, sourceAccount.referral_code, targetName);
        setSwappedIds([targetAccount.id, dragSourceId]);
        setTimeout(() => setSwappedIds([]), 1000);
        toast.success(`Đã hoán đổi họ tên "${sourceName}" và "${targetName}"`);
      }
    }
    setDragSourceId(null);
    setDropTargetId(null);
  };

  const handleDragEnd = () => {
    setDragSourceId(null);
    setDropTargetId(null);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Tìm kiếm theo tên, số tài khoản, mã giới thiệu hoặc họ tên..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">STT</TableHead>
              <TableHead>Số tài khoản</TableHead>
              <TableHead>Mã giới thiệu</TableHead>
              <TableHead>Họ và tên (Nội dung)</TableHead>
              <TableHead className="w-40">Thời gian quét</TableHead>
              <TableHead className="w-32">Trạng thái</TableHead>
              <TableHead className="w-32 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {searchTerm ? 'Không tìm thấy kết quả' : 'Chưa có dữ liệu. Tải ảnh lên để bắt đầu.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredAccounts.map((account, index) => (
                <TableRow
                  key={account.id}
                  className={isDuplicate(account) ? 'bg-amber-50 dark:bg-amber-950/20' : undefined}
                >
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell className="font-mono">
                    {editingId === account.id ? (
                      <Input value={editAccount} onChange={(e) => setEditAccount(e.target.value)} className="h-8" />
                    ) : (
                      account.account_number
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {editingId === account.id ? (
                      <Input value={editReferral} onChange={(e) => setEditReferral(e.target.value)} className="h-8" />
                    ) : account.referral_code ? (
                      <span className="inline-flex items-center gap-1">
                        {account.referral_code}
                        {account.referral_code.trim().toUpperCase() === 'PAPER202214' && (
                          <BadgeCheck className="w-4 h-4 text-primary" aria-label="Mã chính xác" />
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === account.id ? (
                      <Input value={editSender} onChange={(e) => setEditSender(e.target.value)} className="h-8" />
                    ) : (
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, account)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, account.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, account)}
                        className={`cursor-grab active:cursor-grabbing px-2 py-1 rounded transition-all duration-300 select-none ${
                          dropTargetId === account.id && dragSourceId !== account.id
                            ? 'bg-primary/20 ring-2 ring-primary/40 scale-105'
                            : 'hover:bg-muted'
                        } ${dragSourceId === account.id ? 'opacity-50 scale-95' : ''} ${
                          swappedIds.includes(account.id)
                            ? 'bg-primary/15 text-primary font-semibold animate-scale-in ring-1 ring-primary/30'
                            : ''
                        }`}
                        title="Kéo để copy họ tên sang hàng khác"
                      >
                        {account.sender_name || '—'}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {account.created_at ? formatTime(account.created_at) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {getStatusBadge(account.status)}
                      {isDuplicate(account) && (
                        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 text-[10px]">
                          Trùng
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === account.id ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={saveEdit}>
                          <Check className="w-4 h-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelEdit}>
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setPreviewAccount(account)}
                          title="Xem ảnh đã quét"
                          data-testid={`button-view-image-${account.id}`}
                        >
                          <ImageIcon className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => startEditing(account)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => onDelete(account.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!previewAccount} onOpenChange={(o) => !o && setPreviewAccount(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">
              {previewAccount?.full_name} — {previewAccount?.account_number}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-2 overflow-auto max-h-[70vh] flex items-center justify-center min-h-[200px]">
            {previewLoading ? (
              <p className="text-sm text-muted-foreground">Đang tải ảnh...</p>
            ) : previewUrl ? (
              <img src={previewUrl} alt="Ảnh đã quét" className="w-full h-auto object-contain" />
            ) : (
              <p className="text-sm text-muted-foreground">
                Không có ảnh đã lưu cho dòng này (có thể được nhập thủ công, từ Excel, hoặc dữ liệu chia sẻ).
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
