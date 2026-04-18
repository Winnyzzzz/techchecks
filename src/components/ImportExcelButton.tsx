import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExtractedAccount, AIExtractionResult } from '@/types/account';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ImportExcelButtonProps {
  existingAccounts: ExtractedAccount[];
  onImport: (result: AIExtractionResult) => Promise<boolean>;
}

const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const normalizeAccount = (s: string) => String(s).replace(/\s/g, '');
const dupKey = (fullName: string, accountNumber: string) =>
  `${normalizeName(fullName)}|${normalizeAccount(accountNumber)}`;

const findValue = (row: Record<string, any>, candidates: string[]): string => {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const normalizedCand = cand.toLowerCase().replace(/\s+/g, '');
    const match = keys.find(
      k => k.toLowerCase().replace(/\s+/g, '') === normalizedCand
    );
    if (match && row[match] != null) return String(row[match]).trim();
  }
  return '';
};

export function ImportExcelButton({ existingAccounts, onImport }: ImportExcelButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) {
        toast.error('File Excel rỗng hoặc không hợp lệ');
        return;
      }

      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, {
        defval: '',
        raw: false,
      });

      if (rows.length === 0) {
        toast.error('Không có dữ liệu trong file');
        return;
      }

      const existingKeys = new Set(
        existingAccounts.map(a => dupKey(a.full_name, a.account_number))
      );

      let added = 0;
      let duplicates = 0;
      const invalidRows: { row: number; reason: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // +2: header is row 1, data starts row 2

        const fullName = findValue(row, [
          'Họ và tên', 'Họ tên', 'Họ và tên (Nội dung)', 'Tên', 'fullName', 'Full Name', 'Name'
        ]);
        const accountNumber = normalizeAccount(
          findValue(row, ['Số tài khoản', 'STK', 'Account Number', 'accountNumber'])
        );
        const referralCode = findValue(row, [
          'Mã giới thiệu', 'Mã GT', 'Referral Code', 'referralCode'
        ]);
        const senderName = findValue(row, [
          'Người gửi', 'Tên người gửi', 'Sender Name', 'senderName', 'Nội dung'
        ]);

        if (!fullName && !accountNumber) {
          invalidRows.push({ row: rowNum, reason: 'thiếu họ tên và STK' });
          continue;
        }
        if (!fullName) {
          invalidRows.push({ row: rowNum, reason: `thiếu họ tên (STK: ${accountNumber})` });
          continue;
        }
        if (!accountNumber) {
          invalidRows.push({ row: rowNum, reason: `thiếu STK (${fullName})` });
          continue;
        }

        const key = dupKey(fullName, accountNumber);
        if (existingKeys.has(key)) {
          duplicates++;
          continue;
        }

        const ok = await onImport({
          fullName,
          accountNumber,
          referralCode,
          senderName: senderName || fullName,
        });
        if (ok) {
          added++;
          existingKeys.add(key);
        } else {
          invalidRows.push({ row: rowNum, reason: `không thể lưu (${fullName} - ${accountNumber})` });
        }
      }

      if (added > 0) toast.success(`Đã nhập ${added} tài khoản từ Excel`);
      if (duplicates > 0) toast.warning(`${duplicates} dòng trùng tên + STK đã bỏ qua`);
      if (invalidRows.length > 0) {
        const preview = invalidRows
          .slice(0, 5)
          .map(r => `Dòng ${r.row}: ${r.reason}`)
          .join('\n');
        const more = invalidRows.length > 5 ? `\n... và ${invalidRows.length - 5} dòng khác` : '';
        toast.error(`${invalidRows.length} dòng không hợp lệ`, {
          description: preview + more,
          duration: 10000,
        });
        console.warn('Các dòng Excel không hợp lệ:', invalidRows);
      }
      if (added === 0 && duplicates === 0 && invalidRows.length === 0) {
        toast.info('Không có dữ liệu để nhập');
      }
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Không thể đọc file Excel');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFile}
        data-testid="input-import-excel"
      />
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={isImporting}
        data-testid="button-import-excel"
      >
        <Upload className="w-4 h-4 mr-2" />
        {isImporting ? 'Đang nhập...' : 'Nhập Excel'}
      </Button>
    </>
  );
}
