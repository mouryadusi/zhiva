import { Section } from '@/components/design-system/Primitives';
import { SkeletonBlock, SkeletonList } from '@/components/design-system/Skeleton';

export default function Loading() {
  return (
    <main>
      <Section className="pb-4 pt-16 sm:pt-22">
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="mt-3 h-9 w-48" />
      </Section>
      <Section className="py-4">
        <SkeletonList rows={3} />
      </Section>
    </main>
  );
}
