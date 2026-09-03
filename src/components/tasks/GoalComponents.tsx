'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/design-system/Button';
import { Card, ProgressBar } from '@/components/design-system/Primitives';
import { LabeledInput } from '@/components/design-system/Field';
import type { Goal } from '@/types/database';

export function QuickAddGoal() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [domain, setDomain] = useState<'life' | 'financial'>('life');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        horizon: 'life',
        domain,
        target_value: targetValue ? Number(targetValue) : null,
        unit: unit || (domain === 'financial' ? 'currency' : null),
      }),
    });
    setSubmitting(false);
    setTitle('');
    setTargetValue('');
    setUnit('');
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-accent"
      >
        + Set a goal
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-card border border-border bg-surface-raised p-4">
      <div className="flex gap-2" role="group" aria-label="Goal type">
        {(['life', 'financial'] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDomain(d)}
            aria-pressed={domain === d}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium capitalize ${
              domain === d ? 'border-accent bg-accent text-accent-ink' : 'border-border text-ink-muted'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <LabeledInput
        label="Goal title"
        labelVisible={false}
        type="text"
        autoFocus
        placeholder="What do you want to move toward?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="flex gap-2">
        <LabeledInput
          label="Target amount"
          labelVisible={false}
          type="number"
          placeholder="Target (optional)"
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
        />
        <LabeledInput
          label="Unit"
          labelVisible={false}
          type="text"
          placeholder="Unit (e.g. ₹, books)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save goal'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function GoalList({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) {
    return (
      <p className="mt-3 text-ink-muted">
        Give yourself something worth moving toward.
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      {goals.map((g) => (
        <Card key={g.id} className="!p-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="font-medium text-ink">
              {g.title}
              {g.domain === 'financial' && (
                <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  Financial
                </span>
              )}
            </p>
            {g.target_value != null && (
              <p className="text-sm text-ink-faint">
                {g.current_value}
                {g.unit ? ` ${g.unit}` : ''} / {g.target_value}
                {g.unit ? ` ${g.unit}` : ''}
              </p>
            )}
          </div>
          {g.target_value != null && <ProgressBar value={g.current_value} max={g.target_value} />}
        </Card>
      ))}
    </div>
  );
}
