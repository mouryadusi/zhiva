import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-errors';

const leaveInput = z.object({ householdId: z.string().uuid() });

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = leaveInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // RLS (migration 0004) already restricts this delete to the caller's
  // own membership row — the .eq('user_id', ...) here is defense in
  // depth, not the only thing preventing removing someone else.
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('household_id', parsed.data.householdId)
    .eq('user_id', user.id);

  if (error) return apiError('household.leave', error);

  return NextResponse.json({ ok: true });
}
