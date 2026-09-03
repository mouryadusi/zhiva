'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { A11Y_OPTIONS, A11Y_PRESETS, type A11yCategory } from '@/lib/accessibility-presets';
import { useAccessibility } from './AccessibilityProvider';

const CATEGORIES: { id: A11yCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'vision', label: 'Vision' },
  { id: 'movement', label: 'Movement' },
  { id: 'cognitive', label: 'Cognitive' },
  { id: 'temporary', label: 'Temporary' },
  { id: 'night', label: 'Night' },
];

export function AccessibilityPanel() {
  const { activeOptionIds, toggleOption, setOptions } = useAccessibility();
  const [category, setCategory] = useState<A11yCategory | 'all'>('all');

  const visibleOptions =
    category === 'all'
      ? A11Y_OPTIONS
      : A11Y_OPTIONS.filter((o) => o.categories.includes(category));

  return (
    <section aria-labelledby="a11y-heading" className="mx-auto max-w-3xl px-6 py-14 sm:py-18">
      <h2 id="a11y-heading" className="font-serif text-title-1 text-ink">
        Make ZHIVA comfortable for you.
      </h2>
      <p className="mt-3 max-w-lg text-ink-muted">
        These aren&apos;t settings buried in a menu — they&apos;re part of how ZHIVA looks and
        moves for you, right now. Combine as many as you like.
      </p>

      {/* Quick presets */}
      <div className="mt-8 flex flex-wrap gap-2">
        {A11Y_PRESETS.map((preset) => {
          const isActive = preset.optionIds.every((id) => activeOptionIds.includes(id));
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setOptions(isActive ? [] : preset.optionIds)}
              aria-pressed={isActive}
              className={clsx(
                'motion-safe-transition rounded-full border px-4 py-2 text-sm font-medium',
                isActive
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-border bg-surface-raised text-ink hover:border-accent/50'
              )}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOptions([])}
          className="motion-safe-transition rounded-full border border-transparent px-4 py-2 text-sm text-ink-faint hover:text-ink"
        >
          Reset
        </button>
      </div>

      {/* Category filter */}
      <div
        role="tablist"
        aria-label="Accessibility categories"
        className="mt-10 flex flex-wrap gap-4 border-b border-border pb-3 text-sm"
      >
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={clsx(
              'motion-safe-transition pb-2 font-medium',
              category === c.id
                ? 'border-b-2 border-accent text-ink'
                : 'text-ink-faint hover:text-ink'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Individual options */}
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {visibleOptions.map((opt) => {
          const isActive = activeOptionIds.includes(opt.id);
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => toggleOption(opt.id)}
                aria-pressed={isActive}
                className={clsx(
                  'motion-safe-transition flex w-full flex-col gap-1 rounded-card border p-4 text-left',
                  isActive
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-surface-raised hover:border-accent/40'
                )}
              >
                <span className="flex items-center justify-between font-medium text-ink">
                  {opt.label}
                  <span
                    aria-hidden
                    className={clsx(
                      'h-4 w-4 rounded-full border',
                      isActive ? 'border-accent bg-accent' : 'border-border'
                    )}
                  />
                </span>
                <span className="text-sm text-ink-muted">{opt.description}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
