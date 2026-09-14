import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Zap, Sparkles, Check, Loader2, User, Gift, Globe, Calendar, ChevronDown, Sparkle, Coins, Rocket } from 'lucide-react';

interface SignupPageProps {
  onNavigateTab: (tab: string) => void;
  onSignupSuccess?: () => void;
  onRegister?: (data: { name: string; email: string; password: string; country: string; phone: string; dob: string; referrer: string }) => Promise<{ ok: boolean; error?: string }>;
}

const COUNTRIES = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Egypt', 'Morocco', 'Ethiopia', 'Tanzania', 'Uganda', 'Senegal', 'Cameroon', 'Ivory Coast', 'Rwanda', 'Zambia', 'Zimbabwe', 'Botswana',
  'United States', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Venezuela', 'Ecuador', 'Costa Rica', 'Panama', 'Dominican Republic',
  'United Kingdom', 'France', 'Germany', 'Spain', 'Italy', 'Portugal', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Ireland', 'Poland', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Greece', 'Czech Republic', 'Romania', 'Ukraine',
  'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Turkey', 'Israel', 'Jordan', 'Lebanon', 'Oman', 'Bahrain',
  'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Indonesia', 'Malaysia', 'Singapore', 'Thailand', 'Vietnam', 'Philippines', 'China', 'Japan', 'South Korea', 'Hong Kong', 'Taiwan', 'Australia', 'New Zealand', 'Kazakhstan', 'Uzbekistan',
];

const PHONE_PREFIXES: Record<string, string> = {
  'Nigeria': '+234', 'Ghana': '+233', 'Kenya': '+254', 'South Africa': '+27', 'Egypt': '+20', 'Morocco': '+212', 'Ethiopia': '+251', 'Tanzania': '+255', 'Uganda': '+256', 'Senegal': '+221', 'Cameroon': '+237', 'Ivory Coast': '+225', 'Rwanda': '+250', 'Zambia': '+260', 'Zimbabwe': '+263', 'Botswana': '+267',
  'United States': '+1', 'Canada': '+1', 'Mexico': '+52', 'Brazil': '+55', 'Argentina': '+54', 'Colombia': '+57', 'Chile': '+56', 'Peru': '+51', 'Venezuela': '+58', 'Ecuador': '+593', 'Costa Rica': '+506', 'Panama': '+507', 'Dominican Republic': '+1',
  'United Kingdom': '+44', 'France': '+33', 'Germany': '+49', 'Spain': '+34', 'Italy': '+39', 'Portugal': '+351', 'Netherlands': '+31', 'Belgium': '+32', 'Switzerland': '+41', 'Austria': '+43', 'Ireland': '+353', 'Poland': '+48', 'Sweden': '+46', 'Norway': '+47', 'Denmark': '+45', 'Finland': '+358', 'Greece': '+30', 'Czech Republic': '+420', 'Romania': '+40', 'Ukraine': '+380',
  'Saudi Arabia': '+966', 'United Arab Emirates': '+971', 'Qatar': '+974', 'Kuwait': '+965', 'Turkey': '+90', 'Israel': '+972', 'Jordan': '+962', 'Lebanon': '+961', 'Oman': '+968', 'Bahrain': '+973',
  'India': '+91', 'Pakistan': '+92', 'Bangladesh': '+880', 'Sri Lanka': '+94', 'Nepal': '+977', 'Indonesia': '+62', 'Malaysia': '+60', 'Singapore': '+65', 'Thailand': '+66', 'Vietnam': '+84', 'Philippines': '+63', 'China': '+86', 'Japan': '+81', 'South Korea': '+82', 'Hong Kong': '+852', 'Taiwan': '+886', 'Australia': '+61', 'New Zealand': '+64', 'Kazakhstan': '+7', 'Uzbekistan': '+998',
};

