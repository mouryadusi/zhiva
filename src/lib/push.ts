import webpush from 'web-push';

// Configured lazily so builds without VAPID keys set don't crash at
// import time — the cron route checks for keys before calling this.
let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    'mailto:support@zhiva.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
    process.env.VAPID_PRIVATE_KEY ?? ''
  );
  configured = true;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

export async function sendPush(
  sub: PushSubscriptionRecord,
  payload: { title: string; body: string; url?: string }
) {
  ensureConfigured();
  await webpush.sendNotification(
    {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth_key },
    },
    JSON.stringify(payload)
  );
}
