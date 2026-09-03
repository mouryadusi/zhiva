'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/design-system/Button';
import { Card, Eyebrow } from '@/components/design-system/Primitives';
import { LabeledInput, LabeledSelect } from '@/components/design-system/Field';
import type { Account } from '@/types/database';

const TYPES: Account['type'][] = ['cash', 'bank', 'credit_card', 'savings', 'wallet', 'upi', 'custom'];

export function AccountsManager({
  accounts,
  balances,
}: {
  accounts: Account[];
  balances: Map<string, number>;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState<Account['type']>('bank');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, currency: 'USD', opening_balance: 0 }),
    });
    setSubmitting(false);
    setName('');
    setOpen(false);
    router.refresh();
  }

  return (
    <div>
      <Eyebrow>Accounts</Eyebrow>
      {accounts.length > 0 && (
        <div className="mt-3 space-y-2">
          {accounts.map((a) => {
            const balance = balances.get(a.id) ?? 0;
            return (
              <Card key={a.id} className="!p-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-ink">{a.name}</span>
                  <span className="ml-2 text-xs capitalize text-ink-faint">{a.type.replace('_', ' ')}</span>
                </div>
                <span className={`font-medium ${balance < 0 ? 'text-critical' : 'text-ink'}`}>
                  {a.currency} {balance.toFixed(2)}
                </span>
              </Card>
            );
          })}
        </div>
      )}
      {open ? (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2 rounded-card border border-border bg-surface-raised p-4">
          <LabeledInput
            label="Account name"
            labelVisible={false}
            type="text"
            autoFocus
            placeholder="Account name (e.g. HDFC Savings)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <LabeledSelect
            label="Account type"
            labelVisible={false}
            value={type}
            onChange={(e) => setType(e.target.value as Account['type'])}
          >
            {TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t.replace('_', ' ')}
              </option>
            ))}
          </LabeledSelect>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add account'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 text-sm font-medium text-accent">
          + Add account
        </button>
      )}
    </div>
  );
}
