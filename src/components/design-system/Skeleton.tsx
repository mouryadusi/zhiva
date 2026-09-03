import clsx from 'clsx';

/** A single pulsing placeholder block. Respects reduced motion via the
 * same --motion-scale variable everything else in the app uses — under
 * a11y-reduced-motion the pulse animation is disabled by the CSS rule
 * below rather than left running. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-lg bg-surface-sunken', className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-card border border-border bg-surface-raised p-5">
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="mt-3 h-6 w-40" />
      <SkeletonBlock className="mt-2 h-3 w-32" />
    </div>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
