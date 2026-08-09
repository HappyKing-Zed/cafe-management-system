'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredToken } from '@/lib/auth';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
