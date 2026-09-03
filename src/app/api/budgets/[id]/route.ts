import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-errors';

const patchInput = z.object({
  amount_limit: z.number().nonnegative().optional(),
  period: z.enum(['weekly', 'monthly']).optional(),
  category_id: z.string().uuid().nullable().optional(),
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

  const { data, error } = await supabase
    .from('budgets')
    .update(parsed.data)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return apiError('budgets.PATCH', error);

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

  const { error } = await supabase.from('budgets').delete().eq('id', params.id).eq('user_id', user.id);
  if (error) return apiError('budgets.DELETE', error);

  return NextResponse.json({ ok: true });
}
