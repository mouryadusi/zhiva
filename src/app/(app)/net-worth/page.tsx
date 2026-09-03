import { createClient } from '@/lib/supabase/server';
import { Section, Eyebrow, Card } from '@/components/design-system/Primitives';
import { calculateAccountBalance, sumAccountBalances } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function NetWorthPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: accounts }, { data: transactions }] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', user.id).eq('archived', false).order('created_at'),
    supabase.from('transactions').select('kind, amount, account_id, transfer_account_id').eq('user_id', user.id),
  ]);

  const rows = accounts ?? [];
  const txns = transactions ?? [];

  // A credit card (or any account) with a negative balance IS a
  // liability, by definition — that's what "you owe more than you
  // have in it" means. Grouping by the actual computed sign is more
  // honest than grouping by account type label, which could be wrong
  // (an overdrawn "bank" account is a liability too).
  const withBalances = rows.map((a) => ({ account: a, balance: calculateAccountBalance(a, txns) }));
  const assets = withBalances.filter((a) => a.balance >= 0).sort((a, b) => b.balance - a.balance);
  const liabilities = withBalances.filter((a) => a.balance < 0).sort((a, b) => a.balance - b.balance);

  const currencies = new Set(rows.map((a) => a.currency));
  const hasMultipleCurrencies = currencies.size > 1;
  const primaryCurrency = rows[0]?.currency ?? 'USD';
  const netWorth = sumAccountBalances(rows, txns);

  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);

  return (
    <main>
      <Section className="pb-4 pt-16 sm:pt-22">
        <Eyebrow>Net worth</Eyebrow>
        {rows.length === 0 ? (
          <h1 className="mt-2 font-serif text-display-2 text-ink">Add an account to get started</h1>
        ) : hasMultipleCurrencies ? (
          <>
            <h1 className="mt-2 font-serif text-display-2 text-ink">Multiple currencies</h1>
            <p className="mt-2 text-ink-muted">
              ZHIVA won&apos;t add balances across different currencies into one misleading number.
              See the breakdown below, grouped by account instead.
            </p>
          </>
        ) : (
          <h1 className="mt-2 font-serif text-display-2 text-ink">
            {primaryCurrency} {netWorth.toFixed(2)}
          </h1>
        )}
      </Section>

      {rows.length > 0 && (
        <>
          <Section className="py-4">
            <Eyebrow>Assets</Eyebrow>
            {assets.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No positive-balance accounts yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {assets.map(({ account, balance }) => (
                  <Card key={account.id} className="!p-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-ink">{account.name}</span>
                      <span className="ml-2 text-xs capitalize text-ink-faint">{account.type.replace('_', ' ')}</span>
                    </div>
                    <span className="font-medium text-positive">
                      {account.currency} {balance.toFixed(2)}
                    </span>
                  </Card>
                ))}
                {assets.length > 1 && !hasMultipleCurrencies && (
                  <p className="text-right text-sm text-ink-muted">
                    Total assets: {primaryCurrency} {totalAssets.toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </Section>

          <Section className="py-4 pb-24">
            <Eyebrow>Liabilities</Eyebrow>
            {liabilities.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">Nothing owed — no negative-balance accounts.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {liabilities.map(({ account, balance }) => (
                  <Card key={account.id} className="!p-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-ink">{account.name}</span>
                      <span className="ml-2 text-xs capitalize text-ink-faint">{account.type.replace('_', ' ')}</span>
                    </div>
                    <span className="font-medium text-critical">
                      {account.currency} {balance.toFixed(2)}
                    </span>
                  </Card>
                ))}
                {liabilities.length > 1 && !hasMultipleCurrencies && (
                  <p className="text-right text-sm text-ink-muted">
                    Total liabilities: {primaryCurrency} {totalLiabilities.toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </Section>

          <Section className="py-2 pb-24">
            <p className="text-xs text-ink-faint">
              Net worth reflects only the accounts and transactions you&apos;ve logged in ZHIVA —
              loans, investments, and property aren&apos;t tracked yet, so this isn&apos;t a
              complete picture unless everything you own and owe is entered here. Historical net
              worth over time isn&apos;t shown because ZHIVA doesn&apos;t store point-in-time
              snapshots yet — this is always today&apos;s figure, computed fresh.
            </p>
          </Section>
        </>
      )}
    </main>
  );
}
