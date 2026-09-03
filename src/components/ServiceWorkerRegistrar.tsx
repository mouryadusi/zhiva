'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failures (e.g. unsupported browser) shouldn't
        // block the app — ZHIVA works fine without offline caching.
      });
    }
  }, []);
  return null;
}
