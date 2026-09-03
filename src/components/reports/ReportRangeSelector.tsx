'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { ReportRangePreset } from '@/lib/money';

const PRESETS: { id: ReportRangePreset; label: string }[] = [
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'last-3-months', label: 'Last 3 months' },
  { id: 'last-6-months', label: 'Last 6 months' },
  { id: 'this-year', label: 'This year' },
  { id: 'custom', label: 'Custom' },
];

export function ReportRangeSelector({ active }: { active: ReportRangePreset }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setPreset(preset: ReportRangePreset) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', preset);
    if (preset !== 'custom') {
      params.delete('start');
      params.delete('end');
    }
    router.push(`/reports?${params.toString()}`);
  }

  function setCustomDate(key: 'start' | 'end', value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', 'custom');
    params.set(key, value);
    router.push(`/reports?${params.toString()}`);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Report date range">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            aria-pressed={active === p.id}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              active === p.id ? 'border-accent bg-accent text-accent-ink' : 'border-border text-ink-muted'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {active === 'custom' && (
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="report-start" className="sr-only">
            Start date
          </label>
          <input
            id="report-start"
            type="date"
            defaultValue={searchParams.get('start') ?? ''}
            onChange={(e) => setCustomDate('start', e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <span className="text-sm text-ink-faint">to</span>
          <label htmlFor="report-end" className="sr-only">
            End date
          </label>
          <input
            id="report-end"
            type="date"
            defaultValue={searchParams.get('end') ?? ''}
            onChange={(e) => setCustomDate('end', e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </div>
      )}
    </div>
  );
}
