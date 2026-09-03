import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPush } from '@/lib/push';

// Reminder subsystem: Task -> Reminder rule -> Scheduler (this route) ->
// Notification -> User.
//
// Deploy behind Vercel Cron (see vercel.json) hitting this route every
// minute. Uses the admin client because it must act across all users —
// authorization here is the CRON_SECRET check below, not RLS.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60_000); // 1-minute resolution

  const { data: dueReminders, error } = await supabase
    .from('reminders')
    .select('*, tasks(title)')
    .is('sent_at', null)
    .is('dismissed_at', null)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', now.toISOString())
    .lt('scheduled_at', windowEnd.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const reminder of dueReminders ?? []) {
    const { data: subs } = await supabase
      .from('notification_subscriptions')
      .select('endpoint, p256dh, auth_key')
      .eq('user_id', reminder.user_id);

    for (const sub of subs ?? []) {
      try {
        await sendPush(sub, {
          title: 'ZHIVA',
          body: reminder.label,
          url: reminder.task_id ? `/tasks` : '/home',
        });
        sent += 1;
      } catch {
        // A dead/expired subscription shouldn't block the rest of the
        // batch or mark the reminder as unsent for other devices.
        failed += 1;
      }
    }

    await supabase.from('reminders').update({ sent_at: now.toISOString() }).eq('id', reminder.id);
  }

  return NextResponse.json({ processed: dueReminders?.length ?? 0, sent, failed });
}
