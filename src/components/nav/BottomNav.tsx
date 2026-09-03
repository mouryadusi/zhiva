'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const ITEMS = [
  { href: '/home', label: 'Home' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/budgets', label: 'Budgets' },
  { href: '/goals', label: 'Goals' },
  { href: '/assistant', label: 'Assistant' },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'motion-safe-transition flex flex-col items-center gap-1 px-2 py-3 text-xs font-medium',
                  active ? 'text-accent' : 'text-ink-faint hover:text-ink'
                )}
              >
                <span
                  aria-hidden
                  className={clsx('h-1.5 w-1.5 rounded-full', active ? 'bg-accent' : 'bg-transparent')}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
