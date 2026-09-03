import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-errors';

const patchInput = z.object({
  completed_at: z.string().datetime().nullable().optional(),
  title: z.string().min(1).max(300).optional(),
  due_at: z.string().datetime().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  postpone: z.boolean().optional(), // increments postponed_count server-side
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

  const { postpone, ...rest } = parsed.data;

  // RLS also enforces this, but scoping by user_id here means a
  // mismatched id returns a clean 404 instead of a silent no-op.
  if (postpone) {
    const { data: current } = await supabase
      .from('tasks')
      .select('postponed_count')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();
    if (current) {
      (rest as Record<string, unknown>).postponed_count = current.postponed_count + 1;
    }
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(rest)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return apiError('tasks.PATCH', error);

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

  const { error } = await supabase.from('tasks').delete().eq('id', params.id).eq('user_id', user.id);
  if (error) return apiError('tasks.DELETE', error);

  return NextResponse.json({ ok: true });
}