export const SignupPage: React.FC<SignupPageProps> = ({ onNavigateTab, onSignupSuccess, onRegister }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [referral, setReferral] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [showExplainer, setShowExplainer] = useState(false);

  const inputCls =
    'w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white transition-all placeholder:text-[#9CA3AF]';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please complete all required fields to create your account.');
      return;
    }
    if (!country) {
      setError('Please select your country of residence.');
      return;
    }
    if (phone.trim().length < 6) {
      setError('Please enter a valid phone number.');
      return;
    }
    if (!dob) {
      setError('Please enter your date of birth.');
      return;
    }
    const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (isNaN(age) || age < 18) {
      setError('You must be at least 18 years old to create an account.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match. Please try again.');
      return;
    }
    if (!accepted) {
      setError('You must accept the Terms of Service and Privacy Policy.');
      return;
    }
    setLoading(true);
    if (onRegister) {
      const result = await onRegister({ name, email, password, country, phone, dob, referrer: referral.trim() });
      setLoading(false);
      if (!result.ok) {
        setError(result.error || 'Unable to create your account. Please try again.');
        return;
      }
      setDone(true);
      return;
    }
    setTimeout(() => {
      setLoading(false);
      setDone(true);
    }, 900);
  };

  const StrengthBar = ({ value }: { value: string }) => {
    const score = [value.length >= 8, /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
    const colors = ['bg-[#D1D5DB]', 'bg-[#F59E0B]', 'bg-[#0EA5E9]', 'bg-[#16A34A]', 'bg-[#6D28D9]'];
    return (
      <div className="flex items-center gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score] : 'bg-[#EDE9FE]'}`} />
        ))}
        <span className="ml-1.5 text-[10px] font-bold text-[#6B7280]">
          {score === 0 ? 'Too weak' : score <= 2 ? 'Weak' : score === 3 ? 'Good' : 'Strong'}
        </span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-10rem)] rounded-[24px] overflow-hidden border border-[#EDE9FE] shadow-lg animate-fade-in" id="signup-page-view">
      {/* LEFT: Brand Panel */}
      <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-[#1E1B4B] via-[#7C3AED] to-[#DB2777] p-10 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center">
            <span className="text-white font-bold text-lg leading-none">X</span>
          </div>
          <span className="font-bold text-xl tracking-tight">XENA Exchange</span>
        </div>

        <div className="relative z-10 space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight leading-tight">
            Create your account.<br />Start earning <span className="text-purple-200">up to 52% APY.</span>
          </h1>
          <p className="text-sm text-purple-100 leading-relaxed">
            Join 2.4M+ verified users trading and staking securely. Full setup takes under 2 minutes.
          </p>

          <div className="space-y-2 pt-2">
            {[
              { icon: ShieldCheck, text: 'Bank-grade KYC & 2FA in under 2 minutes' },
              { icon: Zap, text: 'Instant, 0% fee P2P trading powered by escrow' },
              { icon: Gift, text: '₦1,500 NGN or $10 USDT deposit bonus — make a deposit to claim it' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 text-xs text-purple-50">
                <span className="w-6 h-6 rounded-lg bg-white/10 border border-white/25 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5" />
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-purple-100">
          ≤ 2.1 min avg release · 99/100 CertiK audit · Trusted in 188 countries
        </div>
      </div>

      {/* RIGHT: Form */}
      <div className="bg-white p-6 sm:p-10 flex flex-col justify-center overflow-y-auto">
        <div className="lg:hidden w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#DB2777] flex items-center justify-center mb-4">
          <span className="text-white font-bold text-lg leading-none">X</span>
        </div>

        <div className="max-w-sm w-full mx-auto space-y-4">
          {done ? (
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-8 animate-scale-up">
              <div className="w-16 h-16 rounded-full bg-green-100 border-2 border-green-300 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" strokeWidth={3} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#171717]">Welcome, {name.split(' ')[0] || 'onboard'}! 🎉</h2>
                <p className="text-xs text-[#6B7280] mt-1">Your XENA account has been created successfully.</p>
              </div>
              <button
                onClick={() => setShowExplainer(true)}
                className="w-full py-2.5 rounded-xl bg-purple-50 border border-purple-200 text-[#6D28D9] font-bold text-xs flex items-center justify-center gap-2 hover:bg-purple-100 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> What is the XENA coin?
              </button>
              <button
                onClick={() => (onSignupSuccess ? onSignupSuccess() : onNavigateTab('home'))}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-bold text-xs flex items-center justify-center gap-2 hover:opacity-95 transition-all cursor-pointer shadow-sm"
              >
                Enter Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#171717] tracking-tight">Create your account</h2>
                <p className="text-xs text-[#6B7280] mt-1">Free forever. No card required to get started.</p>
              </div>

              <div className="grid grid-cols-2 gap-2 py-1.5 px-3 rounded-xl bg-purple-50/80 border border-purple-100">
                <div className="text-center">
                  <p className="text-[13px] font-extrabold text-[#171717]">₦1,500 NGN Bonus</p>
                  <p className="text-[10px] font-semibold text-[#6B7280]">Make a deposit to claim</p>
                </div>
                <div className="text-center border-l border-purple-100">
                  <p className="text-[13px] font-extrabold text-[#171717]">$10 USDT Bonus</p>
                  <p className="text-[10px] font-semibold text-[#6B7280]">Make a deposit to claim</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-[#171717] block mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" className={`${inputCls} pl-9`} />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#171717] block mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={`${inputCls} pl-9`} />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#171717] block mb-1">Country of Residence <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className={`${inputCls} pl-9 appearance-none cursor-pointer ${country ? 'text-[#171717]' : 'text-[#9CA3AF]'}`}
                    >
                      <option value="" disabled>Select your country</option>
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#9CA3AF] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#171717] block mb-1">Phone Number <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6B7280]">
                      {PHONE_PREFIXES[country] || '+000'}
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9 ]/g, ''))}
                      placeholder="800 000 0000"
                      className={`${inputCls} ${country ? 'pl-[4.5rem]' : 'pl-9'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#171717] block mb-1">Date of Birth <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={dob}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setDob(e.target.value)}
                      className={`${inputCls} pl-9 ${dob ? 'text-[#171717]' : 'text-[#9CA3AF]'}`}
                    />
                  </div>
                </div>

                <p className="text-[9px] text-[#9CA3AF] -mt-1">We support users in 80+ countries. KYC verification is required to unlock withdrawals.</p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-[#171717] block mb-1">Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={`${inputCls} pl-9 pr-8`} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6D28D9] cursor-pointer">
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#171717] block mb-1">Confirm</label>
                    <input type={showPassword ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter" className={inputCls} />
                  </div>
                </div>

                {password && <StrengthBar value={password} />}

                <div>
                  <label className="text-[11px] font-bold text-[#171717] block mb-1">Referral Code <span className="text-[9px] font-semibold text-[#9CA3AF]">(optional)</span></label>
                  <div className="relative">
                    <Gift className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={referral} onChange={(e) => setReferral(e.target.value)} placeholder="XENA-REF" className={`${inputCls} pl-9`} />
                  </div>
                </div>

                <label className="flex items-start gap-2 text-[11px] text-[#6B7280] font-semibold cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => setAccepted(!accepted)}
                    className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center transition-all cursor-pointer ${accepted ? 'bg-[#6D28D9] border-[#6D28D9]' : 'bg-white border-[#D1D5DB]'}`}
                  >
                    {accepted && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span>
                    I agree to XENA's <span className="text-[#6D28D9] font-bold">Terms of Service</span> and <span className="text-[#6D28D9] font-bold">Privacy Policy</span>, and confirm I am 18+.
                  </span>
                </label>

                {error && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[11px] font-semibold text-red-600 animate-fade-in">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-bold text-xs shadow-md hover:shadow-[0_4px_16px_rgba(109,40,217,0.3)] transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating secure account...</>
                  ) : (
                    <>Create Account <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <p className="text-center text-[11px] text-[#6B7280]">
                Already have an account?{' '}
                <button onClick={() => onNavigateTab('login')} className="font-bold text-[#6D28D9] hover:underline cursor-pointer">
                  Sign in here
                </button>
              </p>

              <div className="pt-1 flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
                Your data is encrypted & protected by 2FA
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== XENA COIN EXPLAINER POPUP ===== */}
      {showExplainer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-[24px] shadow-2xl border border-[#EDE9FE] overflow-hidden animate-scale-up">
            <div className="h-1.5 bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#DB2777]" />
            <button
              onClick={() => setShowExplainer(false)}
              className="absolute right-3.5 top-3.5 w-8 h-8 rounded-full bg-[#F8F7FC] hover:bg-[#EDE9FE] text-[#6B7280] font-bold flex items-center justify-center cursor-pointer transition-colors"
            >
              ✕
            </button>

            <div className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#A855F7] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(109,40,217,0.35)]">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#171717]">Meet XENA</h3>
                  <p className="text-[10px] text-[#6B7280]">The coin powering the XENA Exchange ecosystem</p>
                </div>
              </div>

              <p className="text-xs text-[#6B7280] leading-relaxed mt-4">
                <strong className="text-[#171717]">XENA</strong> is the native token of the XENA Exchange platform. It's the fuel that powers real-time trading, staking vaults, and every yield you earn.
              </p>

              <div className="space-y-2.5 mt-4">
                {[
                  { icon: Rocket, title: 'Earn up to 52% APY', desc: 'Stake XENA in vaults and let your holdings compound daily.' },
                  { icon: Zap, title: 'Trade with 0% fees', desc: 'Pay for P2P and spot trades using XENA at no maker cost.' },
                  { icon: Sparkle, title: 'Real utility', desc: 'Use XENA for governance votes, fee discounts and rewards.' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F8F7FC] border border-[#EDE9FE]">
                    <span className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="block text-xs font-bold text-[#171717]">{title}</span>
                      <span className="block text-[10px] text-[#6B7280] mt-0.5 leading-snug">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 rounded-xl bg-purple-50/70 border border-purple-100 text-[10px] text-[#6B7280] flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#6D28D9] shrink-0 mt-0.5" />
                <span>Make your first deposit to claim your welcome bonus: <strong className="text-[#6D28D9]">₦1,500 worth of XENA</strong> on a NGN deposit, or a <strong className="text-[#6D28D9]">$10 XENA bonus</strong> on a USDT (crypto) deposit.</span>
              </div>

              <button
                onClick={() => (onSignupSuccess ? onSignupSuccess() : onNavigateTab('home'))}
                className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-bold text-xs flex items-center justify-center gap-2 hover:opacity-95 transition-all cursor-pointer"
              >
                Got it — Enter Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};