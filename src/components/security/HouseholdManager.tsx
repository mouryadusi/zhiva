'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Eyebrow } from '@/components/design-system/Primitives';
import { Button } from '@/components/design-system/Button';
import { LabeledInput } from '@/components/design-system/Field';

interface Membership {
  role: 'owner' | 'member';
  households: { id: string; name: string; created_by: string } | null;
}

export function HouseholdManager({ memberships }: { memberships: Membership[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/household', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError('Couldn\'t create that household — try again.');
      return;
    }
    setName('');
    setCreating(false);
    router.refresh();
  }

  return (
    <div>
      <Eyebrow>Household</Eyebrow>
      <p className="mt-2 text-sm text-ink-muted">
        Invite a partner to share ZHIVA with. Right now this only sets up who&apos;s in the
        household — shared budgets, accounts, and goals aren&apos;t connected to it yet, so
        everyone&apos;s money data stays private to them until that&apos;s built.
      </p>

      {memberships.length === 0 ? (
        creating ? (
          <form onSubmit={handleCreate} className="mt-3 space-y-2 rounded-card border border-border bg-surface-raised p-4">
            <LabeledInput
              label="Household name"
              labelVisible={false}
              type="text"
              autoFocus
              placeholder="Household name (e.g. The Smiths)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {error && (
              <p className="text-sm text-critical" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={submitting || !name}>
                {submitting ? 'Creating…' : 'Create'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setCreating(true)} className="mt-3 text-sm font-medium text-accent">
            + Create a household
          </button>
        )
      ) : (
        memberships.map((m) =>
          m.households ? <HouseholdCard key={m.households.id} household={m.households} role={m.role} /> : null
        )
      )}
    </div>
  );
}

function HouseholdCard({ household, role }: { household: { id: string; name: string }; role: 'owner' | 'member' }) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteMessage(null);
    const res = await fetch('/api/household/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId: household.id, email: inviteEmail }),
    });
    const body = await res.json().catch(() => null);
    setInviting(false);
    if (res.ok) {
      setInviteMessage(`Added ${inviteEmail} to the household.`);
      setInviteEmail('');
      router.refresh();
    } else {
      setInviteMessage(body?.error ?? 'Couldn\'t send that invite.');
    }
  }

  async function handleLeave() {
    setLeaving(true);
    await fetch('/api/household/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId: household.id }),
    });
    setLeaving(false);
    router.refresh();
  }

  return (
    <Card className="mt-3 !p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-ink">{household.name}</p>
        <span className="text-xs capitalize text-ink-faint">{role}</span>
      </div>

      {role === 'owner' && (
        <form onSubmit={handleInvite} className="mt-3 flex gap-2">
          <LabeledInput
            label="Invite by email"
            labelVisible={false}
            containerClassName="flex-1"
            type="email"
            placeholder="Invite by email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={inviting || !inviteEmail}>
            {inviting ? '…' : 'Invite'}
          </Button>
        </form>
      )}
      {inviteMessage && <p className="mt-2 text-xs text-ink-muted">{inviteMessage}</p>}

      <button type="button" onClick={handleLeave} disabled={leaving} className="mt-3 text-xs font-medium text-critical">
        {leaving ? 'Leaving…' : 'Leave household'}
      </button>
    </Card>
  );
}
