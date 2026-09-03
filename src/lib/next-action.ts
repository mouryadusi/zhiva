import type { Task } from '@/types/database';
import type { Insight } from '@/lib/ai/insights';

export interface NextAction {
  kind: 'insight' | 'task' | 'postponed' | 'none';
  title: string;
  detail: string;
  href: string;
}

/**
 * Home shows several signals (today's tasks, the top insight, a
 * postponed-task nudge) — each useful on its own, but none of them
 * alone answers "what should I do next?" the way the product is
 * supposed to. This picks exactly one, by a fixed, inspectable
 * priority order, from data already fetched elsewhere on Home. It
 * doesn't fetch or compute anything new — it only orders what's
 * already real.
 */
export function determineNextAction(
  topInsight: Insight | null,
  todayTasks: Task[],
  postponedTask: Task | null
): NextAction {
  if (topInsight && topInsight.severity === 'high') {
    return {
      kind: 'insight',
      title: topInsight.message,
      detail: 'This is the most urgent thing ZHIVA has flagged.',
      href: '/insights',
    };
  }

  const overdueOrHighPriority = todayTasks.find(
    (t) => t.priority === 'high' || (t.due_at != null && new Date(t.due_at) < new Date())
  );
  if (overdueOrHighPriority) {
    return {
      kind: 'task',
      title: overdueOrHighPriority.title,
      detail: overdueOrHighPriority.due_at
        ? new Date(overdueOrHighPriority.due_at) < new Date()
          ? 'Overdue'
          : 'Due today'
        : 'High priority, due today',
      href: '/tasks',
    };
  }

  if (topInsight) {
    return {
      kind: 'insight',
      title: topInsight.message,
      detail: 'Worth a look when you have a minute.',
      href: '/insights',
    };
  }

  if (postponedTask) {
    return {
      kind: 'postponed',
      title: postponedTask.title,
      detail: `Postponed ${postponedTask.postponed_count} times`,
      href: '/tasks',
    };
  }

  if (todayTasks.length > 0) {
    return {
      kind: 'task',
      title: todayTasks[0]!.title,
      detail: 'On today\'s list',
      href: '/tasks',
    };
  }

  return { kind: 'none', title: '', detail: '', href: '' };
}
