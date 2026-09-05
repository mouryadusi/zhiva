'use client';
import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/design-system/Button';
import { Section } from '@/components/design-system/Primitives';

function LoginForm() {
const router = useRouter();
const params = useSearchParams();
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [error, setError] = useState<string | null>(
params.get('error') === 'confirmation_failed'
? 'That confirmation link is invalid or expired — try signing up again or requesting a new link.'
: null
);
const [loading, setLoading] = useState(false);

async function handleSubmit(e: FormEvent) {
e.preventDefault();
setLoading(true);
setError(null);

const supabase = createClient();
const { error: signInError } = await supabase.auth.signInWithPassword({
  email,
  password,
});

setLoading(false);

if (signInError) {
  setError(signInError.message);
  return;
}

router.push(params.get('next') || '/home');

}
return (
<main className="flex min-h-screen items-center justify-center">
<Section className="w-full max-w-sm py-0">
<h1 className="font-serif text-title-1 text-ink">Welcome back</h1>

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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-ink outline-none focus:border-accent"
        />
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>

    <p className="mt-6 text-sm text-ink-muted">
      New to ZHIVA?{' '}
      <a
        href="/signup"
        className="text-accent underline underline-offset-2"
      >
        Create an account
      </a>
    </p>
  </Section>
</main>

);
}
export default function LoginPage() {
return (
<Suspense
fallback={
<main className="flex min-h-screen items-center justify-center">
<Section className="w-full max-w-sm py-0">
<p className="text-sm text-ink-muted">Loading…</p>
</Section>
</main>
}
>
<LoginForm />
</Suspense>
);
}