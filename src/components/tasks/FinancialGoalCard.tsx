'use client';

import { useState } from 'react';
import { Card, ProgressBar } from '@/components/design-system/Primitives';
import { ProvenanceBadge } from '@/components/design-system/ProvenanceBadge';
import { LabeledInput } from '@/components/design-system/Field';
import type { GoalProjection } from '@/lib/ai/facts';
import type { Goal } from '@/types/database';

export function FinancialGoalCard({ goal, projection }: { goal: Goal; projection: GoalProjection | null }) {
  const [whatIf, setWhatIf] = useState('');
  const whatIfAmount = Number(whatIf);
  const remaining = projection?.remaining ?? (goal.target_value ?? 0) - goal.current_value;
  // A genuine what-if: the user's own hypothetical monthly amount, not
  // their real average pace (that's `projection` above). Hypothetical,
  // not a projection — nothing here claims this pace is likely, only
  // what it would mean if it held.
  const whatIfMonths = whatIfAmount > 0 && remaining > 0 ? remaining / whatIfAmount : null;

  return (
    <Card className="!p-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <p className="font-medium text-ink">{goal.title}</p>
        {goal.target_value != null && (
          <p className="text-sm text-ink-faint">
            {goal.current_value}
            {goal.unit ?? ''} of {goal.target_value}
            {goal.unit ?? ''}
          </p>
        )}
      </div>
      {goal.target_value != null && <ProgressBar value={goal.current_value} max={goal.target_value} />}

      {projection && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-muted">
              {projection.remaining > 0 ? `${projection.remaining.toFixed(2)}${goal.unit ?? ''} remaining` : 'Goal reached'}
            </p>
            <ProvenanceBadge kind="projection" />
          </div>
          {projection.monthsAtCurrentPace != null ? (
            <p className="mt-1 text-sm text-ink">
              At your recent average of {projection.averageMonthlyNet.toFixed(2)}/month, that&apos;s about{' '}
              <span className="font-medium">
                {Math.ceil(projection.monthsAtCurrentPace)} month{Math.ceil(projection.monthsAtCurrentPace) === 1 ? '' : 's'}
              </span>{' '}
              away.
            </p>
          ) : projection.remaining > 0 ? (
            <p className="mt-1 text-sm text-ink">
              Your recent months haven&apos;t had a positive net, so there&apos;s no current pace to project from.
            </p>
          ) : null}
        </div>
      )}

      {remaining > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink">What if I saved a set amount each month?</p>
            <ProvenanceBadge kind="hypothetical" showActual />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <LabeledInput
              label={`Monthly amount toward ${goal.title}`}
              labelVisible={false}
              type="number"
              placeholder={`e.g. 100${goal.unit ?? ''}`}
              value={whatIf}
              onChange={(e) => setWhatIf(e.target.value)}
              containerClassName="w-32"
            />
            <span className="text-sm text-ink-muted">{goal.unit ?? ''}/month</span>
          </div>
          {whatIfMonths != null && (
            <p className="mt-2 text-sm text-ink">
              At {whatIfAmount}
              {goal.unit ?? ''}/month, you&apos;d reach this goal in{' '}
              <span className="font-medium">
                {Math.ceil(whatIfMonths)} month{Math.ceil(whatIfMonths) === 1 ? '' : 's'}
              </span>
              .
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
