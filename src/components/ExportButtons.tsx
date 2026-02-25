import { Download, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExtractedAccount } from '@/types/account';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ExportButtonsProps {
  accounts: ExtractedAccount[];
  onClearAll: () => void;
}

export function ExportButtons({ accounts, onClearAll }: ExportButtonsProps) {
  const exportToExcel = () => {
    if (accounts.length === 0) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }

    const data = accounts.map((account, index) => ({
      'STT': index + 1,
      'Tên đăng nhập': account.full_name,
      'Số tài khoản': account.account_number,
      'Mã giới thiệu': account.referral_code || '',
      'Họ và tên (Nội dung)': account.sender_name || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách');

    ws['!cols'] = [
      { wch: 5 },
      { wch: 30 },
      { wch: 25 },
      { wch: 20 },
      { wch: 30 },
    ];

    XLSX.writeFile(wb, `danh-sach-tai-khoan-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Đã xuất file Excel thành công');
  };

  const copyToClipboard = async () => {
    if (accounts.length === 0) {
      toast.error('Không có dữ liệu để sao chép');
      return;
    }

    const text = accounts
      .map((account, index) => `${index + 1}. ${account.full_name} - ${account.account_number} - ${account.referral_code || ''} - ${account.sender_name || ''}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Đã sao chép vào clipboard');
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={exportToExcel} disabled={accounts.length === 0}>
        <Download className="w-4 h-4 mr-2" />
        Xuất Excel
      </Button>
      <Button variant="outline" onClick={copyToClipboard} disabled={accounts.length === 0}>
        <Copy className="w-4 h-4 mr-2" />
        Sao chép
      </Button>
      <Button variant="destructive" onClick={onClearAll} disabled={accounts.length === 0}>
        <Trash2 className="w-4 h-4 mr-2" />
        Xóa tất cả
      </Button>
    </div>
  );
}
