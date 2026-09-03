import { createClient } from '@/lib/supabase/server';
import { Section, Eyebrow } from '@/components/design-system/Primitives';
import { BudgetsSection } from '@/components/money/BudgetsSection';
import { startOfMonth } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function BudgetsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const monthStart = startOfMonth();

  const [{ data: budgets }, { data: categories }, { data: accounts }, { data: monthTransactions }] = await Promise.all([
    supabase.from('budgets').select('*').eq('user_id', user.id),
    supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
    supabase.from('accounts').select('currency').eq('user_id', user.id).limit(1),
    supabase
      .from('transactions')
      .select('kind, amount, category_id')
      .eq('user_id', user.id)
      .gte('occurred_at', monthStart.toISOString()),
  ]);

  const primaryCurrency = accounts?.[0]?.currency ?? 'USD';

  return (
    <main>
      <Section className="pb-4 pt-16 sm:pt-22">
        <Eyebrow>Budgets</Eyebrow>
        <h1 className="mt-2 font-serif text-display-2 text-ink">Am I okay?</h1>
      </Section>

      <Section className="py-4 pb-24">
        <BudgetsSection
          budgets={budgets ?? []}
          categories={categories ?? []}
          monthTransactions={monthTransactions ?? []}
          currency={primaryCurrency}
        />
      </Section>
    </main>
  );
}
