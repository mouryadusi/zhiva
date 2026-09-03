'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isAppLockConfigured, isUnlockedForSession, markUnlockedForSession, verifyAppLockPasscode, clearAppLock } from '@/lib/app-lock';
import { Section, Eyebrow } from '@/components/design-system/Primitives';
import { Button } from '@/components/design-system/Button';
import { LabeledInput } from '@/components/design-system/Field';

export function AppLockGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  // null = still checking (avoids a flash of unlocked content before
  // we've read localStorage); true/false once known.
  const [locked, setLocked] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setLocked(isAppLockConfigured() && !isUnlockedForSession());
  }, []);

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    const ok = await verifyAppLockPasscode(passcode);
    setChecking(false);
    if (ok) {
      markUnlockedForSession();
      setLocked(false);
    } else {
      setError('That passcode doesn\'t match.');
      setPasscode('');
    }
  }

  async function handleForgot() {
    // Honest, safe recovery: since this lock never leaves the device
    // and ZHIVA's real security boundary is Supabase Auth, resetting
    // it is as simple as clearing the local lock and re-proving
    // identity the normal way — signing back in.
    clearAppLock();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (locked === null) return null; // avoid a flash before we know
  if (!locked) return <>{children}</>;

  return (
    <main className="flex min-h-screen items-center justify-center">
      <Section className="w-full max-w-sm py-0 text-center">
        <Eyebrow>Locked</Eyebrow>
        <h1 className="mt-2 font-serif text-title-1 text-ink">Enter your passcode</h1>
        <p className="mt-2 text-sm text-ink-muted">This is a local lock for this device — it isn&apos;t your account password.</p>
        <form onSubmit={handleUnlock} className="mt-6 space-y-3">
          <LabeledInput
            label="Passcode"
            labelVisible={false}
            type="password"
            inputMode="numeric"
            autoFocus
            placeholder="Passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />
          {error && (
            <p className="text-sm text-critical" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={checking || !passcode} className="w-full">
            {checking ? 'Checking…' : 'Unlock'}
          </Button>
        </form>
        <button type="button" onClick={handleForgot} className="mt-4 text-sm text-ink-faint underline">
          Forgot your passcode? Sign in again to reset it.
        </button>
      </Section>
    </main>
  );
}
