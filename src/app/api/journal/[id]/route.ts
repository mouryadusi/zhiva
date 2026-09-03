import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-errors';

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) return apiError('journal.DELETE', error);

  return NextResponse.json({ ok: true });
}
