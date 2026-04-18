import { useState, useRef } from 'react';
import { Pencil, Trash2, Check, X, Search, BadgeCheck } from 'lucide-react';
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
              <TableHead className="w-32">Trạng thái</TableHead>
              <TableHead className="w-24 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {searchTerm ? 'Không tìm thấy kết quả' : 'Chưa có dữ liệu. Tải ảnh lên để bắt đầu.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredAccounts.map((account, index) => (
                <TableRow key={account.id}>
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
                  <TableCell>{getStatusBadge(account.status)}</TableCell>
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
    </div>
  );
}
