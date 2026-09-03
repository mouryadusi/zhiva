'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ProvenanceBadge } from '@/components/design-system/ProvenanceBadge';

interface TrendPoint {
  monthStart: string;
  net: number;
}

/**
 * Renders exactly what's passed in — no aggregation, no math. `trend`
 * is the actual array from getMonthlyNetTrend (facts.ts); `projectedNet`
 * is the single number from getMonthEndProjection (facts.ts). The chart
 * exists to make the actual/projection distinction visible, not to
 * calculate anything.
 */
export function NetTrendChart({
  trend,
  projectedNet,
  currency,
}: {
  trend: TrendPoint[];
  projectedNet: number | null;
  currency: string;
}) {
  if (trend.length < 2) return null;

  const labelFor = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short' });

  const data = trend.map((p, i) => ({
    label: i === trend.length - 1 ? `${labelFor(p.monthStart)} (so far)` : labelFor(p.monthStart),
    net: p.net,
    projectedNet: i === trend.length - 1 ? p.net : undefined,
  }));

  if (projectedNet != null) {
    data.push({ label: 'Projected', net: undefined as unknown as number, projectedNet });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">Net cash flow</p>
        {projectedNet != null && <ProvenanceBadge kind="projection" showActual />}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--ink-faint))' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--ink-faint))' }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            formatter={(value: number) => [`${currency} ${Number(value).toFixed(2)}`, '']}
            contentStyle={{
              background: 'rgb(var(--surface-raised))',
              border: '1px solid rgb(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="net"
            stroke="rgb(var(--accent))"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="projectedNet"
            stroke="rgb(var(--accent))"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
