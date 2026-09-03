import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recurringTransactionPatch } from '@/lib/validations/recurring';
import { apiError } from '@/lib/api-errors';

// Also used for pause/resume: PATCH { active: false } pauses,
// { active: true } resumes. No separate endpoint needed.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = recurringTransactionPatch.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('recurring_transactions')
    .update(parsed.data)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return apiError('recurring.PATCH', error);

  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { error } = await supabase.from('recurring_transactions').delete().eq('id', params.id).eq('user_id', user.id);
  if (error) return apiError('recurring.DELETE', error);

  return NextResponse.json({ ok: true });
}
