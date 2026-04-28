import { useEffect, useState } from 'react';
import {
  Bot,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useAIProviders,
  ProviderConfig,
  ProviderId,
} from '@/hooks/useAIProviders';
import { toast } from 'sonner';

interface ProviderDef {
  id: string;
  label: string;
  description: string;
  signupUrl: string;
  models: string[];
  defaultModel: string;
}

type TestState = 'idle' | 'pending' | 'ok' | 'fail';

interface SortableRowProps {
  p: ProviderConfig;
  idx: number;
  def?: ProviderDef;
  shownKey: boolean;
  toggleShownKey: () => void;
  testState: TestState;
  testMsg?: string;
  onUpdate: (patch: Partial<Omit<ProviderConfig, 'id'>>) => void;
  onRemove: () => void;
  onTest: () => void;
}

function SortableRow({
  p,
  idx,
  def,
  shownKey,
  toggleShownKey,
  testState,
  testMsg,
  onUpdate,
  onRemove,
  onTest,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: p.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const dim = !p.enabled || !p.apiKey.trim();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg p-3 space-y-2 bg-card ${
        dim ? 'opacity-60' : ''
      } ${isDragging ? 'ring-2 ring-primary shadow-lg z-10 relative' : ''}`}
      data-testid={`card-provider-${p.id}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 -ml-1 touch-none"
          aria-label="Kéo để sắp xếp"
          data-testid={`drag-handle-${p.id}`}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <Badge variant="outline" className="text-xs">
          {idx + 1}
        </Badge>
        <div
          className="flex-1 font-medium text-sm"
          data-testid={`text-provider-label-${p.id}`}
        >
          {def?.label || p.providerId}
        </div>
        <Switch
          checked={p.enabled}
          onCheckedChange={(v) => onUpdate({ enabled: v })}
          data-testid={`switch-enabled-${p.id}`}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={onRemove}
          data-testid={`button-remove-${p.id}`}
          aria-label="Xoá"
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">API Key</Label>
          <div className="flex gap-1">
            <Input
              type={shownKey ? 'text' : 'password'}
              value={p.apiKey}
              onChange={(e) => onUpdate({ apiKey: e.target.value })}
              placeholder="Dán API key ở đây..."
              className="font-mono text-xs"
              autoComplete="off"
              data-testid={`input-key-${p.id}`}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleShownKey}
              data-testid={`button-toggle-key-${p.id}`}
              aria-label="Hiện/ẩn key"
            >
              {shownKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Model</Label>
          <Select value={p.model} onValueChange={(v) => onUpdate({ model: v })}>
            <SelectTrigger data-testid={`select-model-${p.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(def?.models || [p.model]).map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={p.label || ''}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Nhãn tuỳ ý (VD: 'Tài khoản A')"
          className="text-xs h-8 max-w-[220px]"
          data-testid={`input-label-${p.id}`}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={onTest}
          disabled={testState === 'pending'}
          data-testid={`button-test-${p.id}`}
        >
          {testState === 'pending' && (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          )}
          {testState === 'ok' && (
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" />
          )}
          {testState === 'fail' && (
            <XCircle className="w-3.5 h-3.5 mr-1 text-destructive" />
          )}
          Kiểm tra
        </Button>
        {testMsg && (
          <span
            className={`text-xs break-all ${
              testState === 'ok'
                ? 'text-green-700 dark:text-green-400'
                : 'text-destructive'
            }`}
            data-testid={`text-test-msg-${p.id}`}
          >
            {testMsg}
          </span>
        )}
      </div>
    </div>
  );
}

export function AIProviderSettings() {
  const [open, setOpen] = useState(false);
  const [defs, setDefs] = useState<ProviderDef[]>([]);
  const [defsLoading, setDefsLoading] = useState(false);
  const {
    providers,
    addProvider,
    updateProvider,
    removeProvider,
    reorderProviders,
  } = useAIProviders();
  const [shownKey, setShownKey] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, TestState>>({});
  const [testMsg, setTestMsg] = useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!open || defs.length > 0) return;
    setDefsLoading(true);
    fetch('/api/providers')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDefs(data);
      })
      .catch(() => {
        toast.error('Không tải được danh sách nhà cung cấp');
      })
      .finally(() => setDefsLoading(false));
  }, [open, defs.length]);

  const enabledCount = providers.filter((p) => p.enabled && p.apiKey.trim()).length;

  const handleAdd = (providerId: string) => {
    const def = defs.find((d) => d.id === providerId);
    if (!def) return;
    addProvider({
      providerId: providerId as ProviderId,
      apiKey: '',
      model: def.defaultModel,
      enabled: true,
      label: '',
    });
  };

  const handleTest = async (p: ProviderConfig) => {
    if (!p.apiKey.trim()) {
      toast.error('Hãy nhập API key trước khi kiểm tra');
      return;
    }
    setTesting((prev) => ({ ...prev, [p.id]: 'pending' }));
    setTestMsg((prev) => ({ ...prev, [p.id]: '' }));
    try {
      const res = await fetch('/api/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: p.providerId,
          apiKey: p.apiKey,
          model: p.model,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTesting((prev) => ({ ...prev, [p.id]: 'ok' }));
        setTestMsg((prev) => ({ ...prev, [p.id]: 'Hoạt động tốt!' }));
      } else {
        setTesting((prev) => ({ ...prev, [p.id]: 'fail' }));
        setTestMsg((prev) => ({
          ...prev,
          [p.id]: `${data.code || 'Lỗi'}: ${(data.error || '').slice(0, 200)}`,
        }));
      }
    } catch (err: any) {
      setTesting((prev) => ({ ...prev, [p.id]: 'fail' }));
      setTestMsg((prev) => ({ ...prev, [p.id]: String(err?.message || err) }));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = providers.findIndex((p) => p.id === active.id);
    const newIndex = providers.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderProviders(arrayMove(providers, oldIndex, newIndex));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid="button-open-ai-providers"
        >
          <Bot className="w-4 h-4 mr-2" />
          AI Providers
          <Badge
            variant="secondary"
            className="ml-2"
            data-testid="badge-providers-count"
          >
            {enabledCount}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cài đặt nhà cung cấp AI</DialogTitle>
          <DialogDescription>
            Thêm nhiều API key để gộp quota miễn phí và{' '}
            <strong>tự động chuyển</strong> sang provider tiếp theo khi cái đầu hết
            quota. Key được lưu trên trình duyệt của bạn, không gửi lên máy chủ
            ngoài lúc gọi AI.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mb-4">
          <Label className="text-sm font-medium">Thêm nhà cung cấp</Label>
          {defsLoading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {defs.map((def) => (
                <div
                  key={def.id}
                  className="border rounded-lg p-3 flex flex-col gap-2 bg-muted/30"
                  data-testid={`card-provider-def-${def.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm">{def.label}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAdd(def.id)}
                      data-testid={`button-add-${def.id}`}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Thêm
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {def.description}
                  </div>
                  <a
                    href={def.signupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 w-fit"
                    data-testid={`link-signup-${def.id}`}
                  >
                    Lấy API key miễn phí <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Đã cấu hình ({providers.length})
            </Label>
            <span className="text-xs text-muted-foreground">
              Kéo <GripVertical className="inline w-3 h-3" /> để sắp xếp ưu tiên
            </span>
          </div>

          {providers.length === 0 ? (
            <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
              Chưa có nhà cung cấp nào.
              <br />
              Nếu bỏ trống, hệ thống sẽ dùng Gemini mặc định (có thể bị giới hạn).
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={providers.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {providers.map((p, idx) => {
                    const def = defs.find((d) => d.id === p.providerId);
                    return (
                      <SortableRow
                        key={p.id}
                        p={p}
                        idx={idx}
                        def={def}
                        shownKey={!!shownKey[p.id]}
                        toggleShownKey={() =>
                          setShownKey((prev) => ({
                            ...prev,
                            [p.id]: !prev[p.id],
                          }))
                        }
                        testState={testing[p.id] || 'idle'}
                        testMsg={testMsg[p.id]}
                        onUpdate={(patch) => updateProvider(p.id, patch)}
                        onRemove={() => {
                          removeProvider(p.id);
                          toast.success('Đã xoá nhà cung cấp');
                        }}
                        onTest={() => handleTest(p)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => setOpen(false)}
            data-testid="button-close-ai-providers"
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
