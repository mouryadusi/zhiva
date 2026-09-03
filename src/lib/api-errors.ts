import { NextResponse } from 'next/server';

// Spec requirement: users must never see raw Postgres/PostgREST errors
// (e.g. "Could not find the table 'public.transactions' in the schema
// cache"). Those are developer-facing signals — log them server-side
// (visible in `vercel logs` / your terminal) and return a safe, generic
// message to the client instead.
export function apiError(context: string, error: unknown, status = 500) {
  // eslint-disable-next-line no-console
  console.error(`[api:${context}]`, error);
  return NextResponse.json(
    { error: 'We couldn\'t complete that action right now. Please try again.' },
    { status }
  );
}
