// Bank-sync provider abstraction. No banking data provider (Plaid,
// TrueLayer, Yodlee, etc.) is connected in this codebase — connecting
// one requires provider credentials, a signed agreement, and typically
// a backend webhook endpoint, none of which exist here. This file
// exists so that work can start against a stable interface: a real
// implementation later just needs to satisfy `BankSyncProvider` and be
// swapped in for `unconfiguredProvider` below — nothing in the UI
// needs to change.

export interface BankConnectionStatus {
  connected: boolean;
  providerName: string | null;
  lastSyncedAt: string | null;
  reason?: string;
}

export interface BankAccountCandidate {
  externalId: string;
  name: string;
  institution: string;
  mask: string; // last 4 digits, never the full account number
}

export interface BankSyncProvider {
  getStatus(userId: string): Promise<BankConnectionStatus>;
  /** Starts a connection flow (e.g. Plaid Link). Returns a URL/token
   * to redirect to or embed — never a fabricated success. */
  startConnection(userId: string): Promise<{ redirectUrl: string } | { error: string }>;
  listAccounts(userId: string): Promise<BankAccountCandidate[]>;
  disconnect(userId: string): Promise<void>;
}

export const unconfiguredProvider: BankSyncProvider = {
  async getStatus() {
    return {
      connected: false,
      providerName: null,
      lastSyncedAt: null,
      reason: 'No bank-sync provider is configured for this ZHIVA instance.',
    };
  },
  async startConnection() {
    return { error: 'Bank sync requires a provider (e.g. Plaid) to be configured with real credentials.' };
  },
  async listAccounts() {
    return [];
  },
  async disconnect() {
    // Nothing to disconnect — no-op is correct here, not an error.
  },
};
