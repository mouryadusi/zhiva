import { createClient } from '@/lib/supabase/server';
import { Section, Eyebrow } from '@/components/design-system/Primitives';
import { QuickAddTransaction } from '@/components/money/MoneyComponents';
import { TransactionsExplorer } from '@/components/money/TransactionsExplorer';
import { getDuplicateLikeTransactions } from '@/lib/ai/facts';
import { summarizeByCurrency, startOfMonth } from '@/lib/money';
import { processDueRecurringTransactions } from '@/lib/recurring';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  await processDueRecurringTransactions(supabase, user.id);

  const [{ data: categories }, { data: accounts }, { data: transactions }, duplicates] = await Promise.all([
    supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
    supabase.from('accounts').select('*').eq('user_id', user.id).eq('archived', false).order('created_at'),
    supabase.from('transactions').select('*').eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(200),
    // Reuses the existing fact-getter (src/lib/ai/facts.ts) — never a
    // second implementation of duplicate detection in UI code.
    getDuplicateLikeTransactions(supabase, user.id),
  ]);

  const duplicateIds = new Set(duplicates.value.flatMap((pair) => pair.map((t) => t.id)));

  const monthTotals = summarizeByCurrency(
    (transactions ?? []).filter((t) => new Date(t.occurred_at) >= startOfMonth())
  );

  // Merchant → most recently used category, built from the same
  // transactions already fetched above (no new query). Since the list
  // is ordered most-recent-first, the first match per merchant is the
  // most recent one. Scoped to the visible 200-transaction window —
  // an honest limit, not a full-history lookup.
  const merchantCategoryHistory = new Map<string, string>();
  for (const t of transactions ?? []) {
    if (!t.merchant || !t.category_id) continue;
    const key = t.merchant.trim().toLowerCase();
    if (!merchantCategoryHistory.has(key)) merchantCategoryHistory.set(key, t.category_id);
  }

  return (
    <main>
      <Section className="pb-2 pt-16 sm:pt-22">
        <div className="flex items-start justify-between">
          <div>
            <Eyebrow>Transactions</Eyebrow>
            <h1 className="mt-2 font-serif text-display-2 text-ink">All activity</h1>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <a href="/calendar" className="text-sm font-medium text-accent">
              Calendar →
            </a>
            <a href="/recurring" className="text-sm font-medium text-accent">
              Recurring →
            </a>
            <a href="/reports" className="text-sm font-medium text-accent">
              Reports →
            </a>
          </div>
        </div>
        {[...monthTotals.entries()].map(([currency, t]) => (
          <p key={currency} className="mt-2 text-sm text-ink-muted">
            {t.expense.toFixed(2)} {currency} spent this month
          </p>
        ))}
      </Section>

      <Section className="py-4">
        <QuickAddTransaction categories={categories ?? []} accounts={accounts ?? []} merchantCategoryHistory={merchantCategoryHistory} />
      </Section>

      <Section className="py-4 pb-24">
        <TransactionsExplorer
          transactions={transactions ?? []}
          categories={categories ?? []}
          accounts={accounts ?? []}
          duplicateIds={duplicateIds}
          initialCategoryId={searchParams.category}
          initialQuery={searchParams.q}
        />
      </Section>
    </main>
  );
}
