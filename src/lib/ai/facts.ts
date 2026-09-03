import type { SupabaseClient } from '@supabase/supabase-js';
import {
  totalsByCategory,
  startOfMonth,
  startOfMonthsAgo,
} from '@/lib/money';

// Every fact is tagged with its provenance so the explanation layer
// (and the UI) can be honest about what's real vs. hypothetical:
//   'actual'     — directly computed from persisted transactions
//   'estimate'   — a disclosed heuristic applied to actual data
//   'projection' — a forward-looking extrapolation or a what-if
export type FactKind = 'actual' | 'estimate' | 'projection';

export interface Fact<T> {
  value: T;
  kind: FactKind;
  note?: string;
}

export interface CategoryAmount {
  categoryId: string | null;
  name: string;
  amount: number;
}

/**
 * Build a map of category IDs to category names.
 */
async function categoryNameMap(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', userId);

  return new Map(
    (data ?? []).map((category) => [
      category.id as string,
      category.name as string,
    ])
  );
}

/**
 * Total income/expense/net for one currency across [start, end).
 *
 * Only meaningful for a single currency at a time.
 * Composite reasoning should check currency count before
 * using the totals together.
 *
 * Throws if the underlying query fails — callers (or their callers,
 * up to a route/page boundary) are responsible for catching this and
 * degrading gracefully rather than letting one failed fact take down
 * an entire page. See src/app/(app)/home/page.tsx for the pattern.
 */
export async function getPeriodTotals(
  supabase: SupabaseClient,
  userId: string,
  start: Date,
  end?: Date
): Promise<
  Fact<{
    income: number;
    expense: number;
    net: number;
    currencies: string[];
  }>
