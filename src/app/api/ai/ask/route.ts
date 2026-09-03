import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-errors';
import { detectIntent } from '@/lib/ai/intent';
import { answerFinancialQuestion } from '@/lib/ai/financial-assistant';

const askInput = z.object({ question: z.string().min(1).max(500) });

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = askInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const detected = detectIntent(parsed.data.question);
    const answer = await answerFinancialQuestion(supabase, user.id, detected);
    return NextResponse.json({ ...answer, intent: detected.intent });
  } catch (error) {
    return apiError('ai.ask', error);
  }
}
