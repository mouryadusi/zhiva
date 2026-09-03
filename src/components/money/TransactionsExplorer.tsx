'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Card, Eyebrow } from '@/components/design-system/Primitives';
import { EmptyState } from '@/components/design-system/EmptyState';
import { LabeledInput, LabeledSelect } from '@/components/design-system/Field';
import { useToast } from '@/components/design-system/Toast';
import { ExportButton } from '@/components/reports/ExportButton';
import { isWithinRange } from '@/lib/money';
import type { Account, Category, Transaction } from '@/types/database';

type Kind = 'all' | 'expense' | 'income' | 'transfer';
type Sort = 'newest' | 'oldest';
const UNDO_WINDOW_MS = 5000;

export function TransactionsExplorer({
  transactions,
  categories,
  accounts,
  duplicateIds,
  initialCategoryId,
  initialQuery,
}: {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  duplicateIds: Set<string>;
  initialCategoryId?: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [query, setQuery] = useState(initialQuery ?? '');
  const [kind, setKind] = useState<Kind>('all');
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? '');
  const [accountId, setAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Rows the user just deleted, hidden immediately but not yet actually
  // deleted server-side — gives Undo something real to restore.
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const categoryName = (id: string | null) => (id ? categories.find((c) => c.id === id)?.name : undefined);
  const accountName = (id: string | null) => (id ? accounts.find((a) => a.id === id)?.name : undefined);

  const hasActiveFilters =
    kind !== 'all' || categoryId || accountId || dateFrom || dateTo || amountMin || amountMax || query;

  function clearFilters() {
    setQuery('');
    setKind('all');
    setCategoryId('');
    setAccountId('');
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
  }

  const filtered = useMemo(() => {
    // Everything here runs against data already fetched for this page
    // load — no debounce and no network request per keystroke, because
    // there's nothing to wait for; filtering an already-loaded array is
    // effectively instant even on a large list.
    const result = transactions
      .filter((t) => !pendingDeleteIds.has(t.id))
      .filter((t) => {
        if (kind !== 'all' && t.kind !== kind) return false;
        if (categoryId && t.category_id !== categoryId) return false;
        if (accountId && t.account_id !== accountId) return false;
        if (dateFrom || dateTo) {
          const rangeStart = dateFrom ? new Date(dateFrom) : new Date(0);
          const rangeEnd = dateTo ? new Date(new Date(dateTo).setDate(new Date(dateTo).getDate() + 1)) : new Date(8640000000000000);
          if (!isWithinRange(t.occurred_at, rangeStart, rangeEnd)) return false;
        }
        if (amountMin && Number(t.amount) < Number(amountMin)) return false;
        if (amountMax && Number(t.amount) > Number(amountMax)) return false;
        if (query) {
          const haystack = `${t.merchant ?? ''} ${categoryName(t.category_id) ?? ''} ${t.notes ?? ''} ${t.amount}`.toLowerCase();
          if (!haystack.includes(query.toLowerCase())) return false;
        }
        return true;
      });
    result.sort((a, b) => {
      const diff = new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime();
      return sort === 'newest' ? -diff : diff;
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, kind, categoryId, accountId, dateFrom, dateTo, amountMin, amountMax, query, sort, pendingDeleteIds]);

  /** Optimistically hides the row, then actually deletes it server-side
   * only after the undo window passes with no undo. Clicking Undo
   * clears the pending timer and un-hides the row — nothing was ever
   * sent to the server in that case. */
  function deleteWithUndo(ids: string[]) {
    setPendingDeleteIds((prev) => new Set([...prev, ...ids]));
    setSelectedIds(new Set());
    const timer = setTimeout(async () => {
      await Promise.all(ids.map((id) => fetch(`/api/expenses/${id}`, { method: 'DELETE' })));
      ids.forEach((id) => pendingTimers.current.delete(id));
      router.refresh();
    }, UNDO_WINDOW_MS);
    ids.forEach((id) => pendingTimers.current.set(id, timer));

    showToast(ids.length === 1 ? 'Transaction deleted' : `${ids.length} transactions deleted`, {
      actionLabel: 'Undo',
      durationMs: UNDO_WINDOW_MS,
      onAction: () => {
        ids.forEach((id) => {
          const t = pendingTimers.current.get(id);
          if (t) clearTimeout(t);
          pendingTimers.current.delete(id);
        });
        setPendingDeleteIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      },
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <LabeledInput
        label="Search transactions"
        labelVisible={false}
        type="search"
        placeholder="Search merchant, category, note, amount…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(['all', 'expense', 'income', 'transfer'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={clsx(
              'rounded-full border px-3 py-1.5 text-xs font-medium capitalize',
              kind === k ? 'border-accent bg-accent text-accent-ink' : 'border-border text-ink-muted'
            )}
          >
            {k}
          </button>
        ))}
        <LabeledSelect
          label="Filter by category"
          labelVisible={false}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="!w-auto !rounded-full !py-1.5 !text-xs"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </LabeledSelect>
        <button
          type="button"
          onClick={() => setMoreFiltersOpen((v) => !v)}
          aria-expanded={moreFiltersOpen}
          className={clsx(
            'rounded-full border px-3 py-1.5 text-xs font-medium',
            moreFiltersOpen ? 'border-accent bg-accent text-accent-ink' : 'border-border text-ink-muted'
          )}
        >
          More filters
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectMode((v) => !v);
            setSelectedIds(new Set());
          }}
          className="ml-auto text-xs font-medium text-accent"
        >
          {selectMode ? 'Cancel' : 'Select'}
        </button>
      </div>

      {moreFiltersOpen && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-card border border-border bg-surface-raised p-3">
          <LabeledSelect label="Filter by account" labelVisible={false} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </LabeledSelect>
          <LabeledSelect label="Sort" labelVisible={false} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </LabeledSelect>
          <LabeledInput label="From date" labelVisible={false} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <LabeledInput label="To date" labelVisible={false} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <LabeledInput
            label="Minimum amount"
            labelVisible={false}
            type="number"
            placeholder="Min amount"
            value={amountMin}
            onChange={(e) => setAmountMin(e.target.value)}
          />
          <LabeledInput
            label="Maximum amount"
            labelVisible={false}
            type="number"
            placeholder="Max amount"
            value={amountMax}
            onChange={(e) => setAmountMax(e.target.value)}
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-ink-faint">
          {filtered.length} transaction{filtered.length === 1 ? '' : 's'}
          {hasActiveFilters ? ' matching filters' : ''}
        </p>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="text-xs font-medium text-ink-muted hover:text-ink">
              Clear filters
            </button>
          )}
          <ExportButton transactions={filtered} categories={categories} accounts={accounts} format="csv" rangeLabel="filtered" />
        </div>
      </div>

      {selectMode && selectedIds.size > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-sunken px-4 py-2.5">
          <p className="text-sm text-ink-muted">{selectedIds.size} selected</p>
          <button
            type="button"
            onClick={() => {
              deleteWithUndo([...selectedIds]);
              setSelectMode(false);
            }}
            className="text-sm font-medium text-critical"
          >
            Delete selected
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={transactions.length === 0 ? 'Your money story starts here.' : 'No matches'}
            description={
              transactions.length === 0
                ? 'Track your first expense above and it will show up here.'
                : 'Try a different search term or clear the filters.'
            }
          />
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border">
          {filtered.map((t) => (
            <li key={t.id}>
              {editingId === t.id ? (
                <EditTransactionForm
                  transaction={t}
                  categories={categories}
                  accounts={accounts}
                  onDone={() => {
                    setEditingId(null);
                    router.refresh();
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <TransactionRow
                  transaction={t}
                  categoryName={categoryName(t.category_id)}
                  accountName={accountName(t.account_id)}
                  isDuplicate={duplicateIds.has(t.id)}
                  selectMode={selectMode}
                  selected={selectedIds.has(t.id)}
                  onToggleSelected={() => toggleSelected(t.id)}
                  onEdit={() => setEditingId(t.id)}
                  onDelete={() => deleteWithUndo([t.id])}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TransactionRow({
  transaction: t,
  categoryName,
  accountName,
  isDuplicate,
  selectMode,
  selected,
  onToggleSelected,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  categoryName?: string;
  accountName?: string;
  isDuplicate: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const amountColor = t.kind === 'income' ? 'text-positive' : t.kind === 'transfer' ? 'text-ink-muted' : 'text-ink';
  const sign = t.kind === 'income' ? '+' : t.kind === 'expense' ? '−' : '⇄';
  const label = t.merchant ?? categoryName ?? (t.kind === 'transfer' ? 'Transfer' : 'Expense');

  return (
    <div className="flex items-center gap-3 py-3">
      {selectMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={`Select ${label} transaction`}
          className="h-5 w-5 shrink-0 accent-accent"
        />
      )}
      <button
        type="button"
        onClick={selectMode ? onToggleSelected : onEdit}
        className="min-w-0 flex-1 text-left"
        aria-label={selectMode ? undefined : `Edit ${label} transaction`}
      >
        <div className="flex items-center gap-1.5">
          <p className="truncate font-medium text-ink">{label}</p>
          {t.is_recurring && (
            <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              Recurring
            </span>
          )}
          {isDuplicate && (
            <span className="rounded-full bg-caution/10 px-1.5 py-0.5 text-[10px] font-medium text-caution">
              Possible duplicate
            </span>
          )}
        </div>
        <p className="truncate text-sm text-ink-faint">
          {[categoryName, accountName].filter(Boolean).join(' · ')} ·{' '}
          {new Date(t.occurred_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <p className={clsx('font-medium', amountColor)}>
          {sign}
          {t.currency} {Number(t.amount).toFixed(2)}
        </p>
        {!selectMode &&
          (confirmingDelete ? (
            <div className="flex gap-1">
              <button type="button" onClick={onDelete} className="text-xs font-medium text-critical">
                Delete
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="text-xs text-ink-faint">
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete ${label} transaction`}
              className="flex h-6 w-6 items-center justify-center text-ink-faint hover:text-critical"
            >
              ×
            </button>
          ))}
      </div>
    </div>
  );
}

function EditTransactionForm({
  transaction,
  categories,
  accounts,
  onDone,
  onCancel,
}: {
  transaction: Transaction;
  categories: Category[];
  accounts: Account[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(String(transaction.amount));
  const [categoryId, setCategoryId] = useState(transaction.category_id ?? '');
  const [accountId, setAccountId] = useState(transaction.account_id ?? '');
  const [merchant, setMerchant] = useState(transaction.merchant ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/expenses/${transaction.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(amount),
        category_id: categoryId || null,
        account_id: accountId || undefined,
        merchant: merchant || null,
      }),
    });
    setSaving(false);
    onDone();
  }

  return (
    <Card className="!p-4 my-1">
      <div className="space-y-2">
        <LabeledInput label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <LabeledInput
          label="Merchant"
          placeholder="Merchant"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
        />
        {transaction.kind !== 'transfer' && (
          <LabeledSelect label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">No category</option>
            {categories.filter((c) => c.kind === transaction.kind).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </LabeledSelect>
        )}
        <LabeledSelect label="Account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </LabeledSelect>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-1.5 text-sm text-ink-muted">
            Cancel
          </button>
        </div>
      </div>
    </Card>
  );
}
