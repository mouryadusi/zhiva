import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transactionInput } from '@/lib/validations/money';
import { apiError } from '@/lib/api-errors';

// Authorization is never trusted from the client: we read the session
// user from cookies (set by middleware) and every insert is scoped to
// that user_id. RLS on `transactions` enforces this again at the DB
// layer even if this check were ever bypassed.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = transactionInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) return apiError('expenses.POST', error);

  return NextResponse.json({ data }, { status: 201 });
}

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 30), 100);

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) return apiError('expenses.GET', error);

  return NextResponse.json({ data });
}
