'use client';

import { Button } from '@/components/design-system/Button';
import type { Account, Category, Transaction } from '@/types/database';

function toCsvValue(value: string | number | null): string {
  if (value == null) return '';
  const str = String(value);
  // Quote any field containing a comma, quote, or newline, and escape
  // internal quotes — the minimum needed for a spreadsheet to parse
  // merchant names/notes safely (e.g. `Trader Joe's, Inc.`).
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function buildRows(transactions: Transaction[], categories: Category[], accounts: Account[]) {
  const categoryName = (id: string | null) => (id ? categories.find((c) => c.id === id)?.name ?? '' : '');
  const accountName = (id: string | null) => (id ? accounts.find((a) => a.id === id)?.name ?? '' : '');

  return transactions.map((t) => ({
    date: new Date(t.occurred_at).toISOString().slice(0, 10),
    merchant: t.merchant ?? '',
    description: t.notes ?? '',
    amount: Number(t.amount).toFixed(2),
    type: t.kind,
    category: categoryName(t.category_id),
    account: accountName(t.account_id),
    currency: t.currency,
    notes: t.notes ?? '',
  }));
}

function download(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function slugifyRangeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function ExportButton({
  transactions,
  categories,
  accounts,
  format,
  rangeLabel,
}: {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  format: 'csv' | 'json';
  rangeLabel: string;
}) {
  function handleExport() {
    const rows = buildRows(transactions, categories, accounts);
    const today = new Date().toISOString().slice(0, 10);
    const filenameBase = `zhiva-transactions-${slugifyRangeLabel(rangeLabel)}-${today}`;

    if (format === 'csv') {
      const headers = ['date', 'merchant', 'description', 'amount', 'type', 'category', 'account', 'currency', 'notes'];
      const lines = [
        headers.join(','),
        ...rows.map((r) => headers.map((h) => toCsvValue(r[h as keyof typeof r])).join(',')),
      ];
      download(`${filenameBase}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
    } else {
      download(`${filenameBase}.json`, JSON.stringify(rows, null, 2), 'application/json');
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleExport} disabled={transactions.length === 0}>
      Export {format.toUpperCase()}
    </Button>
  );
}
