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

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

const findValue = (row: Record<string, any>, keywords: string[]): string => {
  const keys = Object.keys(row);
  // Try contains-match: header contains any keyword
  for (const kw of keywords) {
    const nk = norm(kw);
    const match = keys.find(k => norm(k).includes(nk));
    if (match && row[match] != null && String(row[match]).trim() !== '') {
      return String(row[match]).trim();
    }
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

      // Read raw rows (array of arrays) so we can handle any header layout
      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: '',
        raw: false,
        blankrows: false,
      });

      if (rawRows.length < 2) {
        toast.error('Không có dữ liệu trong file');
        return;
      }

      // Find the header row: a row that mentions "tên" or "tài khoản" or "stk"
      let headerIdx = 0;
      for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
        const joined = rawRows[i].map(c => norm(String(c ?? ''))).join('|');
        if (joined.includes('tên') || joined.includes('tàikhoản') || joined.includes('stk')) {
          headerIdx = i;
          break;
        }
      }
      const headers = rawRows[headerIdx].map(h => String(h ?? ''));
      const dataRows = rawRows.slice(headerIdx + 1);

      // Determine column indices for each field
      const findCol = (keywords: string[]): number => {
        for (const kw of keywords) {
          const nk = norm(kw);
          const idx = headers.findIndex(h => {
            const nh = norm(h);
            return nh.length > 0 && nh.includes(nk);
          });
          if (idx !== -1) return idx;
        }
        return -1;
      };

      // Avoid matching "tên" inside "STT" - require longer keywords first
      let nameCol = findCol(['họvàtên', 'họtên', 'tênngườinhận', 'tênngườithụhưởng', 'fullname', 'tên']);
      let accCol = findCol(['sốtàikhoản', 'stk', 'alias', 'account']);
      let refCol = findCol(['mãgiớithiệu', 'giớithiệu', 'referral', 'mãgt']);
      let senderCol = findCol(['ngườigửi', 'sender', 'nộidung']);

      // Don't let nameCol be the STT column (sequence numbers)
      if (nameCol !== -1 && norm(headers[nameCol] || '') === 'stt') {
        nameCol = -1;
      }
      // If still no name column found, try positional fallback (col B for template)
      if (nameCol === -1 && headers.length >= 2) nameCol = 1;
      if (accCol === -1 && headers.length >= 3) accCol = 2;

      // Convert to row objects keyed by our field names
      const rows = dataRows.map(r => ({
        fullName: nameCol >= 0 ? String(r[nameCol] ?? '').trim() : '',
        accountNumber: accCol >= 0 ? normalizeAccount(String(r[accCol] ?? '')) : '',
        referralCode: refCol >= 0 ? String(r[refCol] ?? '').trim() : '',
        senderName: senderCol >= 0 ? String(r[senderCol] ?? '').trim() : '',
      }));

      const existingKeys = new Set(
        existingAccounts.map(a => dupKey(a.full_name, a.account_number))
      );

      let added = 0;
      let duplicates = 0;
      const invalidRows: { row: number; reason: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const { fullName, accountNumber, referralCode, senderName } = rows[i];
        const rowNum = headerIdx + 2 + i; // actual Excel row number

        // Skip completely empty rows silently
        if (!fullName && !accountNumber && !referralCode && !senderName) {
          continue;
        }

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
