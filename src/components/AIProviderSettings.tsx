import { useEffect, useState } from 'react';
import {
  Bot,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
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
import { useAIProviders, ProviderConfig, ProviderId } from '@/hooks/useAIProviders';
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

export function AIProviderSettings() {
  const [open, setOpen] = useState(false);
  const [defs, setDefs] = useState<ProviderDef[]>([]);
  const [defsLoading, setDefsLoading] = useState(false);
  const { providers, addProvider, updateProvider, removeProvider, moveProvider } =
    useAIProviders();
  const [shownKey, setShownKey] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, TestState>>({});
  const [testMsg, setTestMsg] = useState<Record<string, string>>({});

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-open-ai-providers">
          <Bot className="w-4 h-4 mr-2" />
          AI Providers
          <Badge variant="secondary" className="ml-2" data-testid="badge-providers-count">
            {enabledCount}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cài đặt nhà cung cấp AI</DialogTitle>
          <DialogDescription>
            Thêm nhiều API key để gộp quota miễn phí và <strong>tự động chuyển</strong> sang
            provider tiếp theo khi cái đầu hết quota. Key được lưu trên trình duyệt của bạn,
            không gửi lên máy chủ ngoài lúc gọi AI.
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
                  <div className="text-xs text-muted-foreground">{def.description}</div>
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
              Thứ tự ưu tiên: từ trên xuống
            </span>
          </div>

          {providers.length === 0 ? (
            <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
              Chưa có nhà cung cấp nào.
              <br />
              Nếu bỏ trống, hệ thống sẽ dùng Gemini mặc định (có thể bị giới hạn).
            </div>
          ) : (
            <div className="space-y-2">
              {providers.map((p, idx) => {
                const def = defs.find((d) => d.id === p.providerId);
                const tStatus: TestState = testing[p.id] || 'idle';
                const dim = !p.enabled || !p.apiKey.trim();
                return (
                  <div
                    key={p.id}
                    className={`border rounded-lg p-3 space-y-2 ${dim ? 'opacity-60' : ''}`}
                    data-testid={`card-provider-${p.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          disabled={idx === 0}
                          onClick={() => moveProvider(p.id, -1)}
                          data-testid={`button-up-${p.id}`}
                          aria-label="Lên"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          disabled={idx === providers.length - 1}
                          onClick={() => moveProvider(p.id, 1)}
                          data-testid={`button-down-${p.id}`}
                          aria-label="Xuống"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {idx + 1}
                      </Badge>
                      <div className="flex-1 font-medium text-sm" data-testid={`text-provider-label-${p.id}`}>
                        {def?.label || p.providerId}
                      </div>
                      <Switch
                        checked={p.enabled}
                        onCheckedChange={(v) => updateProvider(p.id, { enabled: v })}
                        data-testid={`switch-enabled-${p.id}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          removeProvider(p.id);
                          toast.success('Đã xoá nhà cung cấp');
                        }}
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
                            type={shownKey[p.id] ? 'text' : 'password'}
                            value={p.apiKey}
                            onChange={(e) => updateProvider(p.id, { apiKey: e.target.value })}
                            placeholder="Dán API key ở đây..."
                            className="font-mono text-xs"
                            autoComplete="off"
                            data-testid={`input-key-${p.id}`}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setShownKey((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                            }
                            data-testid={`button-toggle-key-${p.id}`}
                            aria-label="Hiện/ẩn key"
                          >
                            {shownKey[p.id] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Model</Label>
                        <Select
                          value={p.model}
                          onValueChange={(v) => updateProvider(p.id, { model: v })}
                        >
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
                        onChange={(e) => updateProvider(p.id, { label: e.target.value })}
                        placeholder="Nhãn tuỳ ý (VD: 'Tài khoản A')"
                        className="text-xs h-8 max-w-[220px]"
                        data-testid={`input-label-${p.id}`}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTest(p)}
                        disabled={tStatus === 'pending'}
                        data-testid={`button-test-${p.id}`}
                      >
                        {tStatus === 'pending' && (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        )}
                        {tStatus === 'ok' && (
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" />
                        )}
                        {tStatus === 'fail' && (
                          <XCircle className="w-3.5 h-3.5 mr-1 text-destructive" />
                        )}
                        Kiểm tra
                      </Button>
                      {testMsg[p.id] && (
                        <span
                          className={`text-xs break-all ${
                            tStatus === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-destructive'
                          }`}
                          data-testid={`text-test-msg-${p.id}`}
                        >
                          {testMsg[p.id]}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => setOpen(false)} data-testid="button-close-ai-providers">
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
