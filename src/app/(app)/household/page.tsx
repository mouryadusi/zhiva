import { createClient } from '@/lib/supabase/server';
import { Section, Eyebrow } from '@/components/design-system/Primitives';
import { HouseholdManager } from '@/components/security/HouseholdManager';

export const dynamic = 'force-dynamic';

interface HouseholdMembershipRow {
  role: 'owner' | 'member';
  households: { id: string; name: string; created_by: string } | null;
}

export default async function HouseholdPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from('household_members')
    .select('role, households(id, name, created_by)')
    .eq('user_id', user.id)
    .returns<HouseholdMembershipRow[]>();

  return (
    <main>
      <Section className="pb-4 pt-16 sm:pt-22">
        <Eyebrow>You</Eyebrow>
        <h1 className="mt-2 font-serif text-display-2 text-ink">Household</h1>
      </Section>
      <Section className="py-4 pb-24">
        <HouseholdManager memberships={memberships ?? []} />
      </Section>
    </main>
  );
}
