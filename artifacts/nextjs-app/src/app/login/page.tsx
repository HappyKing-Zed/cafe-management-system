'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Eye, EyeOff, ConciergeBell, ChefHat, PackageSearch, CreditCard, Wine } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  return (
    <div className="min-h-screen flex relative bg-cream-50">
      {/* Left Panel - Premium Brand Presentation */}
      <div className="hidden lg:flex flex-col justify-between px-16 py-20 w-[55%] relative overflow-hidden bg-teal-900 text-cream-50">
        <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #C7923E 0%, transparent 70%)' }}></div>
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-teal-800 rounded-full blur-[120px] opacity-40 translate-x-1/2 -translate-y-1/4 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gold-600 rounded-full blur-[150px] opacity-20 -translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <div className="w-16 h-16 bg-cream-50/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-10 border border-cream-50/20 shadow-xl">
            <Wine className="w-8 h-8 text-gold-400" strokeWidth={1.5} />
          </div>

          <h1 className="text-6xl font-display font-medium text-cream-50 mb-6 leading-tight tracking-tight">
            CARAVAN <br/>
            <span className="text-gold-400 italic font-light">Lounge</span>
          </h1>
          <p className="text-2xl text-cream-200/90 mb-10 font-light max-w-lg leading-relaxed">
            Attentive hospitality workspace
          </p>
          <p className="text-cream-100/70 text-lg leading-relaxed max-w-md font-light">
            An elevated operations system designed for seamless service, precision kitchen management, and crafted guest experiences.
          </p>

          <div className="grid grid-cols-2 gap-x-8 gap-y-6 mt-16 max-w-lg">
            {[
              { icon: ConciergeBell, label: 'Order Management' },
              { icon: ChefHat, label: 'Kitchen Display' },
              { icon: PackageSearch, label: 'Inventory Control' },
              { icon: CreditCard, label: 'Payment Processing' },
            ].map((f) => (
              <div key={f.label} className="group flex items-center gap-4 p-4 rounded-xl bg-teal-800/30 hover:bg-teal-800/50 border border-teal-700/30 hover:border-gold-500/30 transition-all duration-300">
                <div className="w-10 h-10 rounded-lg bg-teal-900/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <f.icon className="w-5 h-5 text-gold-300" strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-cream-100/90 tracking-wide">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-cream-100/50 text-sm mt-12">
          <span>Powered by</span>
          <span className="font-semibold text-cream-100/70 tracking-wider uppercase text-xs">Abajifar</span>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-cream-50 relative z-10 shadow-[-20px_0_40px_-10px_rgba(0,0,0,0.05)]">
        <div className="w-full max-w-md px-4 sm:px-8">
          <div className="text-left mb-10">
            <h2 className="text-3xl font-display font-medium text-teal-900 mb-2">Welcome back</h2>
            <p className="text-coffee-500 font-light text-lg">Sign in to your workspace</p>
          </div>

          {error && (
            <div role="alert" className="mb-6 p-4 bg-red-50/50 border border-red-100 rounded-xl text-red-800 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-coffee-700 ml-1">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input h-12 text-base"
                placeholder="admin1@gmail.com"
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-coffee-700 ml-1">Password</label>
              <div className="relative group">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input h-12 text-base pr-12"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-coffee-400 hover:text-teal-800 hover:bg-cream-100 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full h-12 text-base disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group relative overflow-hidden"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
