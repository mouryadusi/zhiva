import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Supabase's email confirmation / magic link redirects here with a
// `code` query param. This exchanges it for a real session (writing
// the session cookie), then sends the user into the app. Without this
// route, clicking the confirmation link does nothing useful — the user
// stays signed out no matter how many times they click it.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/home';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
