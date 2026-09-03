'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/design-system/Button';
import { Section } from '@/components/design-system/Primitives';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    // If email confirmation is enabled in your Supabase project (the
    // default), signUp succeeds but returns no session yet — there's
    // nothing to sign in to until the link in the email is clicked.
    // Redirecting to /home here would just bounce straight back to
    // /login, which is exactly the "won't let me in" symptom.
    if (!data.session) {
      setNeedsConfirmation(true);
      return;
    }
    router.push('/home');
  }

  if (needsConfirmation) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Section className="w-full max-w-sm py-0 text-center">
          <h1 className="font-serif text-title-1 text-ink">Check your email</h1>
          <p className="mt-3 text-ink-muted">
            We sent a confirmation link to <span className="text-ink">{email}</span>. Click it
            to finish setting up your space — you&apos;ll be signed in automatically.
          </p>
        </Section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <Section className="w-full max-w-sm py-0">
        <h1 className="font-serif text-title-1 text-ink">Start your space</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Private by default. Your data belongs to you.
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-ink outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-ink outline-none focus:border-accent"
            />
          </div>
          {error && <p className="text-sm text-critical">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Creating your space…' : 'Create account'}
          </Button>
        </form>
        <p className="mt-6 text-sm text-ink-muted">
          Already have an account?{' '}
          <a href="/login" className="text-accent underline underline-offset-2">
            Sign in
          </a>
        </p>
      </Section>
    </main>
  );
}
