import { createClient } from '@/lib/supabase/server';
import { Section, Eyebrow } from '@/components/design-system/Primitives';
import { ReportRangeSelector } from '@/components/reports/ReportRangeSelector';
import {
  IncomeVsExpenseChart,
  NetCashFlowChart,
  CategoryBarChart,
  CategoryTrendChart,
  IncomeTrendChart,
  NamedAmountList,
  ReportSummaryCard,
} from '@/components/reports/ReportCharts';
import { ExportButton } from '@/components/reports/ExportButton';
import {
  resolveReportRange,
  summarizeByCurrency,
  categoryBreakdownFromTransactions,
  categoryMonthlySeries,
  monthlySeries,
  topMerchants,
  accountSummary,
  type ReportRangePreset,
} from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { range?: string; start?: string; end?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const preset = (searchParams.range as ReportRangePreset) ?? 'this-month';
  const { start, end, label } = resolveReportRange(preset, { start: searchParams.start ?? '', end: searchParams.end ?? '' });

  const [{ data: transactions }, { data: categories }, { data: accounts }, { data: allTimeTransactions }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('occurred_at', start.toISOString())
      .lt('occurred_at', end.toISOString())
      .order('occurred_at', { ascending: true }),
    supabase.from('categories').select('id, name').eq('user_id', user.id),
    supabase.from('accounts').select('id, name, currency, opening_balance').eq('user_id', user.id).eq('archived', false),
    // accountSummary needs full history for the balance column, kept
    // separate from the period-scoped transactions above — see the
    // doc comment on accountSummary in money.ts for why.
    supabase.from('transactions').select('kind, amount, account_id, transfer_account_id').eq('user_id', user.id),
  ]);

  const rows = transactions ?? [];
  const currencyTotals = summarizeByCurrency(rows);
  const hasMultipleCurrencies = currencyTotals.size > 1;
  const primaryCurrency = accounts?.[0]?.currency ?? 'USD';
  const single = currencyTotals.size === 1 ? [...currencyTotals.values()][0] : null;

  const categoryList = categoryBreakdownFromTransactions(rows, categories ?? [], 'expense').map((c) => ({
    name: c.name,
    amount: c.amount,
  }));

  const merchants = topMerchants(rows, 8).map((m) => ({ name: `${m.merchant} (${m.count})`, amount: m.amount }));

  const accounts_ = accountSummary(accounts ?? [], allTimeTransactions ?? [], rows)
    .filter((a) => a.periodExpense > 0)
    .sort((a, b) => b.periodExpense - a.periodExpense)
    .map((a) => ({ name: a.name, amount: a.periodExpense }));

  const monthlyBuckets = monthlySeries(rows);
  const categoryTrend = categoryMonthlySeries(rows, categories ?? []);

  return (
    <main>
      <Section className="pb-4 pt-16 sm:pt-22">
        <Eyebrow>Reports</Eyebrow>
        <h1 className="mt-2 font-serif text-display-2 text-ink">{label}</h1>
      </Section>

      <Section className="py-2">
        <ReportRangeSelector active={preset} />
      </Section>

      <Section className="py-4">
        {rows.length === 0 ? (
          <p className="text-ink-muted">No transactions in this range yet.</p>
        ) : hasMultipleCurrencies ? (
          <p className="text-ink-muted">
            This range includes more than one currency — ZHIVA won&apos;t combine them into one
            misleading total. Narrow the range or check individual accounts on{' '}
            <a href="/you" className="font-medium text-accent">
              You
            </a>
            .
          </p>
        ) : (
          <div className="space-y-8">
            <ReportSummaryCard income={single?.income ?? 0} expense={single?.expense ?? 0} net={single?.net ?? 0} currency={primaryCurrency} />
            <IncomeVsExpenseChart data={monthlyBuckets} currency={primaryCurrency} />
            <IncomeTrendChart data={monthlyBuckets} currency={primaryCurrency} />
            <NetCashFlowChart data={monthlyBuckets} currency={primaryCurrency} />
            <CategoryTrendChart data={categoryTrend} currency={primaryCurrency} />
            <CategoryBarChart data={categoryList} currency={primaryCurrency} />
            <NamedAmountList title="Top merchants" items={merchants} currency={primaryCurrency} emptyText="No merchant data in this range." />
            <NamedAmountList title="By account" items={accounts_} currency={primaryCurrency} emptyText="No account activity in this range." />
          </div>
        )}
      </Section>

      <Section className="py-4 pb-24">
        <Eyebrow>Export</Eyebrow>
        <p className="mt-2 text-sm text-ink-muted">
          Download every transaction in this range ({label.toLowerCase()}) as a file.
        </p>
        <div className="mt-3 flex gap-2">
          <ExportButton transactions={rows} categories={categories ?? []} accounts={accounts ?? []} format="csv" rangeLabel={label} />
          <ExportButton transactions={rows} categories={categories ?? []} accounts={accounts ?? []} format="json" rangeLabel={label} />
        </div>
      </Section>
    </main>
  );
}
