import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { goalInput } from '@/lib/validations/tasks';
import { apiError } from '@/lib/api-errors';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = goalInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('goals')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) return apiError('goals.POST', error);

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
  const domain = searchParams.get('domain');

  let query = supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (domain) query = query.eq('domain', domain);

  const { data, error } = await query;
  if (error) return apiError('goals.GET', error);

  return NextResponse.json({ data });
}
