import { useState } from 'react';
import { Pencil, Trash2, Check, X, Search, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

interface AccountTableProps {
  accounts: ExtractedAccount[];
  onUpdate: (id: string, fullName: string, accountNumber: string, referralCode: string, senderName: string) => void;
  onDelete: (id: string) => void;
  onReorder?: (accounts: ExtractedAccount[]) => void;
}

function SortableRow({
  account,
  index,
  editingId,
  editName,
  editAccount,
  editReferral,
  editSender,
  setEditName,
  setEditAccount,
  setEditReferral,
  setEditSender,
  startEditing,
  saveEdit,
  cancelEdit,
  onDelete,
  getStatusBadge,
}: {
  account: ExtractedAccount;
  index: number;
  editingId: string | null;
  editName: string;
  editAccount: string;
  editReferral: string;
  editSender: string;
  setEditName: (v: string) => void;
  setEditAccount: (v: string) => void;
  setEditReferral: (v: string) => void;
  setEditSender: (v: string) => void;
  startEditing: (account: ExtractedAccount) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  onDelete: (id: string) => void;
  getStatusBadge: (status: string) => JSX.Element;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: account.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'bg-muted' : ''}>
      <TableCell className="w-10 px-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </TableCell>
      <TableCell className="font-medium">{index + 1}</TableCell>
      <TableCell>
        {editingId === account.id ? (
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
        ) : (
          account.full_name
        )}
      </TableCell>
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
        ) : (
          account.referral_code || '—'
        )}
      </TableCell>
      <TableCell>
        {editingId === account.id ? (
          <Input value={editSender} onChange={(e) => setEditSender(e.target.value)} className="h-8" />
        ) : (
          account.sender_name || '—'
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
  );
}

export function AccountTable({ accounts, onUpdate, onDelete, onReorder }: AccountTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAccount, setEditAccount] = useState('');
  const [editReferral, setEditReferral] = useState('');
  const [editSender, setEditSender] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filteredAccounts = accounts.filter(account =>
    account.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.account_number.includes(searchTerm) ||
    account.referral_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.sender_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isSearching = searchTerm.length > 0;

  const startEditing = (account: ExtractedAccount) => {
    setEditingId(account.id);
    setEditName(account.full_name);
    setEditAccount(account.account_number);
    setEditReferral(account.referral_code);
    setEditSender(account.sender_name);
  };

  const saveEdit = () => {
    if (editingId && editName.trim() && editAccount.trim()) {
      onUpdate(editingId, editName.trim(), editAccount.trim(), editReferral.trim(), editSender.trim());
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditAccount('');
    setEditReferral('');
    setEditSender('');
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = accounts.findIndex(a => a.id === active.id);
    const newIndex = accounts.findIndex(a => a.id === over.id);
    const reordered = arrayMove(accounts, oldIndex, newIndex);
    onReorder?.(reordered);
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-12">STT</TableHead>
                <TableHead>Tên đăng nhập</TableHead>
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
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {searchTerm ? 'Không tìm thấy kết quả' : 'Chưa có dữ liệu. Tải ảnh lên để bắt đầu.'}
                  </TableCell>
                </TableRow>
              ) : (
                <SortableContext items={filteredAccounts.map(a => a.id)} strategy={verticalListSortingStrategy} disabled={isSearching}>
                  {filteredAccounts.map((account, index) => (
                    <SortableRow
                      key={account.id}
                      account={account}
                      index={index}
                      editingId={editingId}
                      editName={editName}
                      editAccount={editAccount}
                      editReferral={editReferral}
                      editSender={editSender}
                      setEditName={setEditName}
                      setEditAccount={setEditAccount}
                      setEditReferral={setEditReferral}
                      setEditSender={setEditSender}
                      startEditing={startEditing}
                      saveEdit={saveEdit}
                      cancelEdit={cancelEdit}
                      onDelete={onDelete}
                      getStatusBadge={getStatusBadge}
                    />
                  ))}
                </SortableContext>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>
    </div>
  );
}
