import type { SupabaseClient } from '@supabase/supabase-js';
import { totalsByCategory, computeBudgetProgress, overallExpenseTotal, startOfMonth, startOfPreviousMonth, startOfWeek, startOfMonthsAgo } from '@/lib/money';
import type { DetectedIntent } from './intent';
import {
  getPeriodTotals,
  getCategoryBreakdown,
  diffCategoryBreakdowns,
  getMonthlyNetTrend,
  getUpcomingRecurring,
  getDuplicateLikeTransactions,
  getMonthEndProjection,
  projectGoalCompletion,
} from './facts';

// Architecture (per spec): question -> intent -> structured query against
// real data -> verified numeric result -> template-based explanation.
// There is no generative model in this file. That is deliberate: it is
// the only way to structurally guarantee the "never invent numbers"
// requirement rather than just instructing a model not to.
//
// The functions below fall into two tiers:
//   - single-fact handlers (topCategoryThisMonth, categorySpend, etc.)
//     that existed before this pass and are unchanged, per instruction
//     not to disturb working deterministic logic.
//   - composed handlers (moneyFlowOverview, balanceTrend,
//     sixMonthChanges, monthEndProjection, savingsNeededForGoal,
//     whatToCut, duplicateTransactions, scenarioReduceCategory) that
//     gather several facts from src/lib/ai/facts.ts and reason over
//     them together — this is the "multi-step financial reasoning"
//     layer: the model still never computes a number, it only explains
//     numbers that were composed by plain code.

export interface AssistantAnswer {
  text: string;
  // The exact figures the sentence above is built from, so the UI can
  // show them plainly and a user can verify the claim isn't invented.
  evidence: Record<string, unknown>;
}

const NO_DATA: AssistantAnswer = {
  text: "I don't have enough information to determine that.",
  evidence: {},
};

export async function answerFinancialQuestion(
  supabase: SupabaseClient,
  userId: string,
  detected: DetectedIntent
): Promise<AssistantAnswer> {
  switch (detected.intent) {
    case 'top_category_month':
      return topCategoryThisMonth(supabase, userId);
    case 'category_spend':
      return categorySpend(supabase, userId, detected.categoryHint);
    case 'compare_months':
      return compareMonths(supabase, userId);
    case 'subscriptions':
      return listSubscriptions(supabase, userId);
    case 'budget_status':
      return budgetStatus(supabase, userId);
    case 'can_afford':
      return canAffordEstimate(supabase, userId, detected.amountHint);
    case 'upcoming_recurring':
      return upcomingRecurring(supabase, userId);
    case 'biggest_expenses':
      return biggestExpenses(supabase, userId);
    case 'unusual_spending':
      return unusualSpending(supabase, userId);
    case 'goal_progress':
      return goalProgress(supabase, userId);
    case 'money_flow_overview':
      return moneyFlowOverview(supabase, userId);
    case 'balance_trend':
      return balanceTrend(supabase, userId);
    case 'six_month_changes':
      return sixMonthChanges(supabase, userId);
    case 'month_end_projection':
      return monthEndProjectionAnswer(supabase, userId);
    case 'savings_needed_for_goal':
      return savingsNeededForGoal(supabase, userId);
    case 'what_to_cut':
      return whatToCut(supabase, userId);
    case 'duplicate_transactions':
      return duplicateTransactionsAnswer(supabase, userId);
    case 'scenario_reduce_category':
      return scenarioReduceCategory(supabase, userId, detected.categoryHint, detected.percentHint);
    case 'unrecognized':
    default:
      return {
        text:
          "I can help with questions about spending, budgets, subscriptions, and affordability — " +
          'try something like "Where did I spend the most this month?" or "Compare this month with last month."',
        evidence: {},
      };
  }
}

