import { useState } from 'react';
import { Layers, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DEFAULT_DATASET_NAME } from '@/hooks/useDatasets';
import { toast } from 'sonner';

interface DatasetSwitcherProps {
  datasets: string[];
  currentDataset: string;
  onChangeCurrent: (name: string) => void;
  onAdd: (name: string) => { ok: boolean; error?: string };
  onRename: (oldName: string, newName: string) => Promise<{ ok: boolean; error?: string; moved?: number }>;
  onRemove: (name: string) => { ok: boolean; error?: string };
}

export function DatasetSwitcher({
  datasets,
  currentDataset,
  onChangeCurrent,
  onAdd,
  onRename,
  onRemove,
}: DatasetSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const handleCreate = () => {
    const name = draftName.trim();
    const result = onAdd(name);
    if (!result.ok) {
      toast.error(result.error || 'Không thể tạo');
      return;
    }
    onChangeCurrent(name);
    setDraftName('');
    toast.success(`Đã tạo và chuyển sang "${name}"`);
  };

  const handleRename = async (oldName: string) => {
    const newName = (renameDrafts[oldName] || '').trim();
    if (!newName) {
      toast.error('Tên mới không được để trống');
      return;
    }
    if (newName === oldName) return;
    setBusy(oldName);
    const result = await onRename(oldName, newName);
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error || 'Không thể đổi tên');
      return;
    }
    setRenameDrafts(prev => {
      const next = { ...prev };
      delete next[oldName];
      return next;
    });
    toast.success(
      result.moved && result.moved > 0
        ? `Đã đổi "${oldName}" → "${newName}" (chuyển ${result.moved} tài khoản)`
        : `Đã đổi "${oldName}" → "${newName}"`,
    );
  };

  const handleRemove = (name: string) => {
    if (name === DEFAULT_DATASET_NAME) {
      toast.error('Không thể xoá tập "default"');
      return;
    }
    const ok = window.confirm(
      `Xoá tập "${name}" khỏi danh sách?\n\nLưu ý: thao tác này KHÔNG xoá dữ liệu trong PostgreSQL — nếu muốn xoá luôn dữ liệu, hãy chuyển sang tập đó và bấm "Xoá tất cả" trước.`,
    );
    if (!ok) return;
    const result = onRemove(name);
    if (!result.ok) {
      toast.error(result.error || 'Không thể xoá');
      return;
    }
    toast.success(`Đã gỡ "${name}" khỏi danh sách`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 border rounded-lg bg-primary/5">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-primary" />
        <Label className="text-sm font-medium">Tập dữ liệu:</Label>
      </div>

      <Select value={currentDataset} onValueChange={onChangeCurrent}>
        <SelectTrigger className="w-56 h-9" data-testid="select-current-dataset">
          <SelectValue placeholder="Chọn tập dữ liệu" />
        </SelectTrigger>
        <SelectContent>
          {datasets.map(name => (
            <SelectItem key={name} value={name} data-testid={`option-dataset-${name}`}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" data-testid="button-manage-datasets">
            <Plus className="w-4 h-4 mr-2" />
            Quản lý tập
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quản lý tập dữ liệu</DialogTitle>
            <DialogDescription>
              Mỗi tập là một danh sách tài khoản hoàn toàn riêng (có thư mục, dữ liệu quét và lịch sử riêng).
              Khi chọn 1 tập, mọi thao tác quét/thêm/xoá chỉ ảnh hưởng tới tập đó.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-dataset">Tạo tập mới</Label>
              <div className="flex gap-2">
                <Input
                  id="new-dataset"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="VD: Khách MB, Khách Vietcombank..."
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                  data-testid="input-new-dataset"
                />
                <Button onClick={handleCreate} data-testid="button-create-dataset">
                  Tạo
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Danh sách tập</Label>
              <ul className="border rounded divide-y max-h-72 overflow-auto">
                {datasets.map(name => {
                  const isCurrent = name === currentDataset;
                  const isDefault = name === DEFAULT_DATASET_NAME;
                  const draft = renameDrafts[name] ?? '';
                  return (
                    <li key={name} className="flex flex-col gap-2 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => onChangeCurrent(name)}
                          className={`flex-1 text-left text-sm truncate ${isCurrent ? 'font-semibold text-primary' : ''}`}
                          data-testid={`button-pick-dataset-${name}`}
                        >
                          {isCurrent && '• '}{name}
                          {isDefault && <span className="ml-2 text-xs text-muted-foreground">(mặc định)</span>}
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setRenameDrafts(prev => ({ ...prev, [name]: prev[name] ?? name }))}
                          disabled={isDefault}
                          title={isDefault ? 'Không thể đổi tên tập mặc định' : 'Đổi tên'}
                          data-testid={`button-edit-dataset-${name}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemove(name)}
                          disabled={isDefault}
                          title={isDefault ? 'Không thể xoá tập mặc định' : 'Gỡ khỏi danh sách'}
                          data-testid={`button-delete-dataset-${name}`}
                        >
                          <Trash2 className={`w-4 h-4 ${isDefault ? '' : 'text-destructive'}`} />
                        </Button>
                      </div>
                      {name in renameDrafts && (
                        <div className="flex gap-2">
                          <Input
                            value={draft}
                            onChange={(e) => setRenameDrafts(prev => ({ ...prev, [name]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(name); }}
                            placeholder="Tên mới"
                            data-testid={`input-rename-dataset-${name}`}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleRename(name)}
                            disabled={busy === name}
                            data-testid={`button-confirm-rename-${name}`}
                          >
                            {busy === name ? 'Đang lưu...' : 'Lưu'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRenameDrafts(prev => {
                              const next = { ...prev };
                              delete next[name];
                              return next;
                            })}
                          >
                            Huỷ
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
