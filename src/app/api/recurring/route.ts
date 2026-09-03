import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recurringTransactionInput } from '@/lib/validations/recurring';
import { apiError } from '@/lib/api-errors';

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('next_run_at', { ascending: true });

  if (error) return apiError('recurring.GET', error);

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = recurringTransactionInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert({ ...parsed.data, user_id: user.id, active: true })
    .select()
    .single();

  if (error) return apiError('recurring.POST', error);

  return NextResponse.json({ data }, { status: 201 });
}
