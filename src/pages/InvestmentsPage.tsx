import React, { useState, useRef } from 'react';
import { TrendingUp, ShieldCheck, Plus, Sparkles, Check, Calculator, Headphones, LifeBuoy, MessageCircle, Mail, ChevronRight, Info, Layers } from 'lucide-react';
import { InvestmentPlan, UserBalances, VaultPackage } from '../types';

interface InvestmentsPageProps {
  plans: InvestmentPlan[];
  balances: UserBalances;
  catalog?: VaultPackage[];
  onSelectPlan: (plan: InvestmentPlan) => void;
  onStakeNewPlan: (plan: InvestmentPlan) => boolean;
}

const CATEGORY_META: Record<string, { label: string; accent: string; grad: string; glow: string }> = {
  '2-Week (14D)': { label: '⚡ 2-Week (14D) Package', accent: 'bg-purple-50 text-[#6D28D9] border-purple-100', grad: 'from-purple-500 via-fuchsia-500 to-pink-500', glow: 'shadow-fuchsia-200/40' },
  'Flexible': { label: 'Flexible Vault', accent: 'bg-emerald-50 text-[#16A34A] border-emerald-100', grad: 'from-emerald-500 to-teal-500', glow: 'shadow-emerald-200/40' },
  'Fixed Term': { label: 'Fixed Term', accent: 'bg-blue-50 text-blue-600 border-blue-100', grad: 'from-blue-500 to-cyan-500', glow: 'shadow-sky-200/40' },
  'VIP Tier': { label: 'VIP Tier', accent: 'bg-amber-50 text-amber-700 border-amber-100', grad: 'from-amber-500 to-orange-500', glow: 'shadow-amber-200/40' },
  'Liquidity': { label: 'Liquidity Pools', accent: 'bg-rose-50 text-rose-600 border-rose-100', grad: 'from-rose-500 to-red-500', glow: 'shadow-rose-200/40' },
  'Institutional': { label: 'Institutional', accent: 'bg-slate-100 text-slate-700 border-slate-200', grad: 'from-slate-600 to-slate-800', glow: 'shadow-slate-200/40' },
  'Growth': { label: 'Growth Plans', accent: 'bg-purple-50 text-[#6D28D9] border-purple-100', grad: 'from-violet-500 to-purple-500', glow: 'shadow-purple-200/40' },
  'Staking': { label: 'Staking', accent: 'bg-indigo-50 text-indigo-600 border-indigo-100', grad: 'from-indigo-500 to-blue-500', glow: 'shadow-indigo-200/40' },
  'Calculated': { label: 'Custom Vault', accent: 'bg-teal-50 text-teal-600 border-teal-100', grad: 'from-teal-500 to-emerald-500', glow: 'shadow-teal-200/40' },
};

const defaultMeta = { label: 'Investment Plan', accent: 'bg-purple-50 text-[#6D28D9] border-purple-100', grad: 'from-purple-500 to-fuchsia-500', glow: 'shadow-purple-200/40' };

// ---- Currency configuration (base = USD) ----
const FX_RATES: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79, NGN: 1500 };
const FX_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', NGN: '₦' };

