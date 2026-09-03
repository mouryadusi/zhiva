import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { accountInput } from '@/lib/validations/money';
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
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('created_at', { ascending: true });

  if (error) return apiError('accounts.GET', error);

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
  const parsed = accountInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) return apiError('accounts.POST', error);

  return NextResponse.json({ data }, { status: 201 });
}
