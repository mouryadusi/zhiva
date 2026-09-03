import { createClient } from '@/lib/supabase/server';
import { Section, Eyebrow } from '@/components/design-system/Primitives';
import { InsightsList } from '@/components/home/InsightsList';
import { generateInsights } from '@/lib/ai/insights';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let insights: Awaited<ReturnType<typeof generateInsights>> = [];
  let loadFailed = false;
  try {
    insights = await generateInsights(supabase, user.id);
  } catch (error) {
    console.error('[insights] generateInsights failed', error);
    loadFailed = true;
  }

  return (
    <main>
      <Section className="pb-4 pt-16 sm:pt-22">
        <Eyebrow>Insights</Eyebrow>
        <h1 className="mt-2 font-serif text-display-2 text-ink">Worth knowing</h1>
        <p className="mt-3 max-w-md text-ink-muted">
          Every insight here is detected from your real transactions — ranked by how much it
          matters, highest first. Home only ever shows the top one; everything is here.
        </p>
      </Section>
      <Section className="py-4 pb-24">
        {loadFailed ? (
          <p className="text-ink-muted">Couldn&apos;t load insights right now — try refreshing.</p>
        ) : (
          <InsightsList insights={insights} />
        )}
      </Section>
    </main>
  );
}
