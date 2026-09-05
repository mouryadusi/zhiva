'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

// Progressive reveal on scroll, used sparingly on the marketing page.
// Reads --motion-scale (set to 0 by the reduced-motion accessibility
// preset or the OS-level prefers-reduced-motion) and simply skips the
// animation entirely rather than just shortening it.
export function ScrollReveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 'calc(0 * var(--motion-scale) + (1 - var(--motion-scale)))',
        transform: visible
          ? 'none'
          : 'translateY(calc(24px * var(--motion-scale)))',
        transition:
          'opacity calc(600ms * var(--motion-scale) + 1ms) cubic-bezier(0.22,1,0.36,1), transform calc(600ms * var(--motion-scale) + 1ms) cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {children}
    </div>
  );
}
