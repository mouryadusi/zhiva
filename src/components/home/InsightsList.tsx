'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/design-system/Primitives';
import type { Insight } from '@/lib/ai/insights';

const SEVERITY_STYLE: Record<Insight['severity'], string> = {
  high: 'text-critical',
  medium: 'text-caution',
  low: 'text-ink-muted',
};

const TYPE_LABEL: Record<Insight['type'], string> = {
  budget_risk: 'Budget risk',
  unusual_category: 'Unusual spending',
  declining_balance: 'Declining balance',
  large_upcoming_obligation: 'Upcoming obligation',
  possible_duplicate: 'Possible duplicate',
  undetected_subscription: 'Recurring charge',
};

function actionFor(insight: Insight): { label: string; href: string } | null {
  switch (insight.type) {
    case 'budget_risk':
      return { label: 'Adjust budget', href: '/budgets' };
    case 'unusual_category': {
      const categoryId = (insight.evidence as { id?: string }).id;
      return { label: 'See transactions', href: categoryId ? `/transactions?category=${categoryId}` : '/transactions' };
    }
    case 'declining_balance':
      return { label: 'Compare months', href: '/assistant' };
    case 'large_upcoming_obligation':
      return { label: 'Review budgets', href: '/budgets' };
    case 'possible_duplicate': {
      const merchant = (insight.evidence as { example?: [{ merchant?: string }] }).example?.[0]?.merchant;
      return { label: 'See transactions', href: merchant ? `/transactions?q=${encodeURIComponent(merchant)}` : '/transactions' };
    }
    case 'undetected_subscription': {
      const merchant = (insight.evidence as { merchant?: string }).merchant;
      return { label: 'Review', href: merchant ? `/transactions?q=${encodeURIComponent(merchant)}` : '/transactions' };
    }
    default:
      return null;
  }
}

export function InsightsList({ insights }: { insights: Insight[] }) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const visible = insights.filter((_, i) => !dismissed.has(i));

  if (visible.length === 0) {
    return (
      <p className="mt-3 text-ink-muted">
        Nothing worth flagging right now — check back after you log more activity.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {insights.map((insight, i) => {
        if (dismissed.has(i)) return null;
        const action = actionFor(insight);
        return (
          <Card key={i} className="!p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-xs font-medium uppercase tracking-wide ${SEVERITY_STYLE[insight.severity]}`}>
                  {TYPE_LABEL[insight.type]}
                </p>
                <p className="mt-1 text-ink">{insight.message}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4">
              {action && (
                <Link href={action.href} className="text-sm font-medium text-accent">
                  {action.label}
                </Link>
              )}
              <button
                type="button"
                onClick={() => setDismissed((prev) => new Set(prev).add(i))}
                className="text-sm text-ink-faint hover:text-ink"
              >
                Dismiss
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
