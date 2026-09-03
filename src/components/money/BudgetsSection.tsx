'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/design-system/Button';
import { Card, Eyebrow, ProgressBar } from '@/components/design-system/Primitives';
import { ProvenanceBadge } from '@/components/design-system/ProvenanceBadge';
import { LabeledInput, LabeledSelect } from '@/components/design-system/Field';
import { computeBudgetProgress, daysRemainingInMonth, overallExpenseTotal, categoryBreakdownFromTransactions, type BudgetProgress } from '@/lib/money';
import type { Budget, Category, Transaction } from '@/types/database';

interface BudgetsSectionProps {
  budgets: Budget[];
  categories: Category[];
  monthTransactions: Pick<Transaction, 'kind' | 'amount' | 'category_id'>[];
  currency: string;
  /** Home shows only the single worst budget with no create form —
   * the full management UI lives on /budgets. Never recomputes
   * anything differently between the two; same computeBudgetProgress
   * call either way. */
  compact?: boolean;
}

export function BudgetsSection({ budgets, categories, monthTransactions, currency, compact }: BudgetsSectionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [amountLimit, setAmountLimit] = useState('');
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [submitting, setSubmitting] = useState(false);

  const categoryBreakdown = categoryBreakdownFromTransactions(monthTransactions, categories, 'expense');
  const overallSpend = overallExpenseTotal(monthTransactions.filter((t) => t.kind === 'expense'));

  // The single canonical calculation (src/lib/money.ts) — this
  // component never recomputes "how much has been spent against a
  // budget" itself.
  const monthlyOnly = budgets.filter((b) => b.period === 'monthly');
  const progress = computeBudgetProgress(monthlyOnly, categoryBreakdown, overallSpend);
  const weeklyOnly = budgets.filter((b) => b.period === 'weekly');

  const daysLeft = daysRemainingInMonth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!amountLimit) return;
    setSubmitting(true);
    await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId || null, period, amount_limit: Number(amountLimit) }),
    });
    setSubmitting(false);
    setAmountLimit('');
    setCategoryId('');
    setOpen(false);
    router.refresh();
  }

  const displayed = compact ? [...progress].sort((a, b) => b.pct - a.pct).slice(0, 1) : progress;

  if (budgets.length === 0) {
    return compact ? (
      <p className="text-sm text-ink-muted">
        No budgets set yet.{' '}
        <Link href="/budgets" className="font-medium text-accent">
          Set one
        </Link>
      </p>
    ) : (
      <div>
        <Eyebrow>Budgets</Eyebrow>
        <p className="mt-3 text-ink-muted">
          Set a monthly limit for a category and ZHIVA will track it against what you actually
          spend — no estimates.
        </p>
        <CreateBudgetForm
          open={open}
          setOpen={setOpen}
          categoryId={categoryId}
          setCategoryId={setCategoryId}
          amountLimit={amountLimit}
          setAmountLimit={setAmountLimit}
          period={period}
          setPeriod={setPeriod}
          submitting={submitting}
          categories={categories}
          onSubmit={handleSubmit}
        />
      </div>
    );
  }

  return (
    <div>
      {!compact && <Eyebrow>Budgets</Eyebrow>}
      <div className={compact ? 'space-y-2' : 'mt-4 space-y-3'}>
        {displayed.map((b) => (
          <BudgetCard key={b.budgetId} progress={b} currency={currency} daysLeft={daysLeft} compact={compact} />
        ))}
        {!compact && weeklyOnly.map((b) => <WeeklyBudgetCard key={b.id} budget={b} categories={categories} currency={currency} onDeleted={() => router.refresh()} />)}
      </div>

      {!compact && (
        <CreateBudgetForm
          open={open}
          setOpen={setOpen}
          categoryId={categoryId}
          setCategoryId={setCategoryId}
          amountLimit={amountLimit}
          setAmountLimit={setAmountLimit}
          period={period}
          setPeriod={setPeriod}
          submitting={submitting}
          categories={categories}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function WeeklyBudgetCard({
  budget,
  categories,
  currency,
  onDeleted,
}: {
  budget: Budget;
  categories: Category[];
  currency: string;
  onDeleted: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  async function handleDelete() {
    await fetch(`/api/budgets/${budget.id}`, { method: 'DELETE' });
    onDeleted();
  }
  return (
    <Card className="!p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <p className="font-medium text-ink">
          {budget.category_id ? categories.find((c) => c.id === budget.category_id)?.name ?? 'Unknown' : 'Overall'}
        </p>
        <p className="text-sm text-ink-faint">Weekly</p>
      </div>
      <p className="text-sm text-ink-muted">
        Limit: {budget.amount_limit.toFixed(2)} {currency} — weekly progress isn&apos;t tracked yet, only monthly.
      </p>
      <div className="mt-2 text-right text-xs">
        {confirmingDelete ? (
          <span className="flex justify-end gap-2">
            <button type="button" onClick={handleDelete} className="font-medium text-critical">
              Confirm delete
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
    </Card>
  );
}

function BudgetCard({
  progress,
  currency,
  daysLeft,
  compact,
}: {
  progress: BudgetProgress;
  currency: string;
  daysLeft: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [amountLimit, setAmountLimit] = useState(String(progress.limit));
  const [saving, setSaving] = useState(false);

  const statusColor =
    progress.status === 'over' ? 'text-critical' : progress.status === 'near' ? 'text-caution' : 'text-ink-muted';
  const categoryQuery = progress.categoryId ? `?category=${progress.categoryId}` : '';

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/budgets/${progress.budgetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_limit: Number(amountLimit) }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    await fetch(`/api/budgets/${progress.budgetId}`, { method: 'DELETE' });
    router.refresh();
  }

  if (editing) {
    return (
      <Card className="!p-4">
        <p className="mb-2 font-medium text-ink">{progress.name}</p>
        <div className="flex items-center gap-2">
          <LabeledInput
            label={`New limit for ${progress.name}`}
            labelVisible={false}
            containerClassName="flex-1"
            type="number"
            min="0"
            value={amountLimit}
            onChange={(e) => setAmountLimit(e.target.value)}
          />
          <span className="text-sm text-ink-faint">{currency}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" onClick={handleSave} disabled={saving || !amountLimit || Number(amountLimit) < 0}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="!p-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <p className="font-medium text-ink">{progress.name}</p>
        {!compact && <p className="text-sm text-ink-faint">{daysLeft} days left</p>}
      </div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className={statusColor}>
          {progress.spent.toFixed(2)} of {progress.limit.toFixed(2)} {currency}
        </span>
        {progress.status === 'over' && <span className="font-medium text-critical">Over budget</span>}
        {progress.status === 'near' && <span className="font-medium text-caution">Almost there</span>}
      </div>
      <ProgressBar value={Math.min(progress.spent, progress.limit)} max={progress.limit} />
      {progress.status !== 'over' && progress.projectedOverBy != null && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-caution">
          <ProvenanceBadge kind="projection" showActual />
          On pace to be {progress.projectedOverBy.toFixed(2)} over by month-end
        </p>
      )}
      {!compact && (
        <div className="mt-2 flex items-center justify-between">
          <Link href={`/transactions${categoryQuery}`} className="text-xs font-medium text-accent">
            See transactions →
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <button type="button" onClick={() => setEditing(true)} className="font-medium text-ink-muted hover:text-ink">
              Edit
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
      )}
    </Card>
  );
}

function CreateBudgetForm(props: {
  open: boolean;
  setOpen: (v: boolean) => void;
  categoryId: string;
  setCategoryId: (v: string) => void;
  amountLimit: string;
  setAmountLimit: (v: string) => void;
  period: 'weekly' | 'monthly';
  setPeriod: (v: 'weekly' | 'monthly') => void;
  submitting: boolean;
  categories: Category[];
  onSubmit: (e: FormEvent) => void;
}) {
  const { open, setOpen, categoryId, setCategoryId, amountLimit, setAmountLimit, period, setPeriod, submitting, categories, onSubmit } =
    props;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 text-sm font-medium text-accent">
        + Set a budget
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-2 rounded-card border border-border bg-surface-raised p-4">
      <LabeledSelect label="Budget category" labelVisible={false} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        <option value="">Overall (all spending)</option>
        {categories
          .filter((c) => c.kind === 'expense')
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </LabeledSelect>
      <div className="flex gap-2">
        <LabeledInput
          label="Budget limit"
          labelVisible={false}
          containerClassName="w-full"
          type="number"
          placeholder="Limit"
          value={amountLimit}
          onChange={(e) => setAmountLimit(e.target.value)}
        />
        <LabeledSelect
          label="Budget period"
          labelVisible={false}
          containerClassName="w-full"
          value={period}
          onChange={(e) => setPeriod(e.target.value as 'weekly' | 'monthly')}
        >
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
        </LabeledSelect>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? 'Saving…' : 'Create budget'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
