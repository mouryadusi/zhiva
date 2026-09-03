import { Card, Eyebrow } from '@/components/design-system/Primitives';
import { unconfiguredProvider } from '@/lib/bank-sync/provider';

export async function BankSyncSettings() {
  // Always the unconfigured provider today — see
  // src/lib/bank-sync/provider.ts for how a real one would plug in.
  const status = await unconfiguredProvider.getStatus('');

  return (
    <div>
      <Eyebrow>Bank connection</Eyebrow>
      <Card className="mt-3 !p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">{status.connected ? 'Connected' : 'Not connected'}</span>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-faint"
            title={status.reason}
          >
            Connect a bank
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-faint">{status.reason}</p>
        <p className="mt-2 text-xs text-ink-faint">
          For now, add transactions manually or set up recurring rules on the Recurring page — both
          work fully without a bank connection.
        </p>
      </Card>
    </div>
  );
}
