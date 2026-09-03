import { createClient } from '@/lib/supabase/server';
import {
  GreetingHeader,
  NextActionCard,
  BalanceCard,
  MoneyFlowCard,
  TodayPriority,
  ProgressSection,
  MonthEndProjectionCard,
  RecentTransactions,
  ReflectionPrompt,
} from '@/components/home/HomeSections';
import { BudgetsSection } from '@/components/money/BudgetsSection';
import { Section, Eyebrow } from '@/components/design-system/Primitives';
import { summarizeByCurrency, totalsByCategory, sumAccountBalances, startOfMonth } from '@/lib/money';
import { generateInsights } from '@/lib/ai/insights';
import { getMonthEndProjection, getMonthlyNetTrend } from '@/lib/ai/facts';
import { NetTrendChart } from '@/components/home/NetTrendChart';
import { determineNextAction } from '@/lib/next-action';
import { processDueRecurringTransactions } from '@/lib/recurring';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null; // middleware already redirects; guards TS narrowing here

  // Idempotent — see src/lib/recurring.ts. Runs before any other query
  // below so a due rent/salary/subscription that just generated is
  // reflected in this same page load's totals, not the next one.
  //
  // Wrapped defensively: if the migration that added recurring
  // generation (0003) hasn't been run against this Supabase project,
  // or any other transient issue occurs here, Home should still load
  // with everything else intact rather than crashing the whole
  // dashboard over one subsystem. The real error is logged
  // server-side so it's still visible in your terminal/Vercel logs.
  try {
    await processDueRecurringTransactions(supabase, user.id);
  } catch (error) {
    console.error('[home] processDueRecurringTransactions failed', error);
  }

  const monthStart = startOfMonth();

  const [
    { data: profile },
    { data: tasks },
    { data: goals },
    { data: monthTransactions },
    { data: recentTransactions },
    { data: categories },
    { data: accounts },
    { data: allTransactionsForBalance },
    { data: budgets },
    { data: journalToday },
    { data: postponedTasks },
  ] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('scope', 'today')
      .is('completed_at', null)
      .order('priority', { ascending: false })
      .order('due_at', { ascending: true }),
    supabase.from('goals').select('*').eq('user_id', user.id).eq('status', 'active'),
    // No .limit() — undercounting a monthly total is a correctness bug,
    // not a display nitpick.
    supabase
      .from('transactions')
      .select('kind, amount, currency, category_id')
      .eq('user_id', user.id)
      .gte('occurred_at', monthStart.toISOString()),
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('occurred_at', { ascending: false })
      .limit(4),
    supabase.from('categories').select('*').eq('user_id', user.id),
    supabase.from('accounts').select('*').eq('user_id', user.id).eq('archived', false),
    supabase.from('transactions').select('kind, amount, account_id, transfer_account_id').eq('user_id', user.id),
    supabase.from('budgets').select('*').eq('user_id', user.id),
    supabase
      .from('journal_entries')
      .select('id')
      .eq('user_id', user.id)
      .eq('entry_date', new Date().toISOString().slice(0, 10))
      .maybeSingle(),
    // Surfaces the single most-postponed unfinished task as a gentle
    // nudge, rather than showing every feature at once.
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .is('completed_at', null)
      .gte('postponed_count', 2)
      .order('postponed_count', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // These three call into src/lib/ai/facts.ts and src/lib/ai/insights.ts,
  // which now correctly throw on a failed query instead of silently
  // returning empty data (a real fix — see facts.ts). That's the right
  // behavior for those functions themselves, but Home aggregates many
  // independent features on one screen, so a failure in "insights"
  // shouldn't take down "balance" or "tasks" too. Each gets its own
  // honest fallback instead of a shared crash.
  let insights: Awaited<ReturnType<typeof generateInsights>> = [];
  try {
    insights = await generateInsights(supabase, user.id);
  } catch (error) {
    console.error('[home] generateInsights failed', error);
  }

  let projection: Awaited<ReturnType<typeof getMonthEndProjection>> | null = null;
  try {
    projection = await getMonthEndProjection(supabase, user.id);
  } catch (error) {
    console.error('[home] getMonthEndProjection failed', error);
  }

  let netTrend: Awaited<ReturnType<typeof getMonthlyNetTrend>> = { value: [], kind: 'actual' };
  try {
    netTrend = await getMonthlyNetTrend(supabase, user.id, 6);
  } catch (error) {
    console.error('[home] getMonthlyNetTrend failed', error);
  }

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Same math every money screen uses (src/lib/money.ts, src/lib/ai/facts.ts)
  // — nothing here is computed locally.
  const currencyTotals = summarizeByCurrency(monthTransactions ?? []);
  const hasMultipleCurrencies = currencyTotals.size > 1;
  const singleCurrencyTotal = currencyTotals.size === 1 ? [...currencyTotals.values()][0] : null;
  const primaryCurrency = accounts?.[0]?.currency ?? 'USD';

  const totalBalance = sumAccountBalances(accounts ?? [], allTransactionsForBalance ?? []);

  const categoryTotals = totalsByCategory(monthTransactions ?? [], 'expense');
  const categoryNameById = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const topCategoryEntry = [...categoryTotals.entries()]
    .filter(([id]) => id !== null)
    .sort((a, b) => b[1] - a[1])[0];

  // The insight engine can surface several candidate insights — Home
  // deliberately shows only the single highest-severity one.
  const topInsight = insights[0] ?? null;

  const hasMonthData = (monthTransactions ?? []).length > 0;
  const nextAction = determineNextAction(topInsight, tasks ?? [], postponedTasks ?? null);

  return (
    <main>
      <GreetingHeader name={profile?.display_name ?? null} dateLabel={dateLabel} />

      <NextActionCard action={nextAction} />

      <BalanceCard balance={totalBalance} currency={primaryCurrency} hasMultipleCurrencies={hasMultipleCurrencies} />

      <MoneyFlowCard
        income={singleCurrencyTotal?.income ?? 0}
        expense={singleCurrencyTotal?.expense ?? 0}
        net={singleCurrencyTotal?.net ?? 0}
        currency={primaryCurrency}
        hasMultipleCurrencies={hasMultipleCurrencies}
        topCategoryName={topCategoryEntry ? categoryNameById.get(topCategoryEntry[0]!) ?? null : null}
        topCategoryAmount={topCategoryEntry?.[1] ?? null}
      />

      {!hasMultipleCurrencies && netTrend.value.some((p) => p.net !== 0) && (
        <Section className="py-4">
          <NetTrendChart
            trend={netTrend.value}
            projectedNet={hasMonthData && projection ? projection.value.projectedMonthEndNet : null}
            currency={primaryCurrency}
          />
        </Section>
      )}

      {!hasMultipleCurrencies && (budgets ?? []).length > 0 && (
        <Section className="py-8">
          <div className="flex items-center justify-between">
            <Eyebrow>Budget status</Eyebrow>
            <a href="/budgets" className="text-sm font-medium text-accent">
              See all
            </a>
          </div>
          <div className="mt-3">
            <BudgetsSection
              budgets={budgets ?? []}
              categories={categories ?? []}
              monthTransactions={monthTransactions ?? []}
              currency={primaryCurrency}
              compact
            />
          </div>
        </Section>
      )}

      {projection && (
        <MonthEndProjectionCard
          projectedExpense={projection.value.projectedMonthExpense}
          projectedNet={projection.value.projectedMonthEndNet}
          currency={primaryCurrency}
          hasData={hasMonthData && !hasMultipleCurrencies}
        />
      )}

      <ProgressSection goals={goals ?? []} />
      <TodayPriority tasks={tasks ?? []} />
      <RecentTransactions transactions={recentTransactions ?? []} categoryNameById={categoryNameById} />
      <ReflectionPrompt hasEntryToday={Boolean(journalToday)} />
    </main>
  );
}
