import { createClient } from '@/lib/supabase/server';
import { Section, Eyebrow } from '@/components/design-system/Primitives';
import { CalendarGrid } from '@/components/money/CalendarGrid';

export const dynamic = 'force-dynamic';

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const now = new Date();
  const [year, month] = (searchParams.month ?? `${now.getFullYear()}-${now.getMonth() + 1}`).split('-').map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const [{ data: transactions }, { data: accounts }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('occurred_at', monthStart.toISOString())
      .lt('occurred_at', monthEnd.toISOString())
      .order('occurred_at', { ascending: true }),
    supabase.from('accounts').select('id, currency').eq('user_id', user.id).limit(1),
  ]);

  return (
    <main>
      <Section className="pb-4 pt-16 sm:pt-22">
        <Eyebrow>Calendar</Eyebrow>
        <h1 className="mt-2 font-serif text-display-2 text-ink">
          {monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h1>
      </Section>
      <Section className="py-4 pb-24">
        <CalendarGrid
          monthStart={monthStart}
          transactions={transactions ?? []}
          currency={accounts?.[0]?.currency ?? 'USD'}
        />
      </Section>
    </main>
  );
}
