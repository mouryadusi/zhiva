import Link from 'next/link';
import { Card, Eyebrow, ProgressBar, Section } from '@/components/design-system/Primitives';
import { buttonClasses } from '@/components/design-system/Button';
import type { Task, Goal, Transaction } from '@/types/database';
import { ProvenanceBadge } from '@/components/design-system/ProvenanceBadge';
import type { NextAction } from '@/lib/next-action';

// Every section here renders directly from real fetched data — no
// placeholder numbers, no invented copy. Empty data gets an honest,
// guiding empty state (spec: never a bare "No X yet."), not a
// fabricated example.

export function GreetingHeader({ name, dateLabel }: { name: string | null; dateLabel: string }) {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return (
    <Section className="pb-6 pt-16 sm:pt-22">
      <Eyebrow>{dateLabel}</Eyebrow>
      <h1 className="mt-2 font-serif text-display-2 text-ink">
        Good {timeOfDay}{name ? `, ${name}` : ''}.
      </h1>
    </Section>
  );
}

export function TodayPriority({ tasks }: { tasks: Task[] }) {
  const top = tasks.slice(0, 5);
  return (
    <Section className="py-8">
      <Eyebrow>Today&apos;s priority</Eyebrow>
      {top.length === 0 ? (
        <div className="mt-3">
          <p className="text-ink-muted">
            Nothing on today&apos;s list yet. Add the one thing that actually needs to happen today.
          </p>
          <Link href="/tasks" className="mt-2 inline-block text-sm font-medium text-accent">
            Add a task →
          </Link>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {top.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-ink">{t.title}</p>
                {t.due_at && (
                  <p className="text-sm text-ink-faint">
                    {new Date(t.due_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </p>
                )}
              </div>
              {t.priority === 'high' && (
                <span className="rounded-full bg-critical/10 px-2 py-1 text-xs font-medium text-critical">
                  High
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function ProgressSection({ goals }: { goals: Goal[] }) {
  const active = goals.filter((g) => g.status === 'active').slice(0, 3);
  if (active.length === 0) {
    return (
      <Section className="py-8">
        <Eyebrow>Progress</Eyebrow>
        <p className="mt-3 text-ink-muted">
          Give yourself something worth moving toward.
        </p>
        <Link href="/goals" className="mt-2 inline-block text-sm font-medium text-accent">
          Set a goal →
        </Link>
      </Section>
    );
  }
  return (
    <Section className="py-8">
      <Eyebrow>Progress</Eyebrow>
      <div className="mt-4 space-y-5">
        {active.map((g) => (
          <div key={g.id}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <p className="font-medium text-ink">{g.title}</p>
              {g.target_value != null && (
                <p className="text-sm text-ink-faint">
                  {g.current_value}
                  {g.unit ? ` ${g.unit}` : ''} / {g.target_value}
                  {g.unit ? ` ${g.unit}` : ''}
                </p>
              )}
            </div>
            <ProgressBar value={g.current_value} max={g.target_value ?? 100} />
          </div>
        ))}
      </div>
    </Section>
  );
}

export function ReflectionPrompt({ hasEntryToday }: { hasEntryToday: boolean }) {
  return (
    <Section className="py-8 pb-24">
      <Eyebrow>Reflection</Eyebrow>
      <Card className="mt-4">
        <p className="font-serif text-title-1 text-ink">
          {hasEntryToday ? 'You wrote today. Add anything else on your mind?' : 'What mattered today?'}
        </p>
        <Link
          href="/journal"
          className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'mt-4' })}
        >
          {hasEntryToday ? 'Continue entry' : 'Start writing'}
        </Link>
      </Card>
    </Section>
  );
}

// ---------------------------------------------------------------------
// Premium dashboard additions. Every number here is passed in already
// computed (by src/lib/money.ts or src/lib/ai/facts.ts) — nothing in
// this file calculates a financial value, it only presents one.
// ---------------------------------------------------------------------

export function NextActionCard({ action }: { action: NextAction }) {
  if (action.kind === 'none') {
    return (
      <Section className="pb-2 pt-2">
        <Card className="border-positive/20 bg-positive/5">
          <p className="font-medium text-ink">You&apos;re caught up.</p>
          <p className="mt-1 text-sm text-ink-muted">Nothing urgent right now — a good time to check in on a goal or write in your journal.</p>
        </Card>
      </Section>
    );
  }

  return (
    <Section className="pb-2 pt-2">
      <Eyebrow>Do this next</Eyebrow>
      <Card className="mt-2">
        <p className="font-medium text-ink">{action.title}</p>
        <p className="mt-1 text-sm text-ink-muted">{action.detail}</p>
        <Link href={action.href} className={buttonClasses({ variant: 'primary', size: 'sm', className: 'mt-3' })}>
          {action.kind === 'insight' ? 'View' : 'Open'}
        </Link>
      </Card>
    </Section>
  );
}

export function BalanceCard({
  balance,
  currency,
  hasMultipleCurrencies,
}: {
  balance: number;
  currency: string;
  hasMultipleCurrencies: boolean;
}) {
  return (
    <Section className="pb-2 pt-2">
      <Eyebrow>Current balance</Eyebrow>
      {hasMultipleCurrencies ? (
        <>
          <p className="mt-2 font-serif text-title-1 text-ink">Multiple currencies</p>
          <p className="mt-1 text-sm text-ink-muted">
            See <Link href="/you" className="font-medium text-accent">Accounts</Link> for a per-currency breakdown —
            ZHIVA won&apos;t combine them into one misleading number.
          </p>
        </>
      ) : (
        <p className="mt-2 font-serif text-display-1 text-ink">
          {currency} {balance.toFixed(2)}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Link href="/transactions" className={buttonClasses({ variant: 'primary', size: 'sm' })}>
          + Add expense
        </Link>
        <Link href="/transactions" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
          View all
        </Link>
      </div>
    </Section>
  );
}

export function MoneyFlowCard({
  income,
  expense,
  net,
  currency,
  topCategoryName,
  topCategoryAmount,
  hasMultipleCurrencies,
}: {
  income: number;
  expense: number;
  net: number;
  currency: string;
  topCategoryName: string | null;
  topCategoryAmount: number | null;
  hasMultipleCurrencies: boolean;
}) {
  if (hasMultipleCurrencies) return null; // BalanceCard already explains this case; avoid saying it twice
  const hasData = income > 0 || expense > 0;

  return (
    <Section className="py-8">
      <Eyebrow>This month</Eyebrow>
      {!hasData ? (
        <>
          <p className="mt-3 font-medium text-ink">Your money story starts here.</p>
          <p className="mt-1 text-sm text-ink-muted">
            Track your first expense and ZHIVA will start showing real patterns here — never
            estimated, only from what you&apos;ve actually logged.
          </p>
        </>
      ) : (
        <>
          <Card className="mt-3 grid grid-cols-3 gap-2 !p-4 text-center">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Income</p>
              <p className="mt-1 font-medium text-positive">{income.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Spent</p>
              <p className="mt-1 font-medium text-ink">{expense.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Net</p>
              <p className={`mt-1 font-medium ${net >= 0 ? 'text-positive' : 'text-critical'}`}>{net.toFixed(2)}</p>
            </div>
          </Card>
          {topCategoryName && (
            <p className="mt-2 text-sm text-ink-muted">
              {topCategoryName} is your largest category so far{topCategoryAmount != null ? ` at ${currency} ${topCategoryAmount.toFixed(2)}` : ''}.
            </p>
          )}
        </>
      )}
    </Section>
  );
}

export function MonthEndProjectionCard({
  projectedExpense,
  projectedNet,
  currency,
  hasData,
}: {
  projectedExpense: number;
  projectedNet: number;
  currency: string;
  hasData: boolean;
}) {
  if (!hasData) return null;
  return (
    <Section className="py-8" data-secondary>
      <div className="flex items-center justify-between">
        <Eyebrow>Where this month is headed</Eyebrow>
        <ProvenanceBadge kind="projection" showActual />
      </div>
      <Card className="mt-3">
        <p className="text-ink">
          At your current pace, you&apos;re projected to spend about{' '}
          <span className="font-medium">
            {currency} {projectedExpense.toFixed(2)}
          </span>{' '}
          this month, ending with a net of{' '}
          <span className={`font-medium ${projectedNet >= 0 ? 'text-positive' : 'text-critical'}`}>
            {currency} {projectedNet.toFixed(2)}
          </span>
          .
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          A projection from your actual spending pace this month, not a guarantee.
        </p>
      </Card>
    </Section>
  );
}

export function RecentTransactions({
  transactions,
  categoryNameById,
}: {
  transactions: Transaction[];
  categoryNameById: Map<string, string>;
}) {
  if (transactions.length === 0) return null;
  return (
    <Section className="py-8">
      <div className="flex items-center justify-between">
        <Eyebrow>Recent activity</Eyebrow>
        <Link href="/transactions" className="text-sm font-medium text-accent">
          See all
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-border">
        {transactions.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {t.merchant ?? (t.category_id ? categoryNameById.get(t.category_id) : null) ?? 'Transaction'}
              </p>
              <p className="text-xs text-ink-faint">
                {new Date(t.occurred_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </p>
            </div>
            <p className={`text-sm font-medium ${t.kind === 'income' ? 'text-positive' : 'text-ink'}`}>
              {t.kind === 'income' ? '+' : t.kind === 'expense' ? '−' : '⇄'}
              {t.currency} {Number(t.amount).toFixed(2)}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
