'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Card } from '@/components/design-system/Primitives';
import type { Transaction } from '@/types/database';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarGrid({
  monthStart,
  transactions,
  currency,
}: {
  monthStart: Date;
  transactions: Transaction[];
  currency: string;
}) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const firstWeekday = monthStart.getDay();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === monthStart.getFullYear() && today.getMonth() === monthStart.getMonth();

  const totalsByDay = new Map<number, { income: number; expense: number }>();
  for (const t of transactions) {
    if (t.kind === 'transfer') continue;
    const day = new Date(t.occurred_at).getDate();
    const current = totalsByDay.get(day) ?? { income: 0, expense: 0 };
    if (t.kind === 'income') current.income += Number(t.amount);
    if (t.kind === 'expense') current.expense += Number(t.amount);
    totalsByDay.set(day, current);
  }
  const maxExpense = Math.max(1, ...[...totalsByDay.values()].map((d) => d.expense));

  function navigateMonth(delta: number) {
    const next = new Date(monthStart.getFullYear(), monthStart.getMonth() + delta, 1);
    router.push(`/calendar?month=${next.getFullYear()}-${next.getMonth() + 1}`);
  }

  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const dayTransactions = selectedDay
    ? transactions.filter((t) => new Date(t.occurred_at).getDate() === selectedDay)
    : [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigateMonth(-1)}
          aria-label="Previous month"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-muted hover:text-ink"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => navigateMonth(1)}
          aria-label="Next month"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-muted hover:text-ink"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-faint">
        {WEEKDAYS.map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const totals = totalsByDay.get(day);
          const intensity = totals && totals.expense > 0 ? totals.expense / maxExpense : 0;
          const isToday = isCurrentMonth && today.getDate() === day;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(selectedDay === day ? null : day)}
              aria-pressed={selectedDay === day}
              aria-label={`${day}${totals ? `, ${totals.expense > 0 ? `spent ${currency} ${totals.expense.toFixed(2)}` : 'no spending'}` : ', no activity'}`}
              className={clsx(
                'flex aspect-square flex-col items-center justify-center rounded-lg border text-xs motion-safe-transition',
                selectedDay === day ? 'border-accent' : 'border-transparent',
                isToday && 'font-semibold text-accent'
              )}
              style={intensity > 0 ? { backgroundColor: `rgb(var(--critical) / ${0.08 + intensity * 0.35})` } : undefined}
            >
              <span className={isToday ? 'text-accent' : 'text-ink'}>{day}</span>
              {totals && totals.expense > 0 && (
                <span className="text-[9px] text-ink-faint">{totals.expense >= 1000 ? `${(totals.expense / 1000).toFixed(1)}k` : totals.expense.toFixed(0)}</span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-ink">
            {monthStart.toLocaleDateString(undefined, { month: 'long' })} {selectedDay}
          </p>
          {dayTransactions.length === 0 ? (
            <p className="text-sm text-ink-muted">No transactions this day.</p>
          ) : (
            <div className="space-y-2">
              {dayTransactions.map((t) => (
                <Card key={t.id} className="!p-3 flex items-center justify-between">
                  <span className="text-sm text-ink">{t.merchant ?? (t.kind === 'transfer' ? 'Transfer' : 'Transaction')}</span>
                  <span className={clsx('text-sm font-medium', t.kind === 'income' ? 'text-positive' : 'text-ink')}>
                    {t.kind === 'income' ? '+' : t.kind === 'expense' ? '−' : '⇄'}
                    {t.currency} {Number(t.amount).toFixed(2)}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
