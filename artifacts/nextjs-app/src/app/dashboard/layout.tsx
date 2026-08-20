'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { canAccessDashboardPath, dashboardHomeForRole } from '@/lib/dashboard-access';
import Sidebar from '@/components/sidebar';
import NotificationBell from '@/components/notification-bell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, loadFromStorage } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadFromStorage();
    setReady(true);
  }, [loadFromStorage]);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (user && !canAccessDashboardPath(pathname, user.role)) {
      router.replace(dashboardHomeForRole(user.role));
    }
  }, [isAuthenticated, pathname, ready, router, user]);

  const canRender = ready && isAuthenticated && user && canAccessDashboardPath(pathname, user.role);
  if (!canRender) {
    return <div className="min-h-screen bg-gray-50" aria-label="Loading dashboard" />;
  }

  return (
    <div className="flex min-h-screen bg-cream-50">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="fixed lg:sticky top-0 right-16 lg:right-auto z-50 h-16 w-16 lg:w-full lg:px-6 flex items-center justify-center lg:justify-end pointer-events-none lg:bg-cream-50/90 lg:backdrop-blur-md lg:border-b lg:border-cream-100">
          <div className="pointer-events-auto">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto pt-16 lg:pt-0 relative">
          <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-cream-100 to-transparent pointer-events-none -z-10" />
          <div className="h-full w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
