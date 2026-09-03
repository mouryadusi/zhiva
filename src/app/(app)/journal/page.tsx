import { createClient } from '@/lib/supabase/server';
import { Section, Eyebrow } from '@/components/design-system/Primitives';
import { JournalEditor, JournalHistory } from '@/components/journal/JournalComponents';

export const dynamic = 'force-dynamic';

export default async function JournalPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const activeDate = searchParams.date ?? new Date().toISOString().slice(0, 10);

  const [{ data: entry }, { data: recent }] = await Promise.all([
    supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('entry_date', activeDate)
      .maybeSingle(),
    supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false })
      .limit(60),
  ]);

  const isToday = activeDate === new Date().toISOString().slice(0, 10);
  const dateLabel = new Date(activeDate + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main>
      <Section className="pb-4 pt-16 sm:pt-22">
        <Eyebrow>{isToday ? 'Today' : 'Journal'}</Eyebrow>
        <h1 className="mt-2 font-serif text-display-2 text-ink">
          {isToday ? 'Journal' : dateLabel}
        </h1>
        {!isToday && (
          <a href="/journal" className="mt-2 inline-block text-sm font-medium text-accent">
            ← Back to today
          </a>
        )}
      </Section>
      <Section className="py-4">
        <JournalEditor entry={entry ?? null} entryDate={activeDate} dateLabel={dateLabel} />
        <JournalHistory entries={recent ?? []} activeDate={activeDate} />
      </Section>
    </main>
  );
}
