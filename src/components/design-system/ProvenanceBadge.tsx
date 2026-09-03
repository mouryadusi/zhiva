import clsx from 'clsx';

export type Provenance = 'actual' | 'estimate' | 'projection' | 'hypothetical';

const CONFIG: Record<Provenance, { label: string; className: string }> = {
  actual: { label: 'Actual', className: 'text-ink-faint' },
  estimate: { label: 'Estimate', className: 'text-caution border-caution/30 bg-caution/5' },
  projection: { label: 'Projection', className: 'text-accent border-accent/30 bg-accent/5' },
  hypothetical: { label: 'Hypothetical', className: 'text-ink-muted border-border bg-surface-sunken' },
};

/**
 * The single visual vocabulary for "how real is this number." Actual
 * data gets no badge by default (it's the ground truth, badging it
 * would be noise) — pass `showActual` to render one anyway where
 * context needs it spelled out (e.g. next to a projection for
 * contrast). Every other kind always renders a badge: a projection or
 * hypothetical must never be visually indistinguishable from a real
 * total, per the non-negotiable rule that governs this whole app.
 */
export function ProvenanceBadge({ kind, showActual = false }: { kind: Provenance; showActual?: boolean }) {
  if (kind === 'actual' && !showActual) return null;
  const { label, className } = CONFIG[kind];
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        className
      )}
    >
      {label}
    </span>
  );
}

/** Inline variant for use mid-sentence in the Assistant's answers. */
export function ProvenanceNote({ kind, note }: { kind: Provenance; note?: string }) {
  if (kind === 'actual') return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-faint">
      <ProvenanceBadge kind={kind} />
      {note && <span>{note}</span>}
    </p>
  );
}
