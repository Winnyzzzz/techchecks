import { useMemo, useState } from 'react';
import { FolderPlus, Folder, FolderOpen, Trash2, X } from 'lucide-react';
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
import { useActiveFolder } from '@/hooks/useActiveFolder';
import { ExtractedAccount } from '@/types/account';
import { toast } from 'sonner';

interface FolderManagerProps {
  accounts: ExtractedAccount[];
  scope?: string;
}

const NONE_VALUE = '__none__';

export function FolderManager({ accounts, scope = '' }: FolderManagerProps) {
  const { activeFolder, setActiveFolder, folders, addFolder, removeFolder } = useActiveFolder(scope);
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState('');

  // Combine known folders with any folders that exist in saved accounts (in case user shared/imported)
  const allFolders = useMemo(() => {
    const set = new Set<string>(folders);
    accounts.forEach(a => {
      if (a.folder && a.folder.trim()) set.add(a.folder.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [folders, accounts]);

  const folderCounts = useMemo(() => {
    const m = new Map<string, number>();
    accounts.forEach(a => {
      const k = a.folder?.trim() || '';
      m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  }, [accounts]);

  const handleCreate = () => {
    const name = draftName.trim();
    if (!name) {
      toast.error('Tên thư mục không được để trống');
      return;
    }
    if (allFolders.some(f => f.toLowerCase() === name.toLowerCase())) {
      toast.error('Thư mục này đã tồn tại');
      return;
    }
    addFolder(name);
    setActiveFolder(name);
    setDraftName('');
    toast.success(`Đã tạo và chọn thư mục "${name}"`);
  };

  const handleDelete = (name: string) => {
    const count = folderCounts.get(name) || 0;
    if (count > 0) {
      toast.error(`Không thể xóa: thư mục "${name}" đang chứa ${count} tài khoản. Hãy xóa hoặc chuyển dữ liệu trước.`);
      return;
    }
    removeFolder(name);
    toast.success(`Đã xóa thư mục "${name}"`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2">
        {activeFolder ? (
          <FolderOpen className="w-4 h-4 text-primary" />
        ) : (
          <Folder className="w-4 h-4 text-muted-foreground" />
        )}
        <Label className="text-sm font-medium">Thư mục đang dùng:</Label>
      </div>

      <Select
        value={activeFolder || NONE_VALUE}
        onValueChange={(v) => setActiveFolder(v === NONE_VALUE ? '' : v)}
      >
        <SelectTrigger className="w-56 h-9" data-testid="select-active-folder">
          <SelectValue placeholder="Chưa chọn thư mục" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>
            (Chưa phân loại) {folderCounts.get('') ? `· ${folderCounts.get('')}` : ''}
          </SelectItem>
          {allFolders.map(name => (
            <SelectItem key={name} value={name}>
              {name} {folderCounts.get(name) ? `· ${folderCounts.get(name)}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" data-testid="button-manage-folders">
            <FolderPlus className="w-4 h-4 mr-2" />
            Quản lý thư mục
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quản lý thư mục</DialogTitle>
            <DialogDescription>
              Tạo thư mục theo tên người gửi ảnh. Khi đang chọn 1 thư mục, mọi ảnh quét, nhập thủ công hoặc nhập Excel mới sẽ được gắn vào thư mục đó.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-folder">Tạo thư mục mới</Label>
              <div className="flex gap-2">
                <Input
                  id="new-folder"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="VD: Anh Tuấn, Chị Lan, Khách lạ..."
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                  data-testid="input-new-folder"
                />
                <Button onClick={handleCreate} data-testid="button-create-folder">
                  Tạo
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Danh sách thư mục</Label>
              {allFolders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center border rounded">
                  Chưa có thư mục nào
                </p>
              ) : (
                <ul className="border rounded divide-y max-h-64 overflow-auto">
                  {allFolders.map(name => {
                    const count = folderCounts.get(name) || 0;
                    return (
                      <li key={name} className="flex items-center justify-between gap-2 px-3 py-2">
                        <button
                          onClick={() => { setActiveFolder(name); toast.success(`Đã chọn "${name}"`); }}
                          className={`flex-1 text-left text-sm truncate ${activeFolder === name ? 'font-semibold text-primary' : ''}`}
                          data-testid={`button-pick-folder-${name}`}
                        >
                          {activeFolder === name && '• '}{name}
                          <span className="ml-2 text-xs text-muted-foreground">({count})</span>
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(name)}
                          title={count > 0 ? `Đang chứa ${count} tài khoản` : 'Xóa thư mục'}
                          data-testid={`button-delete-folder-${name}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeFolder && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { setActiveFolder(''); toast.info('Đã bỏ chọn thư mục. Dữ liệu mới sẽ thuộc "Chưa phân loại".'); }}
          data-testid="button-clear-active-folder"
        >
          <X className="w-4 h-4 mr-1" />
          Bỏ chọn
        </Button>
      )}
    </div>
  );
}