async function topCategoryThisMonth(supabase: SupabaseClient, userId: string): Promise<AssistantAnswer> {
  const { data: transactions } = await supabase
    .from('transactions')
    .select('kind, amount, category_id')
    .eq('user_id', userId)
    .gte('occurred_at', startOfMonth().toISOString());

  const { data: categories } = await supabase.from('categories').select('id, name').eq('user_id', userId);

  const totals = totalsByCategory(transactions ?? [], 'expense');
  const top = [...totals.entries()].filter(([id]) => id !== null).sort((a, b) => b[1] - a[1])[0];

  if (!top) return NO_DATA;

  const name = categories?.find((c) => c.id === top[0])?.name ?? 'that category';
  const total = [...totals.values()].reduce((s, v) => s + v, 0);
  const share = total > 0 ? Math.round((top[1] / total) * 100) : 0;

  return {
    text: `${name} is where you spent the most this month, at ${top[1].toFixed(2)} — about ${share}% of your total spending.`,
    evidence: { category: name, amount: top[1], sharePercent: share, totalSpend: total },
  };
}

async function categorySpend(
  supabase: SupabaseClient,
  userId: string,
  categoryHint?: string
): Promise<AssistantAnswer> {
  if (!categoryHint) return NO_DATA;

  const { data: categories } = await supabase.from('categories').select('id, name').eq('user_id', userId);
  const match = categories?.find((c) => c.name.toLowerCase().includes(categoryHint.toLowerCase()));
  if (!match) {
    return {
      text: `I couldn't find a category matching "${categoryHint}" in your account.`,
      evidence: { categoryHint },
    };
  }

  const monthStart = startOfMonth();
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('kind', 'expense')
    .eq('category_id', match.id)
    .gte('occurred_at', monthStart.toISOString());

  const total = (transactions ?? []).reduce((s, t) => s + Number(t.amount), 0);
  if (!transactions || transactions.length === 0) {
    return {
      text: `You haven't logged any ${match.name} expenses this month yet.`,
      evidence: { category: match.name, amount: 0 },
    };
  }

  return {
    text: `You've spent ${total.toFixed(2)} on ${match.name} this month, across ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}.`,
    evidence: { category: match.name, amount: total, transactionCount: transactions.length },
  };
}

