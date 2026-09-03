import type { Account, Transaction } from '@/types/database';

// This file exists because two pages (Home, Money) previously computed
// totals with slightly different inline `.reduce()` calls — a classic
// way for financial bugs to drift apart. Every screen that shows a
// money total must go through these functions.

export interface CurrencySummary {
  income: number;
  expense: number;
  net: number;
}

/**
 * Groups transactions by currency and sums income/expense/net per
 * currency. Transfers are always excluded — they move money between
 * the user's own accounts and must never appear as income or expense.
 *
 * Deliberately does NOT convert between currencies or add them
 * together: summing ₹500 and $20 into one number would silently
 * produce a meaningless total. If a user has transactions in more
 * than one currency, the caller gets a summary per currency and must
 * display them separately (see money/page.tsx).
 */
export function summarizeByCurrency(transactions: Pick<Transaction, 'kind' | 'amount' | 'currency'>[]) {
  const byCurrency = new Map<string, CurrencySummary>();
  for (const t of transactions) {
    if (t.kind === 'transfer') continue;
    const current = byCurrency.get(t.currency) ?? { income: 0, expense: 0, net: 0 };
    if (t.kind === 'income') current.income += Number(t.amount);
    if (t.kind === 'expense') current.expense += Number(t.amount);
    current.net = current.income - current.expense;
    byCurrency.set(t.currency, current);
  }
  return byCurrency;
}

/**
 * True account balance: opening balance, plus income into this
 * account, minus expenses from this account, plus transfers in, minus
 * transfers out. This is the one place "does an account's balance
 * include transfers" is decided — transfers DO affect an individual
 * account's balance (money genuinely moved), they just don't count as
 * income/expense in aggregate reporting (summarizeByCurrency above).
 */
export function calculateAccountBalance(
  account: Pick<Account, 'id' | 'opening_balance'>,
  transactions: Pick<Transaction, 'kind' | 'amount' | 'account_id' | 'transfer_account_id'>[]
): number {
  let balance = Number(account.opening_balance);
  for (const t of transactions) {
    const amount = Number(t.amount);
    if (t.kind === 'income' && t.account_id === account.id) balance += amount;
    if (t.kind === 'expense' && t.account_id === account.id) balance -= amount;
    if (t.kind === 'transfer') {
      if (t.account_id === account.id) balance -= amount; // money left this account
      if (t.transfer_account_id === account.id) balance += amount; // money arrived here
    }
  }
  return balance;
}

/** Sums calculateAccountBalance across a set of accounts — the one
 * place "total balance across accounts" is defined, so Home and any
 * future screen agree by construction rather than by convention. */
export function sumAccountBalances(
  accounts: Pick<Account, 'id' | 'opening_balance'>[],
  transactions: Pick<Transaction, 'kind' | 'amount' | 'account_id' | 'transfer_account_id'>[]
): number {
  return accounts.reduce((sum, a) => sum + calculateAccountBalance(a, transactions), 0);
}

/** Category totals for a set of transactions — used by Home's "largest
 * category" insight and by budget-progress calculations. Transfers are
 * excluded for the same reason as summarizeByCurrency. */
export interface CategoryAmount {
  categoryId: string | null;
  name: string;
  amount: number;
}

/**
 * Category breakdown computed from transactions already held in memory
 * — no new query. This is the same computation BudgetsSection was
 * doing inline; extracted here so Reports and Budgets can't drift into
 * two different definitions of "spend by category" the way overallSpend
 * once did.
 */
export function categoryBreakdownFromTransactions(
  transactions: Pick<Transaction, 'kind' | 'amount' | 'category_id'>[],
  categories: { id: string; name: string }[],
  kind: 'expense' | 'income' = 'expense'
): CategoryAmount[] {
  const totals = totalsByCategory(transactions, kind);
  const nameOf = (id: string | null) =>
    id ? categories.find((c) => c.id === id)?.name ?? 'Unknown category' : 'Uncategorized';
  return [...totals.entries()]
    .map(([categoryId, amount]) => ({ categoryId, name: nameOf(categoryId), amount }))
    .sort((a, b) => b.amount - a.amount);
}

