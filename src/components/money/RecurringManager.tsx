'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/design-system/Button';
import { Card, Eyebrow } from '@/components/design-system/Primitives';
import { LabeledInput, LabeledSelect } from '@/components/design-system/Field';
import type { Account, Category, RecurringTransaction } from '@/types/database';

const CADENCE_LABEL: Record<RecurringTransaction['cadence'], string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  custom: 'Custom',
};

export function RecurringManager({
  rules,
  accounts,
  categories,
}: {
  rules: RecurringTransaction[];
  accounts: Account[];
  categories: Category[];
}) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<string | null>(null);

  async function handleProcessNow() {
    setProcessing(true);
    setProcessResult(null);
    const res = await fetch('/api/recurring/process', { method: 'POST' });
    const body = await res.json().catch(() => null);
    setProcessing(false);
    if (res.ok) {
      setProcessResult(
        body.generated > 0
          ? `Generated ${body.generated} transaction${body.generated === 1 ? '' : 's'}.`
          : 'Everything is already up to date — nothing new to generate.'
      );
      router.refresh();
    } else {
      setProcessResult("Couldn't process right now — try again.");
    }
  }

  const active = rules.filter((r) => r.active);
  const paused = rules.filter((r) => !r.active);

  return (
    <div>
      <div className="flex items-center justify-between">
        <Eyebrow>Recurring</Eyebrow>
        <button type="button" onClick={handleProcessNow} disabled={processing} className="text-sm font-medium text-accent">
          {processing ? 'Checking…' : 'Check for due transactions'}
        </button>
      </div>
      {processResult && <p className="mt-2 text-sm text-ink-muted">{processResult}</p>}

      {rules.length === 0 ? (
        <p className="mt-3 text-ink-muted">
          Rent, salary, subscriptions — anything that repeats. ZHIVA generates the actual
          transaction automatically when it&apos;s due, and you&apos;ll always see it appear here
          first.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {active.map((r) => (
            <RuleCard key={r.id} rule={r} accounts={accounts} categories={categories} />
          ))}
          {paused.length > 0 && (
            <>
              <p className="pt-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Paused</p>
              {paused.map((r) => (
                <RuleCard key={r.id} rule={r} accounts={accounts} categories={categories} />
              ))}
            </>
          )}
        </div>
      )}

      <div className="mt-6">
        <CreateRuleForm accounts={accounts} categories={categories} />
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  accounts,
  categories,
}: {
  rule: RecurringTransaction;
  accounts: Account[];
  categories: Category[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const accountName = accounts.find((a) => a.id === rule.account_id)?.name;
  const categoryName = categories.find((c) => c.id === rule.category_id)?.name;

  async function togglePause() {
    setBusy(true);
    await fetch(`/api/recurring/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !rule.active }),
    });
    setBusy(false);
    router.refresh();
  }

  async function handleDelete() {
    await fetch(`/api/recurring/${rule.id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <Card className={`!p-4 ${!rule.active ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{rule.merchant ?? categoryName ?? 'Recurring transaction'}</p>
          <p className="text-sm text-ink-faint">
            {rule.kind === 'income' ? '+' : '−'}
            {rule.currency} {Number(rule.amount).toFixed(2)} · {CADENCE_LABEL[rule.cadence]}
            {accountName ? ` · ${accountName}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {rule.active ? `Next: ${rule.next_run_at}` : 'Paused'}
            {rule.cadence === 'custom' && ' · Custom cadence — advances manually only'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs">
          <button type="button" onClick={togglePause} disabled={busy} className="font-medium text-ink-muted hover:text-ink">
            {rule.active ? 'Pause' : 'Resume'}
          </button>
          {confirmingDelete ? (
            <span className="flex gap-2">
              <button type="button" onClick={handleDelete} className="font-medium text-critical">
                Confirm
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="text-ink-faint">
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="font-medium text-ink-muted hover:text-critical">
              Delete
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

function CreateRuleForm({ accounts, categories }: { accounts: Account[]; categories: Category[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [cadence, setCadence] = useState<RecurringTransaction['cadence']>('monthly');
  const [nextRunAt, setNextRunAt] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!amount || !accountId) {
      setError('Amount and account are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        amount: Number(amount),
        merchant: merchant || null,
        account_id: accountId,
        category_id: categoryId || null,
        cadence,
        next_run_at: nextRunAt,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Couldn't save that — check the amount and try again.");
      return;
    }
    setAmount('');
    setMerchant('');
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-accent">
        + Add recurring transaction
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-card border border-border bg-surface-raised p-4">
      <div className="flex gap-2">
        {(['expense', 'income'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
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
        min="0"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <LabeledInput
        label="Merchant or description"
        labelVisible={false}
        type="text"
        placeholder="Merchant or description (e.g. Rent, Netflix)"
        value={merchant}
        onChange={(e) => setMerchant(e.target.value)}
      />
      <LabeledSelect label="Account" labelVisible={false} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </LabeledSelect>
      <LabeledSelect label="Category" labelVisible={false} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        <option value="">No category</option>
        {categories.filter((c) => c.kind === kind).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </LabeledSelect>
      <div className="flex gap-2">
        <LabeledSelect
          label="Cadence"
          labelVisible={false}
          containerClassName="w-full"
          value={cadence}
          onChange={(e) => setCadence(e.target.value as RecurringTransaction['cadence'])}
        >
          {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map((c) => (
            <option key={c} value={c}>
              {CADENCE_LABEL[c]}
            </option>
          ))}
        </LabeledSelect>
        <LabeledInput
          label="First occurrence date"
          labelVisible={false}
          containerClassName="w-full"
          type="date"
          value={nextRunAt}
          onChange={(e) => setNextRunAt(e.target.value)}
        />
      </div>
      {cadence === 'custom' && (
        <p className="text-xs text-ink-faint">
          Custom cadences aren&apos;t auto-advanced yet — you&apos;ll need to update the date manually
          after each occurrence.
        </p>
      )}
      {error && (
        <p className="text-sm text-critical" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
