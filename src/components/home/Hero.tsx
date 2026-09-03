import Link from 'next/link';

export function Hero() {
  return (
    <section className="relative flex min-h-[92vh] flex-col justify-center overflow-hidden px-6 py-24">
      <p className="font-sans text-xs font-medium uppercase tracking-[0.2em] text-ink-faint">
        ZHIVA
      </p>
      <h1 className="mt-6 max-w-4xl font-serif text-display-1 text-ink">
        Know your life.
        <br />
        Shape what&apos;s next.
      </h1>
      <p className="mt-8 max-w-md text-lg text-ink-muted">
        Money, tasks, goals, and reflection — held in one calm, private space
        that actually understands what&apos;s going on.
      </p>
      <div className="mt-10">
        <Link
          href="/signup"
          className="motion-safe-transition inline-flex items-center justify-center gap-2 rounded-full bg-accent px-8 py-4 text-lg font-medium text-accent-ink hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Start your space
        </Link>
      </div>
    </section>
  );
}
