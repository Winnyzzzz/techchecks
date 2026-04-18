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
      // Fetch the template file
      const response = await fetch('/templates/ft_batch_xlsx_2025_VIE.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];

      // Fill in data starting from row 2 (row 1 is header)
      accounts.forEach((account, index) => {
        const row = index + 2; // Excel rows are 1-indexed, row 1 is header
        ws[`A${row}`] = { t: 's', v: account.sender_name || account.full_name }; // Họ và tên
        ws[`B${row}`] = { t: 's', v: account.account_number }; // Số tài khoản
        ws[`C${row}`] = { t: 's', v: account.referral_code || '' }; // Mã giới thiệu
      });

      // Update the range to include all data rows
      const lastRow = Math.max(accounts.length + 1, 201);
      ws['!ref'] = `A1:C${lastRow}`;

      XLSX.writeFile(wb, `ft_batch_xlsx_${new Date().toISOString().split('T')[0]}.xlsx`);
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
