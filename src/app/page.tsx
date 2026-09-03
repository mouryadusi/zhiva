import { Hero } from '@/components/home/Hero';
import { AccessibilityPanel } from '@/components/accessibility/AccessibilityPanel';
import { ScrollReveal } from '@/components/design-system/ScrollReveal';
import { Section, Eyebrow } from '@/components/design-system/Primitives';

// Public landing page — the editorial scroll narrative described in the
// spec. Sections are separated deliberately (not a dashboard grid);
// each one earns its own scroll beat.
export default function LandingPage() {
  return (
    <main>
      <Hero />

      <ScrollReveal>
        <Section className="py-20 sm:py-28">
          <Eyebrow>Money</Eyebrow>
          <h2 className="mt-3 max-w-xl font-serif text-display-2 text-ink">
            Every rupee, dollar, and euro — accounted for, never guessed.
          </h2>
          <p className="mt-4 max-w-md text-ink-muted">
            Fast entry, real categories, honest comparisons. ZHIVA never invents a number
            it can&apos;t trace back to something you logged.
          </p>
        </Section>
      </ScrollReveal>

      <ScrollReveal>
        <Section className="py-20 sm:py-28">
          <Eyebrow>Today · This week · This month · Life</Eyebrow>
          <h2 className="mt-3 max-w-xl font-serif text-display-2 text-ink">
            Tasks that connect to what you actually care about.
          </h2>
          <p className="mt-4 max-w-md text-ink-muted">
            Goals aren&apos;t a separate list — they&apos;re where your tasks are headed.
          </p>
        </Section>
      </ScrollReveal>

      <ScrollReveal>
        <Section className="py-20 sm:py-28">
          <Eyebrow>Reflection</Eyebrow>
          <h2 className="mt-3 max-w-xl font-serif text-display-2 text-ink">
            A private journal that remembers the context around it.
          </h2>
          <p className="mt-4 max-w-md text-ink-muted">
            Linked to the day&apos;s tasks and spending — not a blank page in isolation.
          </p>
        </Section>
      </ScrollReveal>

      <ScrollReveal>
        <AccessibilityPanel />
      </ScrollReveal>
    </main>
  );
}
