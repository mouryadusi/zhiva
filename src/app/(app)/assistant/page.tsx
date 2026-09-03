import { Section, Eyebrow } from '@/components/design-system/Primitives';
import { AskZhiva } from '@/components/money/AskZhiva';

export default function AssistantPage() {
  return (
    <main>
      <Section className="pb-4 pt-16 sm:pt-22">
        <Eyebrow>Assistant</Eyebrow>
        <h1 className="mt-2 font-serif text-display-2 text-ink">Ask ZHIVA</h1>
        <p className="mt-3 max-w-md text-ink-muted">
          Every answer is computed from your real transactions first, then explained in plain
          language — never the other way around. Numbers that aren&apos;t a plain fact are
          labeled Estimate, Projection, or Hypothetical.
        </p>
      </Section>
      <Section className="py-4 pb-24">
        <AskZhiva fullPage />
      </Section>
    </main>
  );
}