const catalogPlans = [
  {
    id: 'cat-flex',
    name: 'Micro Starter',
    category: 'Flexible',
    apy: 12.0,
    duration: 'Flexible',
    days: 0,
    priceUsd: 3,
    badge: 'Instant Redeem',
    risk: 'Low Risk',
    description: 'A tiny low-pressure entry point. Withdraw any time, yield compounds daily.',
  },
  {
    id: 'cat-2wk-sprint',
    name: '2-Week Sprint',
    category: '2-Week (14D)',
    apy: 20.0,
    duration: '2-Week Lock',
    days: 14,
    priceUsd: 10,
    badge: '⚡ 2-Week',
    risk: 'Audited',
    description: 'A fast 14-day lock with a friendly APY boost on your starter amount.',
  },
  {
    id: 'cat-2wk-surge',
    name: '2-Week Surge',
    category: '2-Week (14D)',
    apy: 24.0,
    duration: '2-Week Lock',
    days: 14,
    priceUsd: 15,
    badge: 'High Yield',
    risk: 'Protected',
    description: 'Proof-of-stake delegation with 14-day compounding and payout at maturity.',
  },
  {
    id: 'cat-30d',
    name: '30-Day Growth',
    category: 'Fixed Term',
    apy: 28.0,
    duration: '30-Day Lock',
    days: 30,
    priceUsd: 23,
    badge: 'Popular',
    risk: 'Audited Strategy',
    description: 'A balanced one-month vault routing liquidity for steady amplified yield.',
  },
  {
    id: 'cat-45d',
    name: '45-Day Momentum',
    category: 'Fixed Term',
    apy: 34.0,
    duration: '45-Day Lock',
    days: 45,
    priceUsd: 35,
    badge: 'Trending',
    risk: 'Hedged',
    description: 'A mid-term play blending validator yield with defensive hedging.',
  },
  {
    id: 'cat-90d',
    name: 'VIP Boost',
    category: 'VIP Tier',
    apy: 42.0,
    duration: '90-Day Lock',
    days: 90,
    priceUsd: 40,
    badge: 'High APY',
    risk: 'Protected',
    description: 'The top tier — institutional revenue share with maximum compounding power.',
  },
];

