import { createClient } from '@/lib/supabase/server';
import { Section, Eyebrow } from '@/components/design-system/Primitives';
import { EmptyState } from '@/components/design-system/EmptyState';
import { QuickAddGoal, GoalList } from '@/components/tasks/GoalComponents';
import { FinancialGoalCard } from '@/components/tasks/FinancialGoalCard';
import { getMonthlyNetTrend, projectGoalCompletion } from '@/lib/ai/facts';

export const dynamic = 'force-dynamic';

export default async function GoalsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: goals } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  // If this fails (e.g. a migration hasn't been applied yet), goals
  // themselves should still load — projectGoalCompletion already
  // handles an empty trend gracefully (falls back to "no current pace
  // to project from" rather than a fabricated number), so an empty
  // array here degrades honestly instead of crashing the page.
  let trend: Awaited<ReturnType<typeof getMonthlyNetTrend>> = { value: [], kind: 'actual' };
  try {
    trend = await getMonthlyNetTrend(supabase, user.id, 3);
  } catch (error) {
    console.error('[goals] getMonthlyNetTrend failed', error);
  }

  const financialGoals = (goals ?? []).filter((g) => g.domain === 'financial');
  const lifeGoals = (goals ?? []).filter((g) => g.domain === 'life');
  const netPoints = trend.value.map((p) => p.net);

  return (
    <main>
      <Section className="pb-4 pt-16 sm:pt-22">
        <Eyebrow>Goals</Eyebrow>
        <h1 className="mt-2 font-serif text-display-2 text-ink">What you're moving toward</h1>
      </Section>

      <Section className="py-4">
        <Eyebrow>Financial</Eyebrow>
        {financialGoals.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="Give yourself something worth saving for."
              description="Set a target amount and ZHIVA will project a realistic timeline from your actual cash flow — never a guess."
            />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {financialGoals.map((g) => (
              <FinancialGoalCard
                key={g.id}
                goal={g}
                projection={g.target_value != null ? projectGoalCompletion(g, netPoints).value : null}
              />
            ))}
          </div>
        )}
      </Section>

      <Section className="py-2">
        <QuickAddGoal />
      </Section>

      <Section className="py-4 pb-24">
        <Eyebrow>Life</Eyebrow>
        <GoalList goals={lifeGoals} />
      </Section>
    </main>
  );
}
