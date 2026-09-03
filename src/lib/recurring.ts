import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecurringTransaction } from '@/types/database';

// A hard ceiling on how many missed occurrences a single processing
// pass will catch up on for one rule. Without this, a rule that's been
// active but unprocessed for years (e.g. a demo account nobody opened)
// could generate thousands of rows in one request. 24 covers "opened
// the app after 2 years of a monthly rule" with room to spare; anyone
// hitting the ceiling gets caught up incrementally on their next visit
// rather than all at once.
const MAX_CATCH_UP_OCCURRENCES = 24;

export function advanceDate(date: Date, cadence: RecurringTransaction['cadence']): Date {
  const next = new Date(date);
  switch (cadence) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      return next;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      return next;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      return next;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      return next;
    case 'custom':
    default:
      // No general-purpose recurrence-rule parser exists in this
      // codebase — a custom cadence is accepted at creation time but
      // never auto-advanced. It stays due (and gets flagged in the UI)
      // until the user manually updates or removes it. This is an
      // honest limitation, not a silent failure: never guessing at
      // what a free-text custom rule means.
      return next;
  }
}

export interface ProcessResult {
  processed: number;
  generated: number;
  skippedCustom: number;
}

/**
 * Generates real `transactions` rows for every recurring rule whose
 * next_run_at has arrived, for one user. Safe to call on every page
 * load: the unique index on (recurring_transaction_id, occurrence_date)
 * makes a duplicate insert impossible even under a race, and this
 * function additionally checks before inserting so the common case
 * never even attempts a doomed insert.
 *
 * Idempotent by construction: calling this twice in a row for the same
 * user produces the exact same set of transactions as calling it once.
 */
export async function processDueRecurringTransactions(
  supabase: SupabaseClient,
  userId: string
): Promise<ProcessResult> {
  const today = new Date();
  today.setHours(23, 59, 59, 999); // due "today" counts as due

  const { data: dueRules } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .lte('next_run_at', today.toISOString().slice(0, 10));

  let generated = 0;
  let skippedCustom = 0;

  for (const rule of (dueRules ?? []) as RecurringTransaction[]) {
    if (rule.cadence === 'custom') {
      skippedCustom += 1;
      continue;
    }

    let occurrenceDate = new Date(rule.next_run_at);
    let iterations = 0;
    let latestNextRun = occurrenceDate;

    while (occurrenceDate <= today && iterations < MAX_CATCH_UP_OCCURRENCES) {
      const occurrenceDateStr = occurrenceDate.toISOString().slice(0, 10);

      // Application-level check first — avoids a doomed insert in the
      // common case. The unique index (migration 0003) is the real
      // guarantee if this check and the insert ever race.
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('recurring_transaction_id', rule.id)
        .eq('occurrence_date', occurrenceDateStr)
        .maybeSingle();

      if (!existing) {
        const { error: insertError } = await supabase.from('transactions').insert({
          user_id: userId,
          kind: rule.kind,
          amount: rule.amount,
          currency: rule.currency,
          account_id: rule.account_id,
          category_id: rule.category_id,
          merchant: rule.merchant,
          occurred_at: occurrenceDate.toISOString(),
          is_recurring: true,
          recurring_transaction_id: rule.id,
          occurrence_date: occurrenceDateStr,
        });
        // A unique-violation here means another concurrent call already
        // generated this exact occurrence — that's success, not a bug,
        // so it's deliberately not surfaced as an error.
        if (!insertError) generated += 1;
      }

      latestNextRun = advanceDate(occurrenceDate, rule.cadence);
      occurrenceDate = latestNextRun;
      iterations += 1;
    }

    await supabase
      .from('recurring_transactions')
      .update({ next_run_at: latestNextRun.toISOString().slice(0, 10) })
      .eq('id', rule.id)
      .eq('user_id', userId);
  }

  return { processed: dueRules?.length ?? 0, generated, skippedCustom };
}
