'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs: number;
}

interface ToastContextValue {
  /** Shows a toast. If `onAction`/`actionLabel` are given (e.g. "Undo"),
   * the toast stays interactive until the action is taken or it expires. */
  showToast: (message: string, opts?: { actionLabel?: string; onAction?: () => void; durationMs?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const showToast = useCallback<ToastContextValue['showToast']>((message, opts) => {
    const id = nextId++;
    const durationMs = opts?.durationMs ?? 5000;
    setToasts((prev) => [...prev, { id, message, actionLabel: opts?.actionLabel, onAction: opts?.onAction, durationMs }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, durationMs);
    timers.current.set(id, timer);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="motion-safe-transition pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-full border border-border bg-surface-raised px-4 py-2.5 shadow-soft"
          >
            <p className="text-sm text-ink">{t.message}</p>
            {t.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
                className="shrink-0 text-sm font-medium text-accent"
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
