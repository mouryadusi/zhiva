'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card, Eyebrow } from '@/components/design-system/Primitives';
import { Button } from '@/components/design-system/Button';
import { LabeledInput } from '@/components/design-system/Field';
import { isAppLockConfigured, setAppLockPasscode, clearAppLock, markUnlockedForSession } from '@/lib/app-lock';

export function PasscodeSettings() {
  const [configured, setConfigured] = useState(false);
  const [editing, setEditing] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfigured(isAppLockConfigured());
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (passcode.length < 4) {
      setError('Use at least 4 digits.');
      return;
    }
    if (passcode !== confirm) {
      setError('Passcodes don\'t match.');
      return;
    }
    await setAppLockPasscode(passcode);
    markUnlockedForSession(); // don't immediately re-lock the person who just set it
    setConfigured(true);
    setEditing(false);
    setSaved(true);
    setPasscode('');
    setConfirm('');
  }

  function handleRemove() {
    clearAppLock();
    setConfigured(false);
    setSaved(false);
  }

  return (
    <div>
      <Eyebrow>Passcode lock</Eyebrow>
      <p className="mt-2 text-sm text-ink-muted">
        A local passcode for this device — it hides ZHIVA behind a lock screen if someone else
        picks up your phone while you&apos;re signed in. It never leaves this device and isn&apos;t
        sent to ZHIVA&apos;s servers, so it&apos;s a convenience layer, not account security — your
        real account protection is your login.
      </p>

      {saved && <p className="mt-2 text-sm text-positive">Passcode saved.</p>}

      {!editing ? (
        <div className="mt-3">
          <Card className="!p-4 flex items-center justify-between">
            <span className="text-sm text-ink">{configured ? 'Passcode is set' : 'No passcode set'}</span>
            <div className="flex gap-3 text-sm font-medium">
              <button type="button" onClick={() => setEditing(true)} className="text-accent">
                {configured ? 'Change' : 'Set up'}
              </button>
              {configured && (
                <button type="button" onClick={handleRemove} className="text-critical">
                  Remove
                </button>
              )}
            </div>
          </Card>
        </div>
      ) : (
        <form onSubmit={handleSave} className="mt-3 space-y-2 rounded-card border border-border bg-surface-raised p-4">
          <LabeledInput
            label="New passcode"
            labelVisible={false}
            type="password"
            inputMode="numeric"
            placeholder="New passcode (4+ digits)"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />
          <LabeledInput
            label="Confirm passcode"
            labelVisible={false}
            type="password"
            inputMode="numeric"
            placeholder="Confirm passcode"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && (
            <p className="text-sm text-critical" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Save
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
