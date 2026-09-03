import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { taskInput } from '@/lib/validations/tasks';
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
  const parsed = taskInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) return apiError('tasks.POST', error);

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
  const scope = searchParams.get('scope') ?? 'today';

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('scope', scope)
    .order('completed_at', { ascending: true, nullsFirst: true });

  if (error) return apiError('tasks.GET', error);

  return NextResponse.json({ data });
}
