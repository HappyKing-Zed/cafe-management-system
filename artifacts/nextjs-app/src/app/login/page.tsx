'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiErrorMessage, login } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Eye, EyeOff, Coffee, Utensils, GlassWater, Cake, ArrowRight } from 'lucide-react';

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
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Invalid credentials. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Outfit:wght@300;400;500;600&display=swap');
        .font-playfair { font-family: 'Playfair Display', serif; }
        .font-outfit { font-family: 'Outfit', sans-serif; }
      `}} />

      <div className="min-h-screen flex relative bg-[#F9F8F6] font-outfit">
        {/* Left Panel - Premium Brand Presentation */}
        <div className="hidden lg:flex flex-col justify-between w-[55%] xl:w-[60%] relative overflow-hidden bg-stone-950">
          {/* Background Image Anchor */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80 transform scale-105 transition-transform duration-[20s] ease-out hover:scale-100"
            style={{ backgroundImage: 'url(/login-bg.jpg)' }}
          />
          {/* Gradients for text readability and mood */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#1A100C]/80 via-[#1A100C]/45 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A100C]/90 via-[#1A100C]/35 to-transparent" />

          {/* Top Logo / Brand */}
          <div className="relative z-10 px-16 xl:px-24 pt-20">
            <h1 className="text-5xl md:text-6xl font-playfair font-semibold text-[#F9F8F6] leading-tight tracking-tight">
              Jima <br/>
              <span className="text-[#D4AF37] italic font-medium text-4xl md:text-5xl mt-2 block">CARAVAN Lounge</span>
            </h1>
            <p className="mt-6 text-[#E8E6E1] text-lg font-light tracking-wide max-w-md leading-relaxed">
              An elevated dining experience rooted in warm Ethiopian hospitality.
            </p>
          </div>

          {/* Middle / Bottom Content - Offerings */}
          <div className="relative z-10 px-16 xl:px-24 pb-16 mt-auto">
            <div className="h-[1px] w-12 bg-[#D4AF37]/50 mb-8" />

            <div className="grid grid-cols-2 gap-x-12 gap-y-10 text-[#E8E6E1] max-w-2xl">
              <div className="flex items-start gap-4 group">
                <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-full bg-[#3E2723]/60 border border-[#8D6E63]/30 flex items-center justify-center group-hover:bg-[#3E2723] group-hover:border-[#D4AF37]/50 transition-all duration-300">
                  <Utensils className="w-5 h-5 text-[#D4AF37]" strokeWidth={1.5} />
                </div>
                <div>
                  <h4 className="text-[#F9F8F6] text-base font-medium tracking-wide font-playfair">Ethiopian Food</h4>
                  <p className="text-sm font-light leading-relaxed mt-1.5 opacity-80">
                    An authentic dining experience including kitfo, tire siga, tibs, and an exquisite beyaynet selection.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-full bg-[#3E2723]/60 border border-[#8D6E63]/30 flex items-center justify-center group-hover:bg-[#3E2723] group-hover:border-[#D4AF37]/50 transition-all duration-300">
                  <Coffee className="w-5 h-5 text-[#D4AF37]" strokeWidth={1.5} />
                </div>
                <div>
                  <h4 className="text-[#F9F8F6] text-base font-medium tracking-wide font-playfair">Coffee & Tea</h4>
                  <p className="text-sm font-light leading-relaxed mt-1.5 opacity-80">
                    Ceremonial Ethiopian coffee roasting and premium steeped teas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-full bg-[#3E2723]/60 border border-[#8D6E63]/30 flex items-center justify-center group-hover:bg-[#3E2723] group-hover:border-[#D4AF37]/50 transition-all duration-300">
                  <Cake className="w-5 h-5 text-[#D4AF37]" strokeWidth={1.5} />
                </div>
                <div>
                  <h4 className="text-[#F9F8F6] text-base font-medium tracking-wide font-playfair">Cake</h4>
                  <p className="text-sm font-light leading-relaxed mt-1.5 opacity-80">
                    Artisanal cakes and house-baked sweet delicacies for every occasion.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-full bg-[#3E2723]/60 border border-[#8D6E63]/30 flex items-center justify-center group-hover:bg-[#3E2723] group-hover:border-[#D4AF37]/50 transition-all duration-300">
                  <GlassWater className="w-5 h-5 text-[#D4AF37]" strokeWidth={1.5} />
                </div>
                <div>
                  <h4 className="text-[#F9F8F6] text-base font-medium tracking-wide font-playfair">Soft Drinks</h4>
                  <p className="text-sm font-light leading-relaxed mt-1.5 opacity-80">
                    A curated selection of refreshing soft drinks and cold beverages.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[#E8E6E1]/50 text-xs mt-16 tracking-widest uppercase font-medium">
              <span>Powered by</span>
              <span className="text-[#D4AF37]">Idata Technologies</span>
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="flex-1 flex flex-col justify-center items-center p-8 bg-[#F9F8F6] relative z-10">
          {/* Mobile Background - visible only on small screens */}
          <div
            className="absolute inset-0 lg:hidden bg-cover bg-center opacity-[0.03] mix-blend-multiply pointer-events-none"
            style={{ backgroundImage: 'url(/login-bg.jpg)' }}
          />

          <div className="w-full max-w-md px-4 sm:px-8 relative z-10">
            {/* Mobile Header (Hidden on Desktop) */}
            <div className="lg:hidden mb-12 text-center">
              <h1 className="text-4xl font-playfair font-semibold text-[#2A1B14]">
                Jima
              </h1>
              <span className="text-[#8D6E63] italic font-medium text-2xl mt-1 block font-playfair">CARAVAN Lounge</span>
            </div>

            <div className="text-left mb-10">
              <h2 className="text-3xl font-playfair font-semibold text-[#2A1B14] mb-3">Welcome back</h2>
              <p className="text-[#5D4037] font-light text-base">Sign in to the operations workspace</p>
            </div>

            {error && (
              <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-red-800 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-[#4E342E]">Email Address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 px-4 bg-white border border-[#D7CCC8] rounded-lg text-[#3E2723] focus:outline-none focus:border-[#8D6E63] focus:ring-1 focus:ring-[#8D6E63] transition-all placeholder:text-[#BCAAA4]"
                  placeholder="admin@jimalounge.com"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-[#4E342E]">Password</label>
                <div className="relative group">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 px-4 pr-12 bg-white border border-[#D7CCC8] rounded-lg text-[#3E2723] focus:outline-none focus:border-[#8D6E63] focus:ring-1 focus:ring-[#8D6E63] transition-all placeholder:text-[#BCAAA4]"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-[#8D6E63] hover:text-[#3E2723] hover:bg-[#F5F5F5] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-[#2A1B14] hover:bg-[#3E2723] text-white rounded-lg text-base font-medium transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#2A1B14]/20 group"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Sign In
                      <ArrowRight size={18} className="opacity-80 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>

              <div className="pt-8 lg:hidden flex items-center justify-center gap-1.5 text-[10px] font-medium text-[#8D6E63] tracking-widest uppercase">
                <span>Powered by</span>
                <span className="text-[#3E2723]">Idata Technologies</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
