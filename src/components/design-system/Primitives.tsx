import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export function Section({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section className={clsx('mx-auto max-w-3xl px-6 py-14 sm:py-18', className)} {...props}>
      {children}
    </section>
  );
}

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={clsx(
        'rounded-card border border-border bg-surface-raised p-5 shadow-soft',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
    >
      <div
        className="motion-safe-transition h-full rounded-full bg-accent"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">{children}</p>
  );
}
