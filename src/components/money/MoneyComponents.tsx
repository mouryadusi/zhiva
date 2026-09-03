'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Eyebrow } from '@/components/design-system/Primitives';
import { Button } from '@/components/design-system/Button';
import { LabeledInput, LabeledSelect } from '@/components/design-system/Field';
import { ReceiptCapture } from '@/components/money/ReceiptCapture';
import type { Account, Category, Transaction } from '@/types/database';

export function QuickAddTransaction({
  categories,
  accounts,
  merchantCategoryHistory,
}: {
  categories: Category[];
  accounts: Account[];
  /** merchant name (lowercased) → most recently used category_id for
   * that merchant, built from the user's own transaction history.
   * Never a guess about a merchant ZHIVA hasn't actually seen the
   * user categorize before. */
  merchantCategoryHistory?: Map<string, string>;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryTouchedByUser, setCategoryTouchedByUser] = useState(false);
  const [suggestedFromHistory, setSuggestedFromHistory] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [transferAccountId, setTransferAccountId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleMerchantChange(value: string) {
    setMerchant(value);
    // Only offer a suggestion if the user hasn't already picked a
    // category themselves this session — never overwrite a real choice.
    if (categoryTouchedByUser || !merchantCategoryHistory) return;
    const match = merchantCategoryHistory.get(value.trim().toLowerCase());
    if (match) {
      setCategoryId(match);
      setSuggestedFromHistory(true);
    } else if (suggestedFromHistory) {
      // The merchant text no longer matches what triggered the
      // suggestion — clear it rather than leave a stale guess in place.
      setCategoryId('');
      setSuggestedFromHistory(false);
    }
  }

  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setCategoryTouchedByUser(true);
    setSuggestedFromHistory(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accountId) {
      setError('Add an account first — every transaction needs one.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        amount: Number(amount),
        category_id: kind === 'transfer' ? null : categoryId || null,
        account_id: accountId,
        transfer_account_id: kind === 'transfer' ? transferAccountId || null : null,
        merchant: merchant || null,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(typeof body?.error === 'string' ? body.error : 'Could not save that — try again.');
      return;
    }
    setAmount('');
    setMerchant('');
    setCategoryId('');
    setCategoryTouchedByUser(false);
    setSuggestedFromHistory(false);
    router.refresh();
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <p className="font-medium text-ink">Add an account to get started</p>
        <p className="mt-1 text-sm text-ink-muted">
          A default Cash account should have been created automatically when you signed up. If
          you don&apos;t see one, add one below.
        </p>
        <a href="/you" className="mt-3 inline-block text-sm font-medium text-accent">
          Manage accounts →
        </a>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2" role="radiogroup" aria-label="Transaction type">
          {(['expense', 'income', 'transfer'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              role="radio"
              aria-checked={kind === k}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium capitalize ${
                kind === k ? 'border-accent bg-accent text-accent-ink' : 'border-border text-ink-muted'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <LabeledInput
          label="Amount"
          labelVisible={false}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          required
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="!py-3 !text-lg"
        />
        <LabeledSelect
          label="Account"
          labelVisible={false}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          required
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </LabeledSelect>
        {kind === 'transfer' ? (
          <LabeledSelect
            label="Transfer to account"
            labelVisible={false}
            value={transferAccountId}
            onChange={(e) => setTransferAccountId(e.target.value)}
            required
          >
            <option value="">To account…</option>
            {accounts.filter((a) => a.id !== accountId).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </LabeledSelect>
        ) : (
          <>
            <LabeledInput
              label="Merchant or source"
              labelVisible={false}
              type="text"
              placeholder="Merchant or source (optional)"
              value={merchant}
              onChange={(e) => handleMerchantChange(e.target.value)}
            />
            <div>
              <LabeledSelect
                label="Category"
                labelVisible={false}
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                <option value="">No category</option>
                {categories
                  .filter((c) => c.kind === kind)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </LabeledSelect>
              {suggestedFromHistory && (
                <p className="mt-1 text-xs text-ink-faint">
                  Suggested from how you&apos;ve categorized {merchant} before — change it if that&apos;s wrong.
                </p>
              )}
            </div>
            <ReceiptCapture />
          </>
        )}
        {error && (
          <p className="text-sm text-critical" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Saving…' : 'Add'}
        </Button>
      </form>
    </Card>
  );
}

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="mt-8 rounded-card border border-dashed border-border p-8 text-center">
        <p className="font-serif text-title-1 text-ink">Your money story starts here.</p>
        <p className="mt-2 text-ink-muted">
          Track your first expense and ZHIVA will begin showing you where your money goes.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-6">
      <Eyebrow>Recent</Eyebrow>
      <ul className="mt-3 divide-y divide-border">
        {transactions.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-ink">
                {t.merchant ?? (t.kind === 'expense' ? 'Expense' : t.kind === 'income' ? 'Income' : 'Transfer')}
              </p>
              <p className="text-sm text-ink-faint">
                {new Date(t.occurred_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </p>
            </div>
            <p
              className={`font-medium ${
                t.kind === 'income' ? 'text-positive' : t.kind === 'transfer' ? 'text-ink-muted' : 'text-ink'
              }`}
            >
              {t.kind === 'income' ? '+' : t.kind === 'expense' ? '−' : '⇄'}
              {t.currency} {t.amount.toFixed(2)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
