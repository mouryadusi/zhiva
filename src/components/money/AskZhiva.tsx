'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/design-system/Button';
import { Card } from '@/components/design-system/Primitives';
import { ProvenanceBadge, type Provenance } from '@/components/design-system/ProvenanceBadge';
import { LabeledInput } from '@/components/design-system/Field';

interface Exchange {
  question: string;
  text: string;
  evidence: Record<string, unknown>;
  provenance: Provenance;
  ok: boolean;
}

const SUGGESTIONS = [
  'Why did I spend more?',
  'Can I afford ₹20,000?',
  'What should I cut?',
  'How am I doing toward my goal?',
  'Where is my money going?',
  'What subscriptions am I paying for?',
];

function deriveProvenance(evidence: Record<string, unknown>): Provenance {
  const kind = evidence?.kind;
  if (kind === 'estimate' || kind === 'projection' || kind === 'hypothetical') return kind;
  return 'actual';
}

// Evidence objects are structured facts (numbers, category names,
// dates) computed server-side — this just renders them readably, it
// never computes anything from them.
function EvidenceList({ evidence }: { evidence: Record<string, unknown> }) {
  const entries = Object.entries(evidence).filter(([key]) => key !== 'kind');
  if (entries.length === 0) return null;
  return (
    <dl className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="flex justify-between gap-3">
          <dt className="text-ink-faint">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</dt>
          <dd className="text-right text-ink-muted">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AskZhiva({ fullPage = false }: { fullPage?: boolean }) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setQuestion('');
    const res = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q }),
    });
    const body = await res.json().catch(() => null);
    const exchange: Exchange = res.ok
      ? { question: q, text: body.text, evidence: body.evidence ?? {}, provenance: deriveProvenance(body.evidence ?? {}), ok: true }
      : { question: q, text: "I couldn't work that out right now — try again in a moment.", evidence: {}, provenance: 'actual', ok: false };
    setHistory((prev) => [...prev, exchange]);
    setLoading(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    ask(question);
  }

  return (
    <div>
      {!fullPage && (
        <p className="text-sm text-ink-muted">
          Answers are computed directly from your own transactions — never estimated numbers,
          unless clearly labeled otherwise.
        </p>
      )}

      {history.length > 0 && (
        <div className={fullPage ? 'space-y-4' : 'mt-4 space-y-3'}>
          {history.map((h, i) => (
            <div key={i}>
              <p className="text-sm font-medium text-ink-muted">{h.question}</p>
              <Card className="mt-1.5 !p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-ink">{h.text}</p>
                  <ProvenanceBadge kind={h.provenance} />
                </div>
                {h.ok && Object.keys(h.evidence).length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                      className="mt-2 text-xs font-medium text-accent"
                    >
                      {expandedIndex === i ? 'Hide the numbers' : 'How was this calculated?'}
                    </button>
                    {expandedIndex === i && <EvidenceList evidence={h.evidence} />}
                  </>
                )}
              </Card>
            </div>
          ))}
        </div>
      )}

      {history.length === 0 && (
        <div className={fullPage ? 'mt-2 flex flex-wrap gap-2' : 'mt-3 flex flex-wrap gap-2'}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="rounded-full border border-border bg-surface-raised px-3 py-1.5 text-xs text-ink-muted hover:border-accent/50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <LabeledInput
          label="Ask a question about your money"
          labelVisible={false}
          containerClassName="flex-1"
          type="text"
          placeholder="Ask about your money…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={loading || !question.trim()}>
          {loading ? '…' : 'Ask'}
        </Button>
      </form>
    </div>
  );
}
