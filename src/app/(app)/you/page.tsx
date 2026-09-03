import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Section, Eyebrow, Card } from '@/components/design-system/Primitives';
import { AccessibilityPanel } from '@/components/accessibility/AccessibilityPanel';
import { PasscodeSettings } from '@/components/security/PasscodeSettings';
import { BankSyncSettings } from '@/components/security/BankSyncSettings';
import { AccountsManager } from '@/components/money/AccountsManager';
import { LogoutButton } from '@/components/nav/LogoutButton';
import { calculateAccountBalance } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function YouPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: memories }, { data: accounts }, { data: balanceTransactions }] = await Promise.all([
    supabase
      .from('ai_memories')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('created_at', { ascending: true }),
    // Every transaction ever, not a recent-N slice — a balance is
    // opening_balance + the full history, not an approximation. For a
    // very high-volume account this is a candidate for a materialized
    // running balance later; correctness comes first (see README).
    supabase
      .from('transactions')
      .select('kind, amount, account_id, transfer_account_id')
      .eq('user_id', user.id),
  ]);

  const balances = new Map(
    (accounts ?? []).map((a) => [a.id, calculateAccountBalance(a, balanceTransactions ?? [])])
  );

  return (
    <main>
      <Section className="pb-4 pt-16 sm:pt-22">
        <Eyebrow>You</Eyebrow>
        <h1 className="mt-2 font-serif text-display-2 text-ink">{user.email}</h1>
      </Section>

      <Section className="py-4">
        <AccountsManager accounts={accounts ?? []} balances={balances} />
      </Section>

      <Section className="py-4">
        <Eyebrow>More</Eyebrow>
        <div className="mt-3 divide-y divide-border overflow-hidden rounded-card border border-border">
          {[
            { href: '/journal', label: 'Journal', hint: 'Daily reflection' },
            { href: '/tasks', label: 'Day-to-day tasks', hint: 'Today, this week, this month' },
            { href: '/insights', label: 'All insights', hint: 'Every detected insight, ranked' },
            { href: '/recurring', label: 'Recurring transactions', hint: 'Rent, salary, subscriptions' },
            { href: '/reports', label: 'Reports', hint: 'Charts, trends, export' },
            { href: '/net-worth', label: 'Net worth', hint: 'Assets minus liabilities' },
            { href: '/calendar', label: 'Calendar', hint: 'Daily spending view' },
            { href: '/household', label: 'Household', hint: 'Share ZHIVA with a partner' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between bg-surface-raised px-4 py-3.5 hover:bg-surface-sunken"
            >
              <span className="font-medium text-ink">{item.label}</span>
              <span className="text-sm text-ink-faint">{item.hint}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section className="py-4">
        <Eyebrow>What ZHIVA remembers</Eyebrow>
        {memories && memories.length > 0 ? (
          <div className="mt-4 space-y-2">
            {memories.map((m) => (
              <Card key={m.id} className="!p-4">
                <p className="text-sm text-ink">{m.content}</p>
                <p className="mt-1 text-xs text-ink-faint capitalize">
                  {m.kind.replace('_', ' ')} · {m.source === 'user_stated' ? 'you told ZHIVA this' : 'inferred from your data'}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-ink-muted">
            Nothing stored yet. ZHIVA only remembers what you share or what your own
            data clearly shows — never a guess dressed up as a fact.
          </p>
        )}
      </Section>

      <Section className="py-4">
        <PasscodeSettings />
      </Section>

      <Section className="py-4">
        <BankSyncSettings />
      </Section>

      <AccessibilityPanel />

      <Section className="py-4 pb-24">
        <LogoutButton />
      </Section>
    </main>
  );
}
