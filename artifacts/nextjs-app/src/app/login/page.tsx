'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      setAuth(res.data.access_token, res.data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (e: string, p: string) => { setEmail(e); setPassword(p); };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #5C2909 0%, #A04D18 50%, #E8832A 100%)' }}>
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-center px-16 w-1/2 text-white">
        <div className="mb-8">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
            <span className="text-3xl">🍽</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">Jima Aba Jifar</h1>
          <p className="text-xl text-white/80 mb-6">Restaurant Management System</p>
          <p className="text-white/60 text-base leading-relaxed">
            Complete management solution for Ethiopian cafes and restaurants. Handle orders, kitchen, inventory, staff and finances — all in one place.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-8">
          {[
            { icon: '📋', label: 'Order Management' },
            { icon: '👨‍🍳', label: 'Kitchen Display' },
            { icon: '📦', label: 'Inventory Control' },
            { icon: '💰', label: 'Payment Processing' },
          ].map((f) => (
            <div key={f.label} className="bg-white/10 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">{f.icon}</span>
              <span className="text-sm font-medium">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-brand-500 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🍽</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 mt-1">Sign in to your account</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="admin@habesha.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Quick Login */}
          <div className="mt-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Login (Demo)</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '🔴 Admin', email: 'admin@habesha.com', pass: 'admin123' },
                { label: '🟠 Owner', email: 'owner@habesha.com', pass: 'owner123' },
                { label: '🟡 Manager', email: 'manager@habesha.com', pass: 'manager123' },
                { label: '🔵 Waiter', email: 'waiter1@habesha.com', pass: 'waiter123' },
                { label: '🟣 Chef', email: 'chef@habesha.com', pass: 'chef123' },
                { label: '⚪ Cashier', email: 'cashier@habesha.com', pass: 'cashier123' },
              ].map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => quickLogin(u.email, u.pass)}
                  className="text-xs px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors"
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
