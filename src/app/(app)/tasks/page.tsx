import { createClient } from '@/lib/supabase/server';
import { Section, Eyebrow } from '@/components/design-system/Primitives';
import { QuickAddTask, ScopeTabs, TaskList } from '@/components/tasks/TaskComponents';

export const dynamic = 'force-dynamic';

// 'life' scope moved to the dedicated /goals page (financial + life
// goals both live there now); day-to-day tasks stay here.
const VALID_SCOPES = ['today', 'week', 'month'] as const;
type Scope = (typeof VALID_SCOPES)[number];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: { scope?: string };
}) {
  const scope: Scope = VALID_SCOPES.includes(searchParams.scope as Scope)
    ? (searchParams.scope as Scope)
    : 'today';

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('scope', scope)
    .order('completed_at', { ascending: true, nullsFirst: true })
    .order('priority', { ascending: false });

  return (
    <main>
      <Section className="pb-4 pt-16 sm:pt-22">
        <Eyebrow>Tasks</Eyebrow>
        <h1 className="mt-2 font-serif text-display-2 text-ink">What&apos;s next</h1>
      </Section>
      <Section className="py-4 pb-24">
        <ScopeTabs active={scope} />
        <div className="mt-6">
          <QuickAddTask scope={scope} />
          <TaskList tasks={tasks ?? []} />
        </div>
      </Section>
    </main>
  );
}
