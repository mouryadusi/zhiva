import Link from 'next/link';
import type { ReactNode } from 'react';
import { buttonClasses } from './Button';

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-border p-8 text-center">
      {icon && <div className="mb-3 flex justify-center text-ink-faint">{icon}</div>}
      <p className="font-serif text-title-1 text-ink">{title}</p>
      <p className="mt-2 text-ink-muted">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className={buttonClasses({ variant: 'primary', size: 'sm', className: 'mt-4' })}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
