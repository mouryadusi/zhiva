import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-errors';

const prefsInput = z.object({
  active_presets: z.array(z.string()).max(20),
});

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = prefsInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('accessibility_preferences')
    .upsert({ user_id: user.id, active_presets: parsed.data.active_presets })
    .select()
    .single();

  if (error) return apiError('preferences.POST', error);

  return NextResponse.json({ data });
}
