'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import type { Task } from '@/types/database';
import { Button } from '@/components/design-system/Button';
import { LabeledInput } from '@/components/design-system/Field';

const SCOPES = ['today', 'week', 'month'] as const;

export function QuickAddTask({ scope }: { scope: (typeof SCOPES)[number] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, scope }),
    });
    setSubmitting(false);
    setTitle('');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <LabeledInput
        label="Task title"
        labelVisible={false}
        containerClassName="flex-1"
        type="text"
        placeholder="Add a task…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="bg-surface-raised py-3"
      />
      <Button type="submit" disabled={submitting}>
        Add
      </Button>
    </form>
  );
}

export function ScopeTabs({ active }: { active: (typeof SCOPES)[number] }) {
  return (
    <div role="tablist" aria-label="Task scope" className="flex gap-4 border-b border-border">
      {SCOPES.map((s) => (
        <a
          key={s}
          href={`/tasks?scope=${s}`}
          role="tab"
          aria-selected={active === s}
          className={clsx(
            'motion-safe-transition pb-3 text-sm font-medium capitalize',
            active === s ? 'border-b-2 border-accent text-ink' : 'text-ink-faint hover:text-ink'
          )}
        >
          {s === 'today' ? 'Today' : `This ${s}`}
        </a>
      ))}
    </div>
  );
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  const router = useRouter();

  async function toggleComplete(task: Task) {
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed_at: task.completed_at ? null : new Date().toISOString() }),
    });
    router.refresh();
  }

  async function postpone(taskId: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postpone: true }),
    });
    router.refresh();
  }

  if (tasks.length === 0) {
    return (
      <p className="mt-6 text-ink-muted">
        Nothing here right now — add the one thing that actually needs doing.
      </p>
    );
  }

  return (
    <ul className="mt-6 divide-y divide-border">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center gap-3 py-3">
          <button
            type="button"
            onClick={() => toggleComplete(t)}
            aria-pressed={Boolean(t.completed_at)}
            aria-label={t.completed_at ? 'Mark incomplete' : 'Mark complete'}
            className={clsx(
              'h-5 w-5 shrink-0 rounded-full border',
              t.completed_at ? 'border-accent bg-accent' : 'border-border'
            )}
          />
          <div className="flex-1">
            <p className={clsx('font-medium', t.completed_at ? 'text-ink-faint line-through' : 'text-ink')}>
              {t.title}
            </p>
            {t.postponed_count > 0 && !t.completed_at && (
              <p className="text-xs text-caution">Postponed {t.postponed_count}×</p>
            )}
          </div>
          {t.priority === 'high' && !t.completed_at && (
            <span className="rounded-full bg-critical/10 px-2 py-1 text-xs font-medium text-critical">
              High
            </span>
          )}
          {!t.completed_at && (
            <button
              type="button"
              onClick={() => postpone(t.id)}
              className="shrink-0 text-xs text-ink-faint hover:text-ink"
            >
              Postpone
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
