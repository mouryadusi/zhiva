import { BottomNav } from '@/components/nav/BottomNav';
import { ProfileLink } from '@/components/nav/ProfileLink';
import { AppLockGate } from '@/components/security/AppLockGate';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLockGate>
      <div className="pb-20">
        <ProfileLink />
        {children}
        <BottomNav />
      </div>
    </AppLockGate>
  );
}
