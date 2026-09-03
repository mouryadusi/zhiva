import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-errors';

const createInput = z.object({ name: z.string().min(1).max(100) });

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: memberships, error } = await supabase
    .from('household_members')
    .select('role, households(id, name, created_by)')
    .eq('user_id', user.id);

  if (error) return apiError('household.GET', error);

  return NextResponse.json({ data: memberships });
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
  const parsed = createInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('households')
    .insert({ name: parsed.data.name, created_by: user.id })
    .select()
    .single();

  if (error) return apiError('household.POST', error);

  return NextResponse.json({ data }, { status: 201 });
}
