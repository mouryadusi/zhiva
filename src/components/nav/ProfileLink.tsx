import Link from 'next/link';

/**
 * The bottom nav is capped at 5 items (Home/Transactions/Budgets/Goals/
 * Assistant) by design. Everything else that still needs to be reachable
 * — profile, accounts, accessibility, journal, day-to-day task lists,
 * logout — lives behind this single fixed entry point instead of
 * crowding the primary nav. Nothing was deleted; it moved here.
 */
export function ProfileLink() {
  return (
    <Link
      href="/you"
      aria-label="Profile and settings"
      className="fixed right-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-raised/90 text-sm font-medium text-ink-muted backdrop-blur hover:text-ink"
      style={{ marginTop: 'env(safe-area-inset-top)' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.75" />
        <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </Link>
  );
}
