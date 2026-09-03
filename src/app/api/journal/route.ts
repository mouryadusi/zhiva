import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { journalEntryInput } from '@/lib/validations/tasks';
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
  const parsed = journalEntryInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .upsert(
      { ...parsed.data, user_id: user.id },
      { onConflict: 'user_id,entry_date' }
    )
    .select()
    .single();

  if (error) return apiError('journal.POST', error);

  return NextResponse.json({ data });
}

// Lists recent entries, optionally filtered by a free-text search
// against the entry content (used by the "browse previous entries"
// and search features in the Journal UI).
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const limit = Math.min(Number(searchParams.get('limit') ?? 30), 100);

  let query = supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('entry_date', { ascending: false })
    .limit(limit);

  if (q) {
    query = query.ilike('content', `%${q}%`);
  }

  const { data, error } = await query;
  if (error) return apiError('journal.GET', error);

  return NextResponse.json({ data });
}
