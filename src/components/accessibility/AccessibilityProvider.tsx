'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { classesForOptionIds } from '@/lib/accessibility-presets';
import { createClient } from '@/lib/supabase/client';

interface A11yContextValue {
  activeOptionIds: string[];
  toggleOption: (id: string) => void;
  setOptions: (ids: string[]) => void;
  isSaving: boolean;
}

const A11yContext = createContext<A11yContextValue | null>(null);

const STORAGE_KEY = 'zhiva:a11y-options';

export function AccessibilityProvider({
  initialOptionIds = [],
  children,
}: {
  initialOptionIds?: string[];
  children: ReactNode;
}) {
  const [activeOptionIds, setActiveOptionIds] = useState<string[]>(initialOptionIds);
  const [isSaving, setIsSaving] = useState(false);

  // Fall back to local storage for signed-out visitors, so the marketing
  // hero and login screen still respect a previously chosen preset.
  useEffect(() => {
    if (initialOptionIds.length > 0) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setActiveOptionIds(JSON.parse(stored));
      } catch {
        // ignore malformed local storage
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const classes = classesForOptionIds(activeOptionIds);
    const html = document.documentElement;
    html.className = html.className
      .split(' ')
      .filter((c) => !c.startsWith('a11y-'))
      .concat(classes)
      .join(' ')
      .trim();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(activeOptionIds));
  }, [activeOptionIds]);

  const persist = async (ids: string[]) => {
    setIsSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return; // signed-out users only get local persistence
      await supabase
        .from('accessibility_preferences')
        .upsert({ user_id: user.id, active_presets: ids, updated_at: new Date().toISOString() });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleOption = (id: string) => {
    setActiveOptionIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      persist(next);
      return next;
    });
  };

  const setOptions = (ids: string[]) => {
    setActiveOptionIds(ids);
    persist(ids);
  };

  const value = useMemo(
    () => ({ activeOptionIds, toggleOption, setOptions, isSaving }),
    [activeOptionIds, isSaving]
  );

  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useAccessibility() {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return ctx;
}