async function compareMonths(supabase: SupabaseClient, userId: string): Promise<AssistantAnswer> {
  const thisMonthStart = startOfMonth();
  const lastMonthStart = startOfPreviousMonth();

  const [{ data: thisMonth }, { data: lastMonth }, { data: categories }] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, category_id')
      .eq('user_id', userId)
      .eq('kind', 'expense')
      .gte('occurred_at', thisMonthStart.toISOString()),
    supabase
      .from('transactions')
      .select('amount, category_id')
      .eq('user_id', userId)
      .eq('kind', 'expense')
      .gte('occurred_at', lastMonthStart.toISOString())
      .lt('occurred_at', thisMonthStart.toISOString()),
    supabase.from('categories').select('id, name').eq('user_id', userId),
  ]);

  if (!lastMonth || lastMonth.length === 0) {
    return {
      text: "I don't have a full previous month of data yet to compare against.",
      evidence: {},
    };
  }

  const thisTotal = (thisMonth ?? []).reduce((s, t) => s + Number(t.amount), 0);
  const lastTotal = lastMonth.reduce((s, t) => s + Number(t.amount), 0);
  const diff = thisTotal - lastTotal;

  const thisByCategory = totalsByCategory(thisMonth ?? [], 'expense');
  const lastByCategory = totalsByCategory(lastMonth, 'expense');
  const nameOf = (id: string | null) => categories?.find((c) => c.id === id)?.name ?? 'Uncategorized';

  const changes = [...new Set([...thisByCategory.keys(), ...lastByCategory.keys()])]
    .filter((id) => id !== null)
    .map((id) => ({
      name: nameOf(id),
      change: (thisByCategory.get(id) ?? 0) - (lastByCategory.get(id) ?? 0),
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 2)
    .filter((c) => Math.abs(c.change) > 0);

  const direction = diff >= 0 ? 'increased' : 'decreased';
  const driverText =
    changes.length > 0
      ? ` The largest change came from ${changes.map((c) => `${c.name} (${c.change >= 0 ? '+' : ''}${c.change.toFixed(2)})`).join(' and ')}.`
      : '';

  return {
    text: `Your spending ${direction} by ${Math.abs(diff).toFixed(2)} compared with last month (${lastTotal.toFixed(2)} → ${thisTotal.toFixed(2)}).${driverText}`,
    evidence: { thisMonthTotal: thisTotal, lastMonthTotal: lastTotal, difference: diff, topChanges: changes },
  };
}

async function listSubscriptions(supabase: SupabaseClient, userId: string): Promise<AssistantAnswer> {
  const { data: recurring } = await supabase
    .from('recurring_transactions')
    .select('merchant, amount, currency, cadence')
    .eq('user_id', userId)
    .eq('active', true)
    .eq('kind', 'expense');

  if (!recurring || recurring.length === 0) {
    return {
      text: "You don't have any recurring expenses set up yet, so I can't list subscriptions from your data.",
      evidence: { count: 0 },
    };
  }

  const list = recurring.map((r) => `${r.merchant ?? 'Unnamed'} (${r.amount} ${r.currency}, ${r.cadence})`);
  const total = recurring.reduce((s, r) => s + Number(r.amount), 0);

  return {
    text: `You have ${recurring.length} recurring expense${recurring.length === 1 ? '' : 's'} set up, totaling ${total.toFixed(2)} per cycle: ${list.join('; ')}.`,
    evidence: { count: recurring.length, total, items: recurring },
  };
}

async function budgetStatus(supabase: SupabaseClient, userId: string): Promise<AssistantAnswer> {
  const [{ data: budgets }, breakdown] = await Promise.all([
    supabase.from('budgets').select('*').eq('user_id', userId).eq('period', 'monthly'),
    getCategoryBreakdown(supabase, userId, startOfMonth()),
  ]);

  if (!budgets || budgets.length === 0) {
    return {
      text: "You haven't set any budgets yet, so there's nothing to check. You can set one on the Budgets page.",
      evidence: { budgetCount: 0 },
    };
  }

  const overallSpend = overallExpenseTotal(breakdown.value);
  const progress = computeBudgetProgress(budgets, breakdown.value, overallSpend);
  const over = progress.filter((b) => b.status === 'over');

  if (over.length === 0) {
    return {
      text: `None of your ${budgets.length} budget${budgets.length === 1 ? '' : 's'} are over their limit this month.`,
      evidence: { budgetCount: budgets.length, overCount: 0 },
    };
  }

  return {
    text: `${over.length} budget${over.length === 1 ? ' is' : 's are'} over this month: ${over
      .map((b) => `${b.name} (${b.spent.toFixed(2)} of ${b.limit.toFixed(2)})`)
      .join('; ')}.`,
    evidence: { over },
  };
}

async function canAffordEstimate(
  supabase: SupabaseClient,
  userId: string,
  purchaseAmount?: number
): Promise<AssistantAnswer> {
  // "Can I afford a ₹20,000 purchase?" is a different, more specific
  // question than "how much can I spend this week?" — it asks whether
  // one known amount fits against a projected month-end position, so
  // it's answered from getMonthEndProjection rather than the generic
  // weekly-allowance heuristic below.
  if (purchaseAmount != null) {
    const projection = await getMonthEndProjection(supabase, userId);
    if (projection.value.actualIncomeSoFar === 0 && projection.value.actualExpenseSoFar === 0) {
      return NO_DATA;
    }
    const remainingAfterPurchase = projection.value.projectedMonthEndNet - purchaseAmount;
    const fits = remainingAfterPurchase >= 0;
    return {
      text: fits
        ? `Based on your income and spending pace this month, you're projected to end the month with about ${projection.value.projectedMonthEndNet.toFixed(2)} left over. A ${purchaseAmount.toFixed(2)} purchase would leave roughly ${remainingAfterPurchase.toFixed(2)} — it looks affordable, but this is a projection from your current pace, not a guarantee.`
        : `Based on your current spending pace, you're projected to end the month around ${projection.value.projectedMonthEndNet.toFixed(2)}. A ${purchaseAmount.toFixed(2)} purchase would put you about ${Math.abs(remainingAfterPurchase).toFixed(2)} into the red by month-end at this pace — it may be tight.`,
      evidence: { purchaseAmount, projectedMonthEndNet: projection.value.projectedMonthEndNet, remainingAfterPurchase, kind: 'projection' },
    };
  }

  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  const [{ data: monthTransactions }, { data: weekTransactions }] = await Promise.all([
    supabase
      .from('transactions')
      .select('kind, amount')
      .eq('user_id', userId)
      .gte('occurred_at', monthStart.toISOString()),
    supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('kind', 'expense')
      .gte('occurred_at', weekStart.toISOString()),
  ]);

  if (!monthTransactions || monthTransactions.length === 0) {
    return NO_DATA;
  }

  const income = monthTransactions.filter((t) => t.kind === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthTransactions.filter((t) => t.kind === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const spentThisWeek = (weekTransactions ?? []).reduce((s, t) => s + Number(t.amount), 0);

  if (income === 0) {
    return {
      text: "I don't have any income logged this month, so I can't estimate safe spending — this would just be a guess.",
      evidence: { income: 0 },
    };
  }

  // Simple, disclosed heuristic: remaining monthly surplus spread over
  // the days left in the month, minus what's already gone out this
  // week. This is explicitly a rough estimate, not a budget system —
  // it's labeled as such in the response.
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.max(1, Math.ceil((Date.now() - monthStart.getTime()) / 86_400_000));
  const daysRemaining = Math.max(1, daysInMonth - daysElapsed);
  const surplus = income - expense;
  const dailyAllowance = Math.max(0, surplus / daysRemaining);
  const weeklyAllowance = Math.max(0, dailyAllowance * 7 - spentThisWeek);

  return {
    text: `Based on ${income.toFixed(2)} income and ${expense.toFixed(2)} spent so far this month, you have roughly ${weeklyAllowance.toFixed(2)} left to spend comfortably this week without dipping into next month's income. This is an estimate from your actual cash flow, not a fixed budget.`,
    evidence: { income, expense, spentThisWeek, weeklyAllowance, daysRemaining, kind: 'estimate' },
  };
}

async function upcomingRecurring(supabase: SupabaseClient, userId: string): Promise<AssistantAnswer> {
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  const { data: recurring } = await supabase
    .from('recurring_transactions')
    .select('merchant, amount, currency, next_run_at, kind')
    .eq('user_id', userId)
    .eq('active', true)
    .lte('next_run_at', in30Days.toISOString().slice(0, 10))
    .order('next_run_at', { ascending: true });

  if (!recurring || recurring.length === 0) {
    return {
      text: "You don't have any recurring transactions scheduled in the next 30 days.",
      evidence: { count: 0 },
    };
  }

  const total = recurring.filter((r) => r.kind === 'expense').reduce((s, r) => s + Number(r.amount), 0);
  const list = recurring.map((r) => `${r.merchant ?? 'Unnamed'} — ${r.amount} ${r.currency} on ${r.next_run_at}`);

  return {
    text: `You have ${recurring.length} recurring transaction${recurring.length === 1 ? '' : 's'} coming in the next 30 days, totaling ${total.toFixed(2)} in expenses: ${list.join('; ')}.`,
    evidence: { count: recurring.length, totalExpense: total, items: recurring },
  };
}

async function biggestExpenses(supabase: SupabaseClient, userId: string): Promise<AssistantAnswer> {
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, merchant, occurred_at, categories(name)')
    .eq('user_id', userId)
    .eq('kind', 'expense')
    .gte('occurred_at', startOfMonth().toISOString())
    .order('amount', { ascending: false })
    .limit(5);

  if (!transactions || transactions.length === 0) return NO_DATA;

  const list = transactions.map((t) => {
    const category = (t as unknown as { categories: { name: string } | null }).categories?.name;
    return `${t.merchant ?? category ?? 'Expense'} — ${Number(t.amount).toFixed(2)}`;
  });

  return {
    text: `Your biggest expenses this month: ${list.join('; ')}.`,
    evidence: { items: transactions },
  };
}

async function unusualSpending(supabase: SupabaseClient, userId: string): Promise<AssistantAnswer> {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const [{ data: recent }, { data: categories }] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, category_id, occurred_at')
      .eq('user_id', userId)
      .eq('kind', 'expense')
      .gte('occurred_at', threeMonthsAgo.toISOString()),
    supabase.from('categories').select('id, name').eq('user_id', userId),
  ]);

  if (!recent || recent.length < 6) {
    return {
      text: "I don't have enough spending history yet to tell what's unusual for you.",
      evidence: { transactionCount: recent?.length ?? 0 },
    };
  }

  const monthStart = startOfMonth();
  const thisMonth = recent.filter((t) => new Date(t.occurred_at) >= monthStart);
  const prior = recent.filter((t) => new Date(t.occurred_at) < monthStart);

  const thisTotals = totalsByCategory(thisMonth, 'expense');
  const priorTotals = totalsByCategory(prior, 'expense');
  // Roughly 2 prior months of history feeding the average — a simple,
  // disclosed threshold (1.5x the prior average), not a statistical model.
  const priorMonthsSpan = 2;

  const flagged = [...thisTotals.entries()]
    .filter(([id]) => id !== null)
    .map(([id, amount]) => {
      const priorAvg = (priorTotals.get(id) ?? 0) / priorMonthsSpan;
      return { id, amount, priorAvg, ratio: priorAvg > 0 ? amount / priorAvg : amount > 0 ? Infinity : 0 };
    })
    .filter((c) => c.ratio >= 1.5 && c.amount > 0)
    .sort((a, b) => b.ratio - a.ratio);

  if (flagged.length === 0) {
    return {
      text: "Nothing stands out as unusual this month compared with your recent spending pattern.",
      evidence: { flagged: [] },
    };
  }

  const nameOf = (id: string | null) => categories?.find((c) => c.id === id)?.name ?? 'Uncategorized';
  const list = flagged
    .slice(0, 3)
    .map((f) => `${nameOf(f.id)} at ${f.amount.toFixed(2)} (usually around ${f.priorAvg.toFixed(2)})`);

  return {
    text: `Spending that's noticeably higher than usual this month: ${list.join('; ')}.`,
    evidence: { flagged },
  };
}

async function goalProgress(supabase: SupabaseClient, userId: string): Promise<AssistantAnswer> {
  const { data: goals } = await supabase
    .from('goals')
    .select('title, current_value, target_value, unit')
    .eq('user_id', userId)
    .eq('domain', 'financial')
    .eq('status', 'active');

  if (!goals || goals.length === 0) {
    return {
      text: "You don't have any financial goals set yet. You can add one from the Goals page.",
      evidence: { count: 0 },
    };
  }

  const list = goals.map((g) => {
    const pct = g.target_value ? Math.round((g.current_value / g.target_value) * 100) : null;
    return `${g.title}: ${g.current_value}${g.unit ?? ''} of ${g.target_value ?? '?'}${g.unit ?? ''}${pct != null ? ` (${pct}%)` : ''}`;
  });

  return {
    text: list.join('; '),
    evidence: { goals },
  };
}

// ---------------------------------------------------------------------
// Composed handlers — multi-step reasoning built from src/lib/ai/facts.ts.
// Each of these gathers 2+ verified facts and reasons over them in
// plain code before producing a sentence. The model layer (none of
// which exists yet in this codebase — see README) would only ever be
// allowed to rephrase what's returned here, never to recompute it.
// ---------------------------------------------------------------------

async function moneyFlowOverview(supabase: SupabaseClient, userId: string): Promise<AssistantAnswer> {
  const monthStart = startOfMonth();
  const [totals, breakdown] = await Promise.all([
    getPeriodTotals(supabase, userId, monthStart),
    getCategoryBreakdown(supabase, userId, monthStart),
  ]);

  if (totals.value.currencies.length > 1) {
    return {
      text: "You've transacted in more than one currency this month, so I can't combine them into a single overview — check the Transactions page for a per-currency breakdown.",
      evidence: { currencies: totals.value.currencies },
    };
  }
  if (totals.value.income === 0 && totals.value.expense === 0) return NO_DATA;

  const top3 = breakdown.value.slice(0, 3);
  const topText = top3.length
    ? ` Most of it went to ${top3.map((c) => `${c.name} (${c.amount.toFixed(2)})`).join(', ')}.`
    : '';

  return {
    text: `This month you've brought in ${totals.value.income.toFixed(2)} and spent ${totals.value.expense.toFixed(2)}, leaving a net of ${totals.value.net.toFixed(2)}.${topText}`,
    evidence: { ...totals.value, topCategories: top3 },
  };
}

async function balanceTrend(supabase: SupabaseClient, userId: string): Promise<AssistantAnswer> {
  const trend = await getMonthlyNetTrend(supabase, userId, 3);
  const points = trend.value;
  if (points.every((p) => p.income === 0 && p.expense === 0)) return NO_DATA;

  const isDeclining = points.length >= 2 && points[points.length - 1]!.net < points[0]!.net;
  const latest = points[points.length - 1]!;

  if (!isDeclining) {
    return {
      text: `Your net position hasn't been declining over the last ${points.length} months — this month's net is ${latest.net.toFixed(2)}.`,
      evidence: { points },
    };
  }

  const breakdown = await getCategoryBreakdown(supabase, userId, startOfMonth());
  const risers = breakdown.value.slice(0, 2);

  return {
    text: `Your net position has been trending down over the last ${points.length} months (from ${points[0]!.net.toFixed(2)} to ${latest.net.toFixed(2)}). ${
      risers.length
        ? `Your largest expense categories this month are ${risers.map((c) => `${c.name} (${c.amount.toFixed(2)})`).join(' and ')}.`
        : ''
    }`,
    evidence: { points, largestCategories: risers },
  };
}

async function sixMonthChanges(supabase: SupabaseClient, userId: string): Promise<AssistantAnswer> {
  const [current, sixAgo] = await Promise.all([
    getCategoryBreakdown(supabase, userId, startOfMonth()),
    getCategoryBreakdown(supabase, userId, startOfMonthsAgo(6), startOfMonthsAgo(5)),
  ]);

  if (current.value.length === 0 && sixAgo.value.length === 0) return NO_DATA;

  const diffs = diffCategoryBreakdowns(current.value, sixAgo.value)
    .filter((d) => Math.abs(d.change) > 0)
    .slice(0, 3);

  if (diffs.length === 0) {
    return { text: "Your spending pattern looks similar to six months ago — no major category shifts.", evidence: {} };
  }

  const list = diffs.map(
    (d) => `${d.name} went from ${d.previous.toFixed(2)} to ${d.current.toFixed(2)} (${d.change >= 0 ? '+' : ''}${d.change.toFixed(2)})`
  );

  return {
    text: `Comparing this month with six months ago, the biggest changes are: ${list.join('; ')}.`,
    evidence: { diffs },
  };
}

async function monthEndProjectionAnswer(supabase: SupabaseClient, userId: string): Promise<AssistantAnswer> {
  const projection = await getMonthEndProjection(supabase, userId);
  if (projection.value.actualIncomeSoFar === 0 && projection.value.actualExpenseSoFar === 0) return NO_DATA;

  return {
    text: `So far this month you've actually spent ${projection.value.actualExpenseSoFar.toFixed(2)}. At your current daily pace, ZHIVA projects you'll spend about ${projection.value.projectedMonthExpense.toFixed(2)} in total and end the month with a net of roughly ${projection.value.projectedMonthEndNet.toFixed(2)}. This is a projection based on ${projection.value.daysElapsed} day${projection.value.daysElapsed === 1 ? '' : 's'} of real data, not a guarantee.`,
    evidence: { ...projection.value, kind: 'projection' },
  };
}

async function savingsNeededForGoal(supabase: SupabaseClient, userId: string): Promise<AssistantAnswer> {
  const [{ data: goals }, trend] = await Promise.all([
    supabase
      .from('goals')
      .select('title, current_value, target_value, unit')
      .eq('user_id', userId)
      .eq('domain', 'financial')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
    getMonthlyNetTrend(supabase, userId, 3),
  ]);

  if (!goals || !goals.target_value) {
    return {
      text: "You don't have a financial goal with a target amount set yet. Add one from the Goals page and I can estimate a monthly savings pace for it.",
      evidence: {},
    };
  }

  const remaining = goals.target_value - goals.current_value;
  if (remaining <= 0) {
    return { text: `You've already reached your goal "${goals.title}".`, evidence: { goal: goals } };
  }

  const projection = projectGoalCompletion(goals, trend.value.map((p) => p.net));
  const { averageMonthlyNet, monthsAtCurrentPace } = projection.value;

  return {
    text:
      `You need ${remaining.toFixed(2)}${goals.unit ?? ''} more to reach "${goals.title}". ` +
      (monthsAtCurrentPace != null
        ? `At your average monthly net of ${averageMonthlyNet.toFixed(2)} over the last ${trend.value.length} months, that's about ${Math.ceil(monthsAtCurrentPace)} more month${Math.ceil(monthsAtCurrentPace) === 1 ? '' : 's'} at your current pace.`
        : `Your recent months haven't had a positive net, so I can't project a timeline from your current pace — you'd need to increase income or reduce spending to make progress.`),
    evidence: { goal: goals, remaining, averageMonthlyNet, monthsAtCurrentPace, kind: 'projection' },
  };
}

async function whatToCut(supabase: SupabaseClient, userId: string): Promise<AssistantAnswer> {
  const [{ data: budgets }, breakdown] = await Promise.all([
    supabase.from('budgets').select('*').eq('user_id', userId).eq('period', 'monthly'),
    getCategoryBreakdown(supabase, userId, startOfMonth()),
  ]);

  const overallSpend = overallExpenseTotal(breakdown.value);
  const progress = computeBudgetProgress(budgets ?? [], breakdown.value, overallSpend);
  const overBudget = progress
    .filter((b) => b.status === 'over')
    .map((b) => ({ name: b.name, spent: b.spent, limit: b.limit, over: b.spent - b.limit }))
    .sort((a, b) => b.over - a.over);

  if (overBudget.length > 0) {
    return {
      text: `Your clearest opportunity is ${overBudget[0]!.name}, which is ${overBudget[0]!.over.toFixed(2)} over its ${overBudget[0]!.limit.toFixed(2)} budget this month. That's the most direct place to cut back.`,
      evidence: { overBudget },
    };
  }

  if (breakdown.value.length === 0) return NO_DATA;

  const top = breakdown.value[0]!;
  return {
    text: `Nothing is over budget right now, but ${top.name} is your largest category this month at ${top.amount.toFixed(2)} — it's the category with the most room to cut if you're looking to reduce spending.`,
    evidence: { topCategory: top },
  };
}

async function duplicateTransactionsAnswer(supabase: SupabaseClient, userId: string): Promise<AssistantAnswer> {
  const groups = await getDuplicateLikeTransactions(supabase, userId);
  if (groups.value.length === 0) {
    return { text: "I didn't find any transactions this month that look like accidental duplicates.", evidence: { count: 0 } };
  }

  const list = groups.value
    .slice(0, 3)
    .map((g) => `${g[0]!.merchant ?? 'an expense'} at ${Number(g[0]!.amount).toFixed(2)} logged twice within 48 hours`);

  return {
    text: `I found ${groups.value.length} pair${groups.value.length === 1 ? '' : 's'} of transactions that look like possible duplicates: ${list.join('; ')}. Check these on the Transactions page — nothing has been changed automatically.`,
    evidence: { groups: groups.value },
  };
}

async function scenarioReduceCategory(
  supabase: SupabaseClient,
  userId: string,
  categoryHint: string | undefined,
  percentHint: number | undefined
): Promise<AssistantAnswer> {
  const percent = percentHint ?? 20; // a reasonable default if the user didn't specify one
  const breakdown = await getCategoryBreakdown(supabase, userId, startOfMonth());

  const target = categoryHint
    ? breakdown.value.find((c) => c.name.toLowerCase().includes(categoryHint.toLowerCase()))
    : breakdown.value[0]; // no category named — use the largest category as the illustrative case

  if (!target || target.amount === 0) {
    return {
      text: categoryHint
        ? `I couldn't find spending on "${categoryHint}" this month to run that scenario against.`
        : "You don't have enough spending logged this month to run that scenario.",
      evidence: {},
    };
  }

  const savings = target.amount * (percent / 100);

  return {
    text: `If you reduced ${target.name} by ${percent}%, based on this month's actual spending of ${target.amount.toFixed(2)}, you'd save about ${savings.toFixed(2)}. This is a hypothetical calculated from real data, not a change that's been made.`,
    evidence: { category: target.name, currentAmount: target.amount, percent, projectedSavings: savings, kind: 'hypothetical' },
  };
}
