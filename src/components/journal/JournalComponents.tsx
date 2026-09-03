'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/design-system/Button';
import { Eyebrow } from '@/components/design-system/Primitives';
import { LabeledTextarea, LabeledInput } from '@/components/design-system/Field';
import { useToast } from '@/components/design-system/Toast';
import type { JournalEntry } from '@/types/database';

const UNDO_WINDOW_MS = 5000;

export function JournalEditor({
  entry,
  entryDate,
  dateLabel,
}: {
  entry: JournalEntry | null;
  entryDate: string;
  dateLabel: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState(entry?.content ?? '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_date: entryDate, content }),
    });
    setSaving(false);
    if (!res.ok) {
      setError('Could not save that — try again.');
      return;
    }
    setSavedAt(new Date());
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="mb-3 text-sm text-ink-faint">{dateLabel}</p>
      <LabeledTextarea
        label={`Journal entry for ${dateLabel}`}
        labelVisible={false}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="How was today?"
        rows={10}
        className="!rounded-card !border-border !bg-surface-raised !p-5 font-serif !text-lg leading-relaxed resize-none"
      />
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-ink-faint" role={error ? 'alert' : undefined}>
          {error ? (
            <span className="text-critical">{error}</span>
          ) : savedAt ? (
            `Saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          ) : (
            ''
          )}
        </p>
        <Button type="submit" disabled={saving || !content.trim()}>
          {saving ? 'Saving…' : 'Save entry'}
        </Button>
      </div>
    </form>
  );
}

export function JournalHistory({ entries, activeDate }: { entries: JournalEntry[]; activeDate: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());

  const others = entries.filter((e) => e.entry_date !== activeDate && !pendingDeleteIds.has(e.id));
  const filtered = query
    ? others.filter((e) => e.content.toLowerCase().includes(query.toLowerCase()))
    : others;

  function handleDelete(entry: JournalEntry) {
    setPendingDeleteIds((prev) => new Set(prev).add(entry.id));
    const timer = setTimeout(async () => {
      await fetch(`/api/journal/${entry.id}`, { method: 'DELETE' });
      router.refresh();
    }, UNDO_WINDOW_MS);

    showToast('Entry deleted', {
      actionLabel: 'Undo',
      durationMs: UNDO_WINDOW_MS,
      onAction: () => {
        clearTimeout(timer);
        setPendingDeleteIds((prev) => {
          const next = new Set(prev);
          next.delete(entry.id);
          return next;
        });
      },
    });
  }

  if (entries.length <= 1 && !query) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between">
        <Eyebrow>Recent</Eyebrow>
      </div>
      <LabeledInput
        label="Search journal entries"
        labelVisible={false}
        type="search"
        placeholder="Search entries…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-3"
      />
      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-ink-faint">No entries match &ldquo;{query}&rdquo;.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {filtered.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-4 py-4">
              <a href={`/journal?date=${e.entry_date}`} className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">
                  {new Date(e.entry_date + 'T00:00:00').toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <p className="mt-1 truncate text-sm text-ink-muted">{e.content}</p>
              </a>
              <button
                type="button"
                onClick={() => handleDelete(e)}
                aria-label={`Delete journal entry from ${e.entry_date}`}
                className="shrink-0 text-xs text-ink-faint hover:text-critical"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
