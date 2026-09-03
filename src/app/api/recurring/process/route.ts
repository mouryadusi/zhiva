import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processDueRecurringTransactions } from '@/lib/recurring';
import { apiError } from '@/lib/api-errors';

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const result = await processDueRecurringTransactions(supabase, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return apiError('recurring.process', error);
  }
}
