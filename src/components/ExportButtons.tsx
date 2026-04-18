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
  const exportToExcel = async () => {
    if (accounts.length === 0) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }

    try {
      const data = [
        ['STT', 'Họ và Tên người nhận', 'Số tài khoản/Alias người nhận', 'Mã giới thiệu'],
        ...accounts.map((account, index) => [
          index + 1,
          account.sender_name || account.full_name,
          account.account_number,
          account.referral_code || '',
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 25 }, { wch: 20 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Danh sách');

      XLSX.writeFile(wb, `danh_sach_tai_khoan_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Đã xuất file Excel thành công');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error('Không thể xuất file Excel');
    }
  };

  const copyToClipboard = async () => {
    if (accounts.length === 0) {
      toast.error('Không có dữ liệu để sao chép');
      return;
    }

    const text = accounts
      .map((account, index) => `${index + 1}. ${account.sender_name || account.full_name} - ${account.account_number} - ${account.referral_code || ''}`)
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
