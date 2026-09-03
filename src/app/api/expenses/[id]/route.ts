import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-errors';

// Partial update — same validation shape as create, but every field is
// optional since an edit typically changes one thing (amount, category,
// note) at a time.
const patchInput = z.object({
  amount: z.number().positive().max(1_000_000_000).optional(),
  category_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid().optional(),
  merchant: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  occurred_at: z.string().datetime().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Scoping by user_id here (in addition to RLS) means a mismatched id
  // returns a clean 404-shaped result instead of a silent no-op.
  const { data, error } = await supabase
    .from('transactions')
    .update(parsed.data)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return apiError('expenses.PATCH', error);

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

  const { error } = await supabase.from('transactions').delete().eq('id', params.id).eq('user_id', user.id);
  if (error) return apiError('expenses.DELETE', error);

  return NextResponse.json({ ok: true });
}
