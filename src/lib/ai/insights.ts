import type { SupabaseClient } from '@supabase/supabase-js';
import { totalsByCategory, computeBudgetProgress, overallExpenseTotal, startOfMonth } from '@/lib/money';
import {
  getMonthlyNetTrend,
  getCategoryBreakdown,
  getUpcomingRecurring,
  getDuplicateLikeTransactions,
  getSubscriptionLikeMerchants,
} from './facts';

export type InsightSeverity = 'high' | 'medium' | 'low';

export interface Insight {
  type:
    | 'budget_risk'
    | 'unusual_category'
    | 'declining_balance'
    | 'large_upcoming_obligation'
    | 'possible_duplicate'
    | 'undetected_subscription';
  severity: InsightSeverity;
  message: string;
  evidence: Record<string, unknown>;
}

const SEVERITY_RANK: Record<InsightSeverity, number> = { high: 3, medium: 2, low: 1 };

/**
 * Runs every detector and returns insights ranked by severity (highest
 * first). Deliberately does NOT cap the list here — that's a display
 * decision, not a data decision, and belongs to the caller (Home shows
 * at most 1, Money's insights panel could show more).
 */
export async function generateInsights(supabase: SupabaseClient, userId: string): Promise<Insight[]> {
  const insights: Insight[] = [];

  const [budgetRisk, unusual, decline, obligation, duplicates, undetectedSubs] = await Promise.all([
    detectBudgetRisk(supabase, userId),
    detectUnusualCategory(supabase, userId),
    detectDecliningBalance(supabase, userId),
    detectLargeUpcomingObligation(supabase, userId),
    detectPossibleDuplicates(supabase, userId),
    detectUndetectedSubscriptions(supabase, userId),
  ]);

  for (const i of [budgetRisk, unusual, decline, obligation, duplicates, undetectedSubs]) {
    if (i) insights.push(i);
  }

  return insights.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

async function detectBudgetRisk(supabase: SupabaseClient, userId: string): Promise<Insight | null> {
  const [{ data: budgets }, breakdown] = await Promise.all([
    supabase.from('budgets').select('*').eq('user_id', userId).eq('period', 'monthly'),
    getCategoryBreakdown(supabase, userId, startOfMonth()),
  ]);
  if (!budgets || budgets.length === 0) return null;

  const overallSpend = overallExpenseTotal(breakdown.value);
  const worst = computeBudgetProgress(budgets, breakdown.value, overallSpend).sort((a, b) => b.pct - a.pct)[0];

  if (!worst || worst.pct < 0.9) return null;

  return {
    type: 'budget_risk',
    severity: worst.pct >= 1 ? 'high' : 'medium',
    message:
      worst.pct >= 1
        ? `${worst.name} is over budget: ${worst.spent.toFixed(2)} of ${worst.limit.toFixed(2)}.`
        : `${worst.name} is close to its budget: ${worst.spent.toFixed(2)} of ${worst.limit.toFixed(2)} (${Math.round(worst.pct * 100)}%).`,
    evidence: worst,
  };
}

async function detectUnusualCategory(supabase: SupabaseClient, userId: string): Promise<Insight | null> {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const { data: recent } = await supabase
    .from('transactions')
    .select('amount, category_id, occurred_at')
    .eq('user_id', userId)
    .eq('kind', 'expense')
    .gte('occurred_at', threeMonthsAgo.toISOString());

  if (!recent || recent.length < 6) return null;

  const monthStart = startOfMonth();
  const thisMonth = recent.filter((t) => new Date(t.occurred_at) >= monthStart);
  const prior = recent.filter((t) => new Date(t.occurred_at) < monthStart);
  const thisTotals = totalsByCategory(thisMonth, 'expense');
  const priorTotals = totalsByCategory(prior, 'expense');

  const flagged = [...thisTotals.entries()]
    .filter(([id]) => id !== null)
    .map(([id, amount]) => ({ id, amount, priorAvg: (priorTotals.get(id) ?? 0) / 2 }))
    .filter((c) => c.priorAvg > 0 && c.amount / c.priorAvg >= 1.5)
    .sort((a, b) => b.amount / b.priorAvg - a.amount / a.priorAvg)[0];

  if (!flagged) return null;

  const { data: categories } = await supabase.from('categories').select('id, name').eq('id', flagged.id);
  const name = categories?.[0]?.name ?? 'A category';

  return {
    type: 'unusual_category',
    severity: 'medium',
    message: `${name} is running higher than usual this month: ${flagged.amount.toFixed(2)} vs. a typical ${flagged.priorAvg.toFixed(2)}.`,
    evidence: flagged,
  };
}

async function detectDecliningBalance(supabase: SupabaseClient, userId: string): Promise<Insight | null> {
  const trend = await getMonthlyNetTrend(supabase, userId, 3);
  const points = trend.value;
  if (points.length < 3) return null;
  const allNegative = points.every((p) => p.net < 0);
  const consistentlyDeclining = points[2]!.net < points[1]!.net && points[1]!.net < points[0]!.net;

  if (!allNegative && !consistentlyDeclining) return null;

  return {
    type: 'declining_balance',
    severity: allNegative ? 'high' : 'medium',
    message: allNegative
      ? `You've spent more than you've earned for ${points.length} months in a row.`
      : `Your monthly net has declined for ${points.length} months in a row (${points.map((p) => p.net.toFixed(0)).join(' → ')}).`,
    evidence: { points },
  };
}

async function detectLargeUpcomingObligation(supabase: SupabaseClient, userId: string): Promise<Insight | null> {
  const upcoming = await getUpcomingRecurring(supabase, userId, 7);
  const expenses = upcoming.value.filter((r) => r.kind === 'expense');
  if (expenses.length === 0) return null;

  const largest = expenses.sort((a, b) => b.amount - a.amount)[0]!;
  const others = expenses.filter((e) => e !== largest);
  const avgOthers = others.length ? others.reduce((s, e) => s + e.amount, 0) / others.length : 0;
  if (avgOthers > 0 && largest.amount < avgOthers * 1.5) return null; // not unusually large

  return {
    type: 'large_upcoming_obligation',
    severity: 'medium',
    message: `${largest.merchant ?? 'A recurring payment'} of ${largest.amount.toFixed(2)} is due ${largest.nextRunAt}.`,
    evidence: largest,
  };
}

async function detectPossibleDuplicates(supabase: SupabaseClient, userId: string): Promise<Insight | null> {
  const groups = await getDuplicateLikeTransactions(supabase, userId);
  if (groups.value.length === 0) return null;
  const first = groups.value[0]!;
  return {
    type: 'possible_duplicate',
    severity: 'medium',
    message: `Possible duplicate: ${first[0]!.merchant ?? 'an expense'} at ${Number(first[0]!.amount).toFixed(2)} appears twice within 48 hours.`,
    evidence: { count: groups.value.length, example: first },
  };
}

async function detectUndetectedSubscriptions(supabase: SupabaseClient, userId: string): Promise<Insight | null> {
  const [candidates, { data: recurring }] = await Promise.all([
    getSubscriptionLikeMerchants(supabase, userId),
    supabase.from('recurring_transactions').select('merchant').eq('user_id', userId),
  ]);
  const known = new Set((recurring ?? []).map((r) => r.merchant));
  const undetected = candidates.value.filter((c) => !known.has(c.merchant));
  if (undetected.length === 0) return null;

  const top = undetected[0]!;
  return {
    type: 'undetected_subscription',
    severity: 'low',
    message: `${top.merchant} looks like a recurring charge (~${top.averageAmount.toFixed(2)}, seen ${top.monthsSeen} months) but isn't set up as recurring. Want to track it?`,
    evidence: top,
  };
}
