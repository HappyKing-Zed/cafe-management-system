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
    <div className="flex min-h-screen">
      <Sidebar />
      <NotificationBell />
      <main className="flex-1 overflow-auto bg-gray-50 pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
