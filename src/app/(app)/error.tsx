'use client';

import { useEffect } from 'react';
import { Section, Eyebrow } from '@/components/design-system/Primitives';
import { Button } from '@/components/design-system/Button';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[app error]', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <Section className="w-full max-w-sm py-0 text-center">
        <Eyebrow>Something went wrong</Eyebrow>
        <p className="mt-3 font-serif text-title-1 text-ink">We couldn&apos;t load that.</p>
        <p className="mt-2 text-ink-muted">
          Nothing was changed or lost — try again in a moment.
        </p>
        <Button onClick={reset} className="mt-5">
          Try again
        </Button>
      </Section>
    </main>
  );
}
