import { createClient } from '@/lib/supabase/server';
import { Section, Eyebrow } from '@/components/design-system/Primitives';
import { RecurringManager } from '@/components/money/RecurringManager';

export const dynamic = 'force-dynamic';

export default async function RecurringPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: rules }, { data: accounts }, { data: categories }] = await Promise.all([
    supabase.from('recurring_transactions').select('*').eq('user_id', user.id).order('next_run_at', { ascending: true }),
    supabase.from('accounts').select('*').eq('user_id', user.id).eq('archived', false).order('created_at'),
    supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
  ]);

  return (
    <main>
      <Section className="pb-4 pt-16 sm:pt-22">
        <Eyebrow>Transactions</Eyebrow>
        <h1 className="mt-2 font-serif text-display-2 text-ink">Recurring</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Rent, salary, subscriptions — set them up once and ZHIVA keeps them current.
        </p>
      </Section>
      <Section className="py-4 pb-24">
        <RecurringManager rules={rules ?? []} accounts={accounts ?? []} categories={categories ?? []} />
      </Section>
    </main>
  );
}