export const InvestmentsPage: React.FC<InvestmentsPageProps> = ({
  plans,
  balances,
  catalog,
  onSelectPlan,
  onStakeNewPlan,
}) => {
  const [calcAmount, setCalcAmount] = useState<number>(1000);
  const [calcDuration, setCalcDuration] = useState<number>(14);
  const [calcApy, setCalcApy] = useState<number>(26.5);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [claimedNotice, setClaimedNotice] = useState<string | null>(null);
  const [stakedNotice, setStakedNotice] = useState<string | null>(null);
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false);
  const [currency, setCurrency] = useState<string>('NGN');
  const stakedTimer = useRef<number | null>(null);

  const xenaUsdPrice = balances.currentPrice || 2.85;
  const fxRate = FX_RATES[currency] ?? 1;
  const fxSymbol = FX_SYMBOLS[currency] ?? '$';
  const formatFiat = (usd: number, dp = 2) => `${fxSymbol}${(usd * fxRate).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
  const formatXena = (usd: number) => `${(usd / xenaUsdPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })} XENA`;

  const notifyStake = (planName: string) => {
    setStakedNotice(`${planName} activated — its progress now shows in your Staking Performance card above.`);
    if (stakedTimer.current) window.clearTimeout(stakedTimer.current);
    stakedTimer.current = window.setTimeout(() => setStakedNotice(null), 5000);
  };

  const totalInvested = plans.reduce((acc, p) => acc + p.investedAmount, 0);
  const totalEarned = plans.reduce((acc, p) => acc + p.earnedAmount, 0);
  const avgApy = (plans.reduce((acc, p) => acc + p.projectedReturnPercent, 0) / (plans.length || 1)).toFixed(1);
  const dailyPayoutXena = totalInvested * (parseFloat(avgApy) / 100) / 365;

  // DB-backed catalog (min_deposit is the XENA cost; priceUsd re-derives from it).
  const activeCatalog = Array.isArray(catalog) && catalog.length > 0
    ? catalog
        .filter((v) => v.active !== false)
        .map((v) => ({
          id: v.id,
          name: v.name,
          category: v.category,
          apy: v.apy,
          duration: v.duration,
          days: v.days,
          priceUsd: v.minDeposit * xenaUsdPrice,
          badge: v.badge,
          risk: v.risk,
          description: v.description,
        }))
    : catalogPlans;

  const filteredCatalog = activeCategory === 'all'
    ? activeCatalog
    : activeCatalog.filter((p) => p.category.toLowerCase().includes(activeCategory.toLowerCase()));

  const calculatedReturn = (calcAmount * (calcApy / 100) * (calcDuration / 365));
  const dailyReturn = calculatedReturn / calcDuration;

  const handleClaimAll = () => {
    setClaimedNotice(`Successfully claimed ${totalEarned.toFixed(2)} XENA rewards to your Spot Wallet!`);
    setTimeout(() => setClaimedNotice(null), 4000);
  };

  return (
    <div className="space-y-3 animate-fade-in" id="investments-page-view">
      {/* ===== 1. HEADER ===== */}
      <div className="bg-gradient-to-br from-[#4C1D95] via-[#7C3AED] to-[#DB2777] rounded-[20px] px-4 sm:px-6 py-4 text-white shadow-lg shadow-purple-200/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 bg-[#F59E0B]/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-1/3 w-40 h-40 bg-[#22D3EE]/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-52 h-52 bg-[#F0ABFC]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-1/4 w-40 h-40 bg-[#4ADE80]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center shrink-0 shadow-inner">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">Invest & Earn</h1>
                <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-400 to-orange-500 text-[9px] font-extrabold uppercase tracking-wide shadow-sm">Up to 52% APY</span>
              </div>
              <p className="text-[11px] text-purple-100">Lock XENA into validator vaults & liquidity pools with daily compounding.</p>
            </div>
          </div>
          <button
            onClick={() => setShowSupportModal(true)}
            className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-white font-bold text-[10px] flex items-center gap-1.5 transition-colors cursor-pointer backdrop-blur self-start lg:self-auto"
          >
            <Headphones className="w-3.5 h-3.5" /> <span className="hidden sm:inline">CS Support</span>
          </button>
        </div>

        {stakedNotice && (
          <div className="relative z-10 mt-3 p-2.5 rounded-lg bg-white/15 border border-white/25 text-white text-[11px] font-bold flex items-center gap-2 animate-fade-in">
            <Check className="w-3.5 h-3.5 text-green-300 shrink-0" />
            <span>{stakedNotice}</span>
          </div>
        )}

        {claimedNotice && (
          <div className="relative z-10 mt-3 p-2.5 rounded-lg bg-white/15 border border-white/25 text-white text-[11px] font-bold flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-300" />
              <span>{claimedNotice}</span>
            </div>
          </div>
        )}
      </div>

      {/* ===== 2. STAKING PERFORMANCE ===== */}
      <div className="bg-gradient-to-br from-white via-purple-50/50 to-indigo-50/40 border border-[#EDE9FE] rounded-[20px] p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center text-white shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#171717]">My Staking Performance</h2>
              <p className="text-[10px] text-[#6B7280]">Live progress of every active vault</p>
            </div>
          </div>
          {plans.length > 0 && (
            <button onClick={handleClaimAll} className="px-2.5 h-8 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white text-[10px] font-bold flex items-center gap-1 hover:opacity-95 transition-all cursor-pointer shadow-xs shrink-0">
              <Sparkles className="w-3 h-3" /> Claim All +{totalEarned.toFixed(2)}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 bg-violet-50/60 rounded-xl border border-violet-100">
            <span className="text-[9px] text-violet-600 uppercase font-bold block">Staked</span>
            <span className="text-sm font-extrabold text-violet-900 font-mono block mt-0.5">{totalInvested.toLocaleString()} XENA</span>
            <span className="text-[9px] text-violet-500 block mt-0.5">≈ {formatFiat(totalInvested * xenaUsdPrice, 0)}</span>
          </div>
          <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <span className="text-[9px] text-emerald-600 uppercase font-bold block">Earned</span>
            <span className="text-sm font-extrabold text-emerald-600 font-mono block mt-0.5">+{totalEarned.toFixed(2)}</span>
            <span className="text-[9px] text-emerald-500 block mt-0.5">+{formatFiat(totalEarned * xenaUsdPrice)}</span>
          </div>
          <div className="p-2.5 bg-sky-50/60 rounded-xl border border-sky-100">
            <span className="text-[9px] text-sky-600 uppercase font-bold block">Avg APY</span>
            <span className="text-sm font-extrabold text-sky-800 font-mono block mt-0.5">{avgApy}%</span>
            <span className="text-[9px] text-sky-500 block mt-0.5">compounded daily</span>
          </div>
          <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-100">
            <span className="text-[9px] text-amber-600 uppercase font-bold block">Daily Payout</span>
            <span className="text-sm font-extrabold text-amber-700 font-mono block mt-0.5">+{dailyPayoutXena.toFixed(2)} XENA</span>
            <span className="text-[9px] text-amber-600 block mt-0.5">≈ +${(dailyPayoutXena * balances.usdRate).toFixed(2)}/day</span>
          </div>
        </div>

        {plans.length > 0 ? (
          <div className="space-y-2">
            {plans.map((plan) => {
              const pct = plan.totalDays && plan.totalDays > 0
                ? Math.min(100, Math.round(((plan.totalDays - plan.daysRemaining) / plan.totalDays) * 100))
                : plan.progressPercent || 0;
              return (
                <button
                  key={plan.id}
                  onClick={() => onSelectPlan(plan)}
                  className="w-full flex items-center gap-3 bg-[#F8F7FC] hover:bg-purple-50 border border-[#EDE9FE] rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center text-white shrink-0">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-[#171717]">
                      <span className="truncate">{plan.name}</span>
                      <span className="text-[#16A34A] font-mono shrink-0">+{plan.earnedAmount.toFixed(2)} XENA</span>
                    </div>
                    <div className="h-2 bg-[#EDE9FE] rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A855F7] transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-[#6B7280] mt-1">
                      <span>{plan.totalDays && plan.totalDays > 0 ? `Day ${plan.totalDays - plan.daysRemaining} / ${plan.totalDays}` : 'Flexible Term'}</span>
                      <span className="font-bold text-[#6D28D9]">{pct}%</span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-5 rounded-xl bg-[#F8F7FC] border border-dashed border-[#EDE9FE]">
            <p className="text-xs font-bold text-[#171717]">No active vaults yet</p>
            <p className="text-[10px] text-[#6B7280] mt-0.5">Stake a package below — its progress will appear here instantly.</p>
          </div>
        )}
      </div>

      {/* ===== 3. CATALOG ===== */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold bg-gradient-to-r from-[#6D28D9] via-[#7C3AED] to-[#C026D3] bg-clip-text text-transparent">Explore Vault Packages</h2>
            <p className="text-[10px] text-[#6B7280]">Buy a package — it appears instantly at the top of this page with live progress</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center bg-[#F8F7FC] p-0.5 rounded-lg border border-[#EDE9FE] text-[10px] font-bold">
              {['NGN', 'USD', 'EUR', 'GBP'].map((cur) => (
                <button key={cur} onClick={() => setCurrency(cur)}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${currency === cur ? 'bg-[#6D28D9] text-white shadow-sm' : 'text-[#6B7280] hover:text-[#171717]'}`}>
                  {cur}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap bg-white p-0.5 rounded-lg border border-[#EDE9FE] gap-0.5">
              {[
                { id: 'all', label: 'All' },
                { id: '2-week', label: '⚡ 2-Week' },
                { id: 'flexible', label: 'Flexible' },
                { id: 'fixed', label: 'Fixed' },
                { id: 'vip', label: 'VIP' },
              ].map((cat) => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${activeCategory === cat.id ? 'bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white shadow-sm shadow-fuchsia-200/60' : 'text-[#6B7280] hover:text-[#171717]'}`}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCatalog.map((plan) => {
            const meta = CATEGORY_META[plan.category] || defaultMeta;
            // Prevent buying a package that is already active (dedupe by name)
            const alreadyActive = plans.some((p) => p.name === plan.name);
            const xenaQty = plan.priceUsd / xenaUsdPrice;
            return (
              <div key={plan.id} className="group relative bg-white border border-[#EDE9FE] rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col p-4">
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${meta.grad}`} />
                <div className="flex items-start justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${meta.accent}`}>{plan.category}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r ${meta.grad} text-white shadow-sm ${meta.glow}`}>+{plan.apy}% APY</span>
                </div>

                <h3 className="text-sm font-extrabold text-[#171717] mt-2.5">{plan.name}</h3>
                <p className="text-[10px] text-[#6B7280] leading-relaxed mt-1">{plan.description}</p>

                <div className="mt-3 mb-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[22px] font-black text-[#171717] font-mono leading-none">{formatFiat(plan.priceUsd)}</span>
                    <span className="text-[9px] text-[#6B7280]">/ package</span>
                  </div>
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-[#F8F7FC] border border-[#EDE9FE] text-[10px] font-bold text-[#6D28D9]">
                    ≈ {formatXena(plan.priceUsd)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3 text-center">
                  <div className="bg-[#F8F7FC] rounded-lg border border-[#EDE9FE] py-1.5">
                    <span className="text-[8px] text-[#6B7280] block font-medium leading-none">Lock</span>
                    <span className="font-bold text-[#171717] text-[10px] block mt-0.5">{plan.duration}</span>
                  </div>
                  <div className="bg-[#F8F7FC] rounded-lg border border-[#EDE9FE] py-1.5">
                    <span className="text-[8px] text-[#6B7280] block font-medium leading-none">Risk</span>
                    <span className="font-bold text-[#171717] text-[10px] block mt-0.5">{plan.risk}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const ok = onStakeNewPlan({
                      id: plan.id,
                      name: plan.name,
                      category: plan.category,
                      investedAmount: xenaQty,
                      earnedAmount: 0,
                      projectedReturnPercent: plan.apy,
                      daysRemaining: plan.days,
                      totalDays: plan.days,
                      progressPercent: 0,
                    });
                    if (ok) notifyStake(plan.name);
                  }}
                  disabled={alreadyActive}
                  className={`w-full py-2.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 mt-auto ${alreadyActive ? 'bg-[#F8F7FC] text-[#6B7280] border border-[#EDE9FE] cursor-not-allowed' : `bg-gradient-to-r ${meta.grad} text-white shadow-sm ${meta.glow} hover:opacity-95`}`}
                >
                  {alreadyActive ? (
                    <><Check className="w-3.5 h-3.5" /> Already Active</>
                  ) : (
                    <><Plus className="w-3.5 h-3.5" /> Stake {formatXena(plan.priceUsd)}</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== 4. CALCULATOR ===== */}
      <div className="bg-white border border-[#EDE9FE] rounded-[20px] p-4 shadow-xs">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#EDE9FE]">
          <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#7C3AED] flex items-center justify-center">
            <Calculator className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#171717]">Yield Calculator</h3>
            <p className="text-[10px] text-[#6B7280]">Project your passive rewards before staking</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div>
              <div className="flex justify-between text-[10px] text-[#6B7280] mb-1 font-semibold">
                <span>Deposit Amount</span>
                <span>{calcAmount.toLocaleString()} XENA ≈ {formatFiat(calcAmount * xenaUsdPrice)}</span>
              </div>
              <input type="range" min="50" max="50000" step="50" value={calcAmount} onChange={(e) => setCalcAmount(parseFloat(e.target.value))} className="w-full accent-[#7C3AED] cursor-pointer" />
            </div>

            <div>
              <span className="text-[10px] text-[#6B7280] block mb-1.5 font-semibold">Lockup Horizon</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { days: 14, apy: 26.5, label: '2 Weeks', highlight: 'Popular' },
                  { days: 30, apy: 24.2, label: '30 Days', highlight: null },
                  { days: 90, apy: 32.0, label: '90 Days', highlight: null },
                  { days: 180, apy: 52.0, label: '180 Days', highlight: null },
                ].map((item) => (
                  <button key={item.days} type="button"
                    onClick={() => { setCalcDuration(item.days); setCalcApy(item.apy); }}
                    className={`py-1.5 px-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer relative ${calcDuration === item.days ? 'bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white border-transparent shadow-sm shadow-fuchsia-200/60' : 'bg-[#F8F7FC] text-[#6B7280] border-[#EDE9FE] hover:text-[#171717] hover:bg-white'}`}>
                    {item.highlight && (
                      <span className="absolute -top-1.5 right-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[8px] font-extrabold px-1 py-0.5 rounded-full">{item.highlight}</span>
                    )}
                    <div>{item.label}</div>
                    <div className={`text-[9px] ${calcDuration === item.days ? 'text-emerald-200' : 'text-[#16A34A]'}`}>+{item.apy}%</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 p-3.5 bg-gradient-to-br from-[#4C1D95] via-[#7C3AED] to-[#DB2777] rounded-xl border border-purple-200 text-white shadow-lg shadow-purple-200/50 space-y-2">
            <div className="text-[9px] text-purple-200 font-bold uppercase tracking-wider">Projected Earnings</div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-purple-100">Daily Rewards</span>
                <span className="font-bold text-emerald-300 font-mono">+{dailyReturn.toFixed(3)} XENA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-100">Period Earnings</span>
                <span className="font-bold text-amber-300 font-mono">+{calculatedReturn.toFixed(2)} XENA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-100">Fiat at Maturity</span>
                <span className="font-bold text-white font-mono">{formatFiat((calcAmount + calculatedReturn) * xenaUsdPrice)}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-white/20 flex items-center justify-between">
              <div>
                <span className="text-[9px] text-purple-200 block">Total Payout</span>
                <span className="text-sm font-extrabold text-white font-mono">{(calcAmount + calculatedReturn).toFixed(2)} XENA</span>
              </div>
              <button
                onClick={() => {
                  const ok = onStakeNewPlan({
                    id: 'calc-custom',
                    name: `${calcDuration}-Day Custom Vault`,
                    category: 'Calculated',
                    investedAmount: calcAmount,
                    earnedAmount: 0,
                    projectedReturnPercent: calcApy,
                    daysRemaining: calcDuration,
                    totalDays: calcDuration,
                    progressPercent: 0,
                  });
                  if (ok) notifyStake(`${calcDuration}-Day Custom Vault`);
                }}
                className="px-3.5 py-2 rounded-lg bg-white text-[#6D28D9] font-bold text-[11px] hover:bg-purple-50 shadow-sm cursor-pointer">
                Stake {calcAmount.toLocaleString()}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 5. CS SUPPORT MODAL ===== */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-[20px] shadow-2xl border border-[#EDE9FE] overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EDE9FE] bg-[#F8F7FC]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white flex items-center justify-center">
                  <LifeBuoy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#171717] text-sm">Customer Support</h3>
                  <p className="text-[10px] text-[#6B7280]">24/7 live human assistance for staking</p>
                </div>
              </div>
              <button onClick={() => setShowSupportModal(false)} className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#171717] hover:bg-white transition-colors cursor-pointer">
                <MessageCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-2.5 overflow-y-auto">
              {[
                { icon: MessageCircle, title: 'Live Chat', desc: 'Avg. response 30 seconds', accent: 'bg-purple-50 text-[#7C3AED]' },
                { icon: Mail, title: 'Support Email', desc: 'staking@xena.exchange', accent: 'bg-blue-50 text-blue-600' },
                { icon: ShieldCheck, title: 'Principal Protection Claim', desc: 'File a guarantee claim on any vault', accent: 'bg-emerald-50 text-emerald-600' },
                { icon: Headphones, title: 'Yield Advisors', desc: 'Speak to a vault strategist', accent: 'bg-amber-50 text-amber-600' },
              ].map(({ icon: Icon, title, desc, accent }) => (
                <button key={title} className="w-full flex items-center gap-3 p-3 bg-[#F8F7FC] hover:bg-white border border-[#EDE9FE] hover:border-purple-200 rounded-xl transition-all text-left cursor-pointer group">
                  <span className={`w-9 h-9 rounded-lg ${accent} flex items-center justify-center shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-[#171717]">{title}</span>
                    <span className="block text-[10px] text-[#6B7280] truncate">{desc}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#6B7280] group-hover:text-[#6D28D9] group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}

              <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl text-[11px] text-[#6B7280] flex items-start gap-2">
                <Info className="w-4 h-4 text-[#7C3AED] shrink-0 mt-0.5" />
                <p>All staking vaults are principal-protected by the XENA Treasury. Rewards are auto-compounded daily.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};