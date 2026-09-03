// This is a LOCAL, DEVICE-LEVEL lock, not account security. It exists
// to deter someone picking up an already-signed-in phone or laptop
// from casually opening ZHIVA — it does not protect against anyone
// with access to the browser's storage or dev tools, and it is not a
// substitute for the real authentication boundary, which is Supabase
// Auth + RLS (see src/middleware.ts, supabase/migrations/*.sql). A
// passcode set here never leaves the device and is never sent to the
// server. This scope is stated plainly in the Security settings UI —
// see AppLock.tsx — rather than implied to be stronger than it is.

const STORAGE_KEY = 'zhiva:applock';

interface StoredLock {
  saltHex: string;
  hashHex: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

async function hashPasscode(passcode: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const data = new Uint8Array([...salt, ...encoder.encode(passcode)]);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

export function isAppLockConfigured(): boolean {
  return typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) != null;
}

export async function setAppLockPasscode(passcode: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashHex = await hashPasscode(passcode, salt);
  const record: StoredLock = { saltHex: bytesToHex(salt), hashHex };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export async function verifyAppLockPasscode(passcode: string): Promise<boolean> {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const record: StoredLock = JSON.parse(raw);
  const candidate = await hashPasscode(passcode, hexToBytes(record.saltHex));
  return candidate === record.hashHex;
}

export function clearAppLock(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.sessionStorage.removeItem('zhiva:unlocked');
}

export function markUnlockedForSession(): void {
  window.sessionStorage.setItem('zhiva:unlocked', '1');
}

export function isUnlockedForSession(): boolean {
  return typeof window !== 'undefined' && window.sessionStorage.getItem('zhiva:unlocked') === '1';
}