> {
  let query = supabase
    .from('transactions')
    .select('kind, amount, currency')
    .eq('user_id', userId)
    .neq('kind', 'transfer')
    .gte('occurred_at', start.toISOString());

  if (end) {
    query = query.lt(
      'occurred_at',
      end.toISOString()
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = data ?? [];

  const currencies = [
    ...new Set(
      rows
        .map((row) => row.currency)
        .filter(
          (currency): currency is string =>
            Boolean(currency)
        )
    ),
  ];

  const income = rows
    .filter((row) => row.kind === 'income')
    .reduce(
      (sum, row) => sum + Number(row.amount),
      0
    );

  const expense = rows
    .filter((row) => row.kind === 'expense')
    .reduce(
      (sum, row) => sum + Number(row.amount),
      0
    );

  return {
    value: {
      income,
      expense,
      net: income - expense,
      currencies,
    },
    kind: 'actual',
  };
}

/**
 * Category breakdown of expenses for [start, end),
 * with real category names resolved.
 */
export async function getCategoryBreakdown(
  supabase: SupabaseClient,
  userId: string,
  start: Date,
  end?: Date
): Promise<Fact<CategoryAmount[]>> {
  let query = supabase
    .from('transactions')
    .select('amount, category_id')
    .eq('user_id', userId)
    .eq('kind', 'expense')
    .gte(
      'occurred_at',
      start.toISOString()
    );

  if (end) {
    query = query.lt(
      'occurred_at',
      end.toISOString()
    );
  }

  const [
    { data: transactions, error },
    names,
  ] = await Promise.all([
    query,
    categoryNameMap(supabase, userId),
  ]);

  if (error) {
    throw error;
  }

  const totals = totalsByCategory(
    transactions ?? [],
    'expense'
  );

  const list: CategoryAmount[] = [
    ...totals.entries(),
  ].map(([id, amount]) => ({
    categoryId: id,
    name: id
      ? names.get(id) ?? 'Uncategorized'
      : 'Uncategorized',
    amount: Number(amount),
  }));

  list.sort(
    (a, b) => b.amount - a.amount
  );

  return {
    value: list,
    kind: 'actual',
  };
}

/**
 * Per-category difference between two already-fetched
 * breakdowns, sorted by absolute size of change.
 */
export function diffCategoryBreakdowns(
  current: CategoryAmount[],
  previous: CategoryAmount[]
): Array<{
  name: string;
  categoryId: string | null;
  current: number;
  previous: number;
  change: number;
}> {
  const byId = new Map<
    string | null,
    {
      name: string;
      current: number;
      previous: number;
    }
  >();

  for (const category of current) {
    byId.set(category.categoryId, {
      name: category.name,
      current: category.amount,
      previous: 0,
    });
  }

  for (const category of previous) {
    const existing = byId.get(
      category.categoryId
    );

    if (existing) {
      existing.previous = category.amount;
    } else {
      byId.set(category.categoryId, {
        name: category.name,
        current: 0,
        previous: category.amount,
      });
    }
  }

  return [...byId.entries()]
    .map(([categoryId, value]) => ({
      categoryId,
      name: value.name,
      current: value.current,
      previous: value.previous,
      change:
        value.current - value.previous,
    }))
    .sort(
      (a, b) =>
        Math.abs(b.change) -
        Math.abs(a.change)
    );
}

/**
 * Net cash flow (income - expense) for each of the
 * last `months` calendar months, oldest first.
 */
export async function getMonthlyNetTrend(
  supabase: SupabaseClient,
  userId: string,
  months: number
): Promise<
  Fact<
    Array<{
      monthStart: string;
      net: number;
      income: number;
      expense: number;
    }>
  >
> {
  const points: Array<{
    monthStart: string;
    net: number;
    income: number;
    expense: number;
  }> = [];

  if (months <= 0) {
    return {
      value: points,
      kind: 'actual',
    };
  }

  for (
    let i = months - 1;
    i >= 0;
    i--
  ) {
    const start =
      startOfMonthsAgo(i);

    const end =
      startOfMonthsAgo(i - 1);

    const totals =
      await getPeriodTotals(
        supabase,
        userId,
        start,
        end
      );

    points.push({
      monthStart: start
        .toISOString()
        .slice(0, 10),
      net: totals.value.net,
      income: totals.value.income,
      expense: totals.value.expense,
    });
  }

  return {
    value: points,
    kind: 'actual',
  };
}

/**
 * Recurring obligations due within `daysAhead` days.
 */
export async function getUpcomingRecurring(
  supabase: SupabaseClient,
  userId: string,
  daysAhead: number
): Promise<
  Fact<
    Array<{
      merchant: string | null;
      amount: number;
      currency: string;
      kind: string;
      nextRunAt: string;
    }>
  >
> {
  const horizon = new Date();

  horizon.setDate(
    horizon.getDate() + daysAhead
  );

  const { data, error } =
    await supabase
      .from('recurring_transactions')
      .select(
        'merchant, amount, currency, kind, next_run_at'
      )
      .eq('user_id', userId)
      .eq('active', true)
      .lte(
        'next_run_at',
        horizon
          .toISOString()
          .slice(0, 10)
      )
      .order('next_run_at', {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  return {
    value: (data ?? []).map(
      (row) => ({
        merchant: row.merchant,
        amount: Number(row.amount),
        currency: row.currency,
        kind: row.kind,
        nextRunAt: row.next_run_at,
      })
    ),
    kind: 'actual',
  };
}

/**
 * Transactions that look like accidental duplicates:
 * same account, same amount, same merchant-or-category,
 * within 48 hours of each other.
 *
 * This is a heuristic. Transactions are never automatically
 * merged or deleted.
 */
export async function getDuplicateLikeTransactions(
  supabase: SupabaseClient,
  userId: string
): Promise<
  Fact<
    Array<
      Array<{
        id: string;
        amount: number;
        merchant: string | null;
        category_id: string | null;
        occurred_at: string;
        account_id: string | null;
      }>
    >
  >
> {
  const since =
    startOfMonthsAgo(1);

  const { data, error } =
    await supabase
      .from('transactions')
      .select(
        'id, amount, merchant, category_id, occurred_at, account_id'
      )
      .eq('user_id', userId)
      .eq('kind', 'expense')
      .gte(
        'occurred_at',
        since.toISOString()
      )
      .order('occurred_at', {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  const rows = data ?? [];

  const groups: Array<
    Array<{
      id: string;
      amount: number;
      merchant: string | null;
      category_id: string | null;
      occurred_at: string;
      account_id: string | null;
    }>
  > = [];

  for (
    let i = 0;
    i < rows.length;
    i++
  ) {
    for (
      let j = i + 1;
      j < rows.length;
      j++
    ) {
      const a = rows[i];
      const b = rows[j];

      if (!a || !b) {
        continue;
      }

      const sameAmount =
        Number(a.amount) ===
        Number(b.amount);

      const sameAccount =
        a.account_id ===
        b.account_id;

      const sameMerchantOrCategory =
        (Boolean(a.merchant) &&
          a.merchant === b.merchant) ||
        (!a.merchant &&
          a.category_id ===
            b.category_id);

      const hoursApart =
        Math.abs(
          new Date(
            a.occurred_at
          ).getTime() -
            new Date(
              b.occurred_at
            ).getTime()
        ) / 3_600_000;

      if (
        sameAmount &&
        sameAccount &&
        sameMerchantOrCategory &&
        hoursApart <= 48
      ) {
        groups.push([a, b]);
      }
    }
  }

  return {
    value: groups,
    kind: 'actual',
  };
}

/**
 * Merchants that recur across multiple months
 * at a similar amount but have no explicit
 * recurring_transactions row.
 */
export async function getSubscriptionLikeMerchants(
  supabase: SupabaseClient,
  userId: string
): Promise<
  Fact<
    Array<{
      merchant: string;
      monthsSeen: number;
      averageAmount: number;
    }>
  >
> {
  const since =
    startOfMonthsAgo(3);

  const { data, error } =
    await supabase
      .from('transactions')
      .select(
        'merchant, amount, occurred_at'
      )
      .eq('user_id', userId)
      .eq('kind', 'expense')
      .not(
        'merchant',
        'is',
        null
      )
      .gte(
        'occurred_at',
        since.toISOString()
      );

  if (error) {
    throw error;
  }

  const byMerchant = new Map<
    string,
    Array<{
      amount: number;
      month: string;
    }>
  >();

  for (const transaction of
    data ?? []) {
    if (!transaction.merchant) {
      continue;
    }

    const merchant =
      transaction.merchant as string;

    const month =
      new Date(
        transaction.occurred_at
      )
        .toISOString()
        .slice(0, 7);

    const occurrences =
      byMerchant.get(
        merchant
      ) ?? [];

    occurrences.push({
      amount: Number(
        transaction.amount
      ),
      month,
    });

    byMerchant.set(
      merchant,
      occurrences
    );
  }

  const candidates: Array<{
    merchant: string;
    monthsSeen: number;
    averageAmount: number;
  }> = [];

  for (const [
    merchant,
    occurrences,
  ] of byMerchant) {
    const distinctMonths =
      new Set(
        occurrences.map(
          (occurrence) =>
            occurrence.month
        )
      );

    if (
      distinctMonths.size < 2
    ) {
      continue;
    }

    const amounts =
      occurrences.map(
        (occurrence) =>
          occurrence.amount
      );

    const averageAmount =
      amounts.reduce(
        (sum, amount) =>
          sum + amount,
        0
      ) / amounts.length;

    const withinFivePercent =
      averageAmount !== 0 &&
      amounts.every(
        (amount) =>
          Math.abs(
            amount -
              averageAmount
          ) /
            Math.abs(
              averageAmount
            ) <= 0.05
      );

    if (
      withinFivePercent
    ) {
      candidates.push({
        merchant,
        monthsSeen:
          distinctMonths.size,
        averageAmount,
      });
    }
  }

  candidates.sort(
    (a, b) =>
      b.monthsSeen -
      a.monthsSeen
  );

  return {
    value: candidates,
    kind: 'actual',
  };
}

export interface GoalProjection {
  remaining: number;
  averageMonthlyNet: number;
  monthsAtCurrentPace: number | null;
}

/**
 * Projects how many months, at the user's recent
 * average monthly net cash flow, it will take to
 * close the gap on a goal's target value.
 */
export function projectGoalCompletion(
  goal: Pick<
    import('@/types/database').Goal,
    'current_value' | 'target_value'
  >,
  recentMonthlyNet: number[]
): Fact<GoalProjection> {
  const remaining =
    (goal.target_value ?? 0) -
    goal.current_value;

  const averageMonthlyNet =
    recentMonthlyNet.length > 0
      ? recentMonthlyNet.reduce(
          (sum, value) =>
            sum + value,
          0
        ) /
        recentMonthlyNet.length
      : 0;

  const monthsAtCurrentPace =
    averageMonthlyNet > 0 &&
    remaining > 0
      ? remaining /
        averageMonthlyNet
      : null;

  return {
    value: {
      remaining,
      averageMonthlyNet,
      monthsAtCurrentPace,
    },
    kind: 'projection',
    note:
      'Projected from the average of your last few months of actual net cash flow.',
  };
}

/**
 * Projects month-end expense and net balance from
 * the user's daily average spend rate so far this month.
 *
 * Explicitly a projection, never presented as an actual total.
 */
export async function getMonthEndProjection(
  supabase: SupabaseClient,
  userId: string
): Promise<
  Fact<{
    actualExpenseSoFar: number;
    actualIncomeSoFar: number;
    projectedMonthExpense: number;
    projectedMonthEndNet: number;
    daysElapsed: number;
    daysInMonth: number;
  }>
> {
  const monthStart =
    startOfMonth();

  const totals =
    await getPeriodTotals(
      supabase,
      userId,
      monthStart
    );

  const now = new Date();

  const daysInMonth =
    new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0
    ).getDate();

  const daysElapsed = Math.max(
    1,
    Math.ceil(
      (now.getTime() -
        monthStart.getTime()) /
        86_400_000
    )
  );

  const dailyRate =
    totals.value.expense /
    daysElapsed;

  const projectedMonthExpense =
    dailyRate *
    daysInMonth;

  const projectedMonthEndNet =
    totals.value.income -
    projectedMonthExpense;

  return {
    value: {
      actualExpenseSoFar:
        totals.value.expense,
      actualIncomeSoFar:
        totals.value.income,
      projectedMonthExpense,
      projectedMonthEndNet,
      daysElapsed,
      daysInMonth,
    },
    kind: 'projection',
    note: `Extrapolated from ${daysElapsed} day${
      daysElapsed === 1
        ? ''
        : 's'
    } of actual spending this month.`,
  };
}
