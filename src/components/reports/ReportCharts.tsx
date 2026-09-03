'use client';

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, Eyebrow, ProgressBar } from '@/components/design-system/Primitives';
import type { MonthBucket, CategoryMonthPoint } from '@/lib/money';

const chartTooltipStyle = {
  background: 'rgb(var(--surface-raised))',
  border: '1px solid rgb(var(--border))',
  borderRadius: 8,
  fontSize: 12,
};
const axisTick = { fontSize: 11, fill: 'rgb(var(--ink-faint))' };
const LINE_COLORS = ['rgb(var(--accent))', 'rgb(var(--positive))', 'rgb(var(--caution))', 'rgb(var(--critical))'];

export interface NamedAmount {
  name: string;
  amount: number;
}

export function IncomeTrendChart({ data, currency }: { data: MonthBucket[]; currency: string }) {
  if (data.length < 2) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">Income trend</p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
          <Tooltip formatter={(v: number) => [`${currency} ${Number(v).toFixed(2)}`, '']} contentStyle={chartTooltipStyle} />
          <Line type="monotone" dataKey="income" stroke="rgb(var(--positive))" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryTrendChart({ data, currency }: { data: CategoryMonthPoint[]; currency: string }) {
  if (data.length < 2) return null;
  const categoryNames = [...new Set(data.flatMap((d) => Object.keys(d.amounts)))];
  if (categoryNames.length === 0) return null;

  const chartData = data.map((d) => ({ label: d.label, ...d.amounts }));

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">Category trend</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
          <Tooltip formatter={(v: number) => [`${currency} ${Number(v).toFixed(2)}`, '']} contentStyle={chartTooltipStyle} />
          {categoryNames.map((name, i) => (
            <Line key={name} type="monotone" dataKey={name} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-3">
        {categoryNames.map((name, i) => (
          <span key={name} className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function IncomeVsExpenseChart({ data, currency }: { data: MonthBucket[]; currency: string }) {
  if (data.length < 2) return null; // a single-month range has nothing to trend
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">Income vs. expenses</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
          <Tooltip formatter={(v: number) => [`${currency} ${Number(v).toFixed(2)}`, '']} contentStyle={chartTooltipStyle} />
          <Bar dataKey="income" fill="rgb(var(--positive))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" fill="rgb(var(--critical))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function NetCashFlowChart({ data, currency }: { data: MonthBucket[]; currency: string }) {
  if (data.length < 2) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">Net cash flow</p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
          <Tooltip formatter={(v: number) => [`${currency} ${Number(v).toFixed(2)}`, '']} contentStyle={chartTooltipStyle} />
          <Line type="monotone" dataKey="net" stroke="rgb(var(--accent))" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBarChart({ data, currency }: { data: NamedAmount[]; currency: string }) {
  if (data.length === 0) return null;
  const top = data.slice(0, 8);
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">Spending by category</p>
      <ResponsiveContainer width="100%" height={Math.max(160, top.length * 32)}>
        <BarChart data={top} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
          <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={axisTick} axisLine={false} tickLine={false} width={90} />
          <Tooltip formatter={(v: number) => [`${currency} ${Number(v).toFixed(2)}`, '']} contentStyle={chartTooltipStyle} />
          <Bar dataKey="amount" fill="rgb(var(--accent))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function NamedAmountList({
  title,
  items,
  currency,
  emptyText,
}: {
  title: string;
  items: NamedAmount[];
  currency: string;
  emptyText: string;
}) {
  const max = items[0]?.amount ?? 0;
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">{emptyText}</p>
      ) : (
        <div className="mt-2 space-y-2.5">
          {items.map((item) => (
            <div key={item.name}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-ink">{item.name}</span>
                <span className="font-medium text-ink">
                  {currency} {item.amount.toFixed(2)}
                </span>
              </div>
              <ProgressBar value={item.amount} max={max || 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReportSummaryCard({
  income,
  expense,
  net,
  currency,
}: {
  income: number;
  expense: number;
  net: number;
  currency: string;
}) {
  return (
    <Card className="grid grid-cols-3 gap-2 !p-4 text-center">
      <div>
        <p className="text-xs uppercase tracking-wide text-ink-faint">Income</p>
        <p className="mt-1 font-medium text-positive">
          {currency} {income.toFixed(2)}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-ink-faint">Expenses</p>
        <p className="mt-1 font-medium text-ink">
          {currency} {expense.toFixed(2)}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-ink-faint">Net</p>
        <p className={`mt-1 font-medium ${net >= 0 ? 'text-positive' : 'text-critical'}`}>
          {currency} {net.toFixed(2)}
        </p>
      </div>
    </Card>
  );
}
