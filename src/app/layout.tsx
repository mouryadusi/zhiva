import type { Metadata, Viewport } from 'next';
import { AccessibilityProvider } from '@/components/accessibility/AccessibilityProvider';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';
import { ToastProvider } from '@/components/design-system/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZHIVA — Know your life. Shape what\'s next.',
  description:
    'A private, mobile-first personal operating system for money, tasks, goals, reminders, journal, and memory.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ZHIVA',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8f4' },
    { media: '(prefers-color-scheme: dark)', color: '#111110' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ServiceWorkerRegistrar />
        <AccessibilityProvider>
          <ToastProvider>{children}</ToastProvider>
        </AccessibilityProvider>
      </body>
    </html>
  );
}
