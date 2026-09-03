import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError } from '@/lib/api-errors';

const inviteInput = z.object({
  householdId: z.string().uuid(),
  email: z.string().email(),
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
  const parsed = inviteInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Confirm the inviter is actually an owner of this household — RLS
  // on household_members already limits what they can see, but an
  // explicit check here keeps the authorization decision readable in
  // one place rather than relying on RLS alone for a write this
  // consequential.
  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', parsed.data.householdId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only the household owner can invite members.' }, { status: 403 });
  }

  // Looking up a user by email requires the admin API — there is no
  // RLS-safe way for one user's session to query another user's
  // existence by email, by design. This is the one legitimate,
  // narrowly-scoped use of the service-role client in this feature;
  // it never touches financial data.
  const admin = createAdminClient();
  const { data: usersPage, error: lookupError } = await admin.auth.admin.listUsers();
  if (lookupError) return apiError('household.invite.lookup', lookupError);

  const target = usersPage.users.find((u) => u.email?.toLowerCase() === parsed.data.email.toLowerCase());
  if (!target) {
    return NextResponse.json(
      { error: 'No ZHIVA account found with that email. They need to sign up first.' },
      { status: 404 }
    );
  }

  // Insert via the admin client too — household_members intentionally
  // has no client-side insert policy (see migration 0004), so this
  // reviewed server code path is the only way a membership is ever
  // created for someone other than a household's own creator.
  const { data, error } = await admin
    .from('household_members')
    .insert({ household_id: parsed.data.householdId, user_id: target.id, role: 'member' })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'They\'re already a member of this household.' }, { status: 409 });
    }
    return apiError('household.invite.insert', error);
  }

  return NextResponse.json({ data }, { status: 201 });
}