export interface MonthBucket {
  monthStart: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

/** Buckets already-fetched transactions by calendar month. Used by
 * Reports' "income vs expenses over time" chart — a general-purpose
 * version of the trailing-N-months logic in getMonthlyNetTrend, for
 * an arbitrary user-chosen date range instead of a fixed lookback. */
export function monthlySeries(
  transactions: Pick<Transaction, 'kind' | 'amount' | 'occurred_at'>[]
): MonthBucket[] {
  const buckets = new Map<string, MonthBucket>();
  for (const t of transactions) {
    if (t.kind === 'transfer') continue;
    const d = new Date(t.occurred_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key) ?? {
      monthStart: key,
      label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
      income: 0,
      expense: 0,
      net: 0,
    };
    if (t.kind === 'income') bucket.income += Number(t.amount);
    if (t.kind === 'expense') bucket.expense += Number(t.amount);
    bucket.net = bucket.income - bucket.expense;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.monthStart.localeCompare(b.monthStart));
}

export interface CategoryMonthPoint {
  monthStart: string;
  label: string;
  amounts: Record<string, number>; // category name -> total for that month
}

/** Per-category spend for each calendar month present in the given
 * transactions — the data behind the Reports "category trend" chart.
 * Only expense transactions are included; categories are named up
 * front from the real category list so a category with zero spend in
 * an early month still shows as 0, not a gap. */
export function categoryMonthlySeries(
  transactions: Pick<Transaction, 'kind' | 'amount' | 'occurred_at' | 'category_id'>[],
  categories: { id: string; name: string }[],
  topN = 4
): CategoryMonthPoint[] {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const totalByCategory = new Map<string, number>();
  const buckets = new Map<string, CategoryMonthPoint>();

  for (const t of transactions) {
    if (t.kind !== 'expense' || !t.category_id) continue;
    const name = nameById.get(t.category_id);
    if (!name) continue;
    totalByCategory.set(name, (totalByCategory.get(name) ?? 0) + Number(t.amount));

    const d = new Date(t.occurred_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key) ?? {
      monthStart: key,
      label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
      amounts: {},
    };
    bucket.amounts[name] = (bucket.amounts[name] ?? 0) + Number(t.amount);
    buckets.set(key, bucket);
  }

  // Only the top N categories by total spend across the whole range
  // get their own line — more than a handful of lines on one chart
  // stops being readable, which defeats the point of a trend chart.
  const topNames = new Set([...totalByCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([n]) => n));

  const sorted = [...buckets.values()].sort((a, b) => a.monthStart.localeCompare(b.monthStart));
  return sorted.map((bucket) => ({
    ...bucket,
    amounts: Object.fromEntries(Object.entries(bucket.amounts).filter(([name]) => topNames.has(name))),
  }));
}

export interface MerchantAmount {
  merchant: string;
  amount: number;
  count: number;
}

/** Top merchants by total spend within already-fetched transactions.
 * Transactions with no merchant are excluded — grouping them under a
 * fake "Unknown" merchant would misrepresent count/amount as if they
 * were the same payee. */
export function topMerchants(
  transactions: Pick<Transaction, 'kind' | 'amount' | 'merchant'>[],
  limit = 5
): MerchantAmount[] {
  const totals = new Map<string, MerchantAmount>();
  for (const t of transactions) {
    if (t.kind !== 'expense' || !t.merchant) continue;
    const current = totals.get(t.merchant) ?? { merchant: t.merchant, amount: 0, count: 0 };
    current.amount += Number(t.amount);
    current.count += 1;
    totals.set(t.merchant, current);
  }
  return [...totals.values()].sort((a, b) => b.amount - a.amount).slice(0, limit);
}

export interface AccountSummaryRow {
  accountId: string;
  name: string;
  currency: string;
  balance: number;
  periodIncome: number;
  periodExpense: number;
}

/** Per-account summary: current balance (all-time, via
 * calculateAccountBalance) alongside income/expense within the
 * selected reporting period specifically — two different time scopes,
 * kept clearly separate rather than conflated into one number. */
export function accountSummary(
  accounts: Pick<Account, 'id' | 'name' | 'currency' | 'opening_balance'>[],
  allTimeTransactions: Pick<Transaction, 'kind' | 'amount' | 'account_id' | 'transfer_account_id'>[],
  periodTransactions: Pick<Transaction, 'kind' | 'amount' | 'account_id'>[]
): AccountSummaryRow[] {
  return accounts.map((a) => {
    const periodForAccount = periodTransactions.filter((t) => t.account_id === a.id);
    return {
      accountId: a.id,
      name: a.name,
      currency: a.currency,
      balance: calculateAccountBalance(a, allTimeTransactions),
      periodIncome: periodForAccount.filter((t) => t.kind === 'income').reduce((s, t) => s + Number(t.amount), 0),
      periodExpense: periodForAccount.filter((t) => t.kind === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    };
  });
}

export function totalsByCategory(
  transactions: Pick<Transaction, 'kind' | 'amount' | 'category_id'>[],
  kind: 'expense' | 'income' = 'expense'
): Map<string | null, number> {
  const totals = new Map<string | null, number>();
  for (const t of transactions) {
    if (t.kind !== kind) continue;
    totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + Number(t.amount));
  }
  return totals;
}

/**
 * Total expense across a set of already-computed category amounts, OR
 * directly across raw transactions — both call sites existed
 * independently four times before this pass (BudgetsSection.tsx,
 * financial-assistant.ts's budgetStatus/whatToCut, insights.ts's
 * detectBudgetRisk) computing the identical "sum of all expense"
 * number with slightly different code each time. One function now.
 */
export function overallExpenseTotal(source: { amount: number }[]): number {
  return source.reduce((sum, item) => sum + Number(item.amount), 0);
}

export interface BudgetProgress {
  budgetId: string;
  categoryId: string | null;
  name: string;
  spent: number;
  limit: number;
  period: 'weekly' | 'monthly';
  pct: number;
  status: 'ok' | 'near' | 'over';
  /** Spend extrapolated to month-end at the current daily pace — null
   * for weekly budgets (not tracked yet) or on day 1 with no spend to
   * extrapolate from. Always a projection, never presented as actual. */
  projectedSpend: number | null;
  projectedOverBy: number | null;
}

export function daysElapsedInMonth(date = new Date()): number {
  return date.getDate();
}

/**
 * The one place "how much has been spent against this budget" is
 * decided. A budget with `category_id: null` means "Overall" — all
 * spending, not spending with no category — so it's compared against
 * `overallSpend`, not a category lookup. This distinction was
 * previously implemented three different times (BudgetsSection.tsx,
 * financial-assistant.ts's budgetStatus/whatToCut, insights.ts's
 * detectBudgetRisk) and had drifted incorrect in one of them before —
 * exactly the bug class this function exists to prevent from
 * recurring. Every caller must use this instead of recomputing it.
 */
export function computeBudgetProgress(
  budgets: { id: string; category_id: string | null; amount_limit: number; period: 'weekly' | 'monthly' }[],
  categoryBreakdown: { categoryId: string | null; name: string; amount: number }[],
  overallSpend: number,
  daysElapsed = daysElapsedInMonth()
): BudgetProgress[] {
  return budgets.map((b) => {
    const match = b.category_id ? categoryBreakdown.find((c) => c.categoryId === b.category_id) : null;
    const spent = b.category_id ? match?.amount ?? 0 : overallSpend;
    const name = b.category_id ? match?.name ?? 'Unknown category' : 'Overall';
    const pct = b.amount_limit > 0 ? spent / b.amount_limit : 0;
    const status: BudgetProgress['status'] = pct >= 1 ? 'over' : pct >= 0.9 ? 'near' : 'ok';

    let projectedSpend: number | null = null;
    let projectedOverBy: number | null = null;
    if (b.period === 'monthly' && daysElapsed > 0 && spent > 0) {
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      projectedSpend = (spent / daysElapsed) * daysInMonth;
      if (projectedSpend > b.amount_limit) {
        projectedOverBy = projectedSpend - b.amount_limit;
      }
    }

    return {
      budgetId: b.id,
      categoryId: b.category_id,
      name,
      spent,
      limit: b.amount_limit,
      period: b.period,
      pct,
      status,
      projectedSpend,
      projectedOverBy,
    };
  });
}

export function daysRemainingInMonth(date = new Date()): number {
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Math.max(0, daysInMonth - date.getDate() + 1);
}

export type ReportRangePreset = 'this-month' | 'last-month' | 'last-3-months' | 'last-6-months' | 'this-year' | 'custom';

/** The one place a Reports date-range preset turns into actual
 * start/end dates. Every preset resolves to a half-open [start, end)
 * range so boundary days are never double-counted or dropped. */
export function resolveReportRange(
  preset: ReportRangePreset,
  custom?: { start: string; end: string }
): { start: Date; end: Date; label: string } {
  const now = new Date();
  switch (preset) {
    case 'this-month': {
      const start = startOfMonth(now);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      return { start, end, label: 'This month' };
    }
    case 'last-month': {
      const start = startOfPreviousMonth(now);
      const end = startOfMonth(now);
      return { start, end, label: 'Last month' };
    }
    case 'last-3-months': {
      const start = startOfMonthsAgo(3, now);
      const end = new Date(startOfMonth(now));
      end.setMonth(end.getMonth() + 1);
      return { start, end, label: 'Last 3 months' };
    }
    case 'last-6-months': {
      const start = startOfMonthsAgo(6, now);
      const end = new Date(startOfMonth(now));
      end.setMonth(end.getMonth() + 1);
      return { start, end, label: 'Last 6 months' };
    }
    case 'this-year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear() + 1, 0, 1);
      return { start, end, label: 'This year' };
    }
    case 'custom': {
      const start = custom?.start ? new Date(custom.start) : startOfMonth(now);
      // Custom end is inclusive as typed by the user (a date picker's
      // "end date"), so the half-open range needs one day added.
      const end = custom?.end ? new Date(custom.end) : new Date();
      end.setDate(end.getDate() + 1);
      return { start, end, label: 'Custom range' };
    }
  }
}

export function isWithinRange(iso: string, start: Date, end: Date): boolean {
  const d = new Date(iso);
  return d >= start && d < end;
}

export function startOfMonth(date = new Date()): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfPreviousMonth(date = new Date()): Date {
  const d = startOfMonth(date);
  d.setMonth(d.getMonth() - 1);
  return d;
}

export function startOfMonthsAgo(n: number, date = new Date()): Date {
  const d = startOfMonth(date);
  d.setMonth(d.getMonth() - n);
  return d;
}

export function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
