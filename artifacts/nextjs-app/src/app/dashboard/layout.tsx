'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import Sidebar from '@/components/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, router]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
