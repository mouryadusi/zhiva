import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-errors';
import { reminderInput } from '@/lib/validations/tasks';

// Writes a reminder *rule*. Resolving it into an actual scheduled_at
// notification is the scheduler's job (see
// src/app/api/cron/reminders/route.ts) — this route never sends a
// notification directly.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = reminderInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('reminders')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) return apiError('reminders.POST', error);

  return NextResponse.json({ data }, { status: 201 });
}
