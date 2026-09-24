import React from 'react';
import { X, TrendingUp, PiggyBank, ShieldCheck, Clock, ArrowRight, Sparkles, Zap, Layers } from 'lucide-react';

interface InvestWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartInvesting: () => void;
}

export const InvestWelcomeModal: React.FC<InvestWelcomeModalProps> = ({ isOpen, onClose, onStartInvesting }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" id="invest-welcome-modal">
      <div className="relative w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[24px] shadow-2xl border border-[#EDE9FE] overflow-hidden animate-scale-up">
        <div className="h-1.5 bg-gradient-to-r from-[#F59E0B] via-[#F97316] to-[#DB2777]" />
        <button
          onClick={onClose}
          className="absolute right-3.5 top-5 w-8 h-8 rounded-full bg-[#F8F7FC] hover:bg-[#EDE9FE] text-[#6B7280] font-bold flex items-center justify-center cursor-pointer transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-7">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F59E0B] via-[#F97316] to-[#DB2777] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(245,158,11,0.35)]">
              <TrendingUp className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-extrabold text-[#171717] mt-3">Invest to Earn Faster</h2>
            <p className="text-xs text-[#6B7280] mt-1 leading-relaxed text-gradient">Be Part of the New Revolution 🚀</p>
          </div>

          <div className="space-y-2.5 mt-5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/80 border border-amber-100">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#F97316] text-white flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </span>
              <div>
                <span className="block text-xs font-bold text-[#171717]">Up to 28% APY</span>
                <span className="block text-[10px] text-[#6B7280] mt-0.5">Flexible & fixed-term vaults. Your XENA works while you sleep.</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/80 border border-amber-100">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#F97316] text-white flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </span>
              <div>
                <span className="block text-xs font-bold text-[#171717]">Daily compounding yield</span>
                <span className="block text-[10px] text-[#6B7280] mt-0.5">Rewards calculated daily. Auto-credited to your balance.</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <div>
                <span className="block text-xs font-bold text-[#171717]">Start from 15,000 XENA (~$3)</span>
                <span className="block text-[10px] text-[#6B7280] mt-0.5">Low entry. Multiple plans: 30d, 90d, 180d, 365d.</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50/70 border border-purple-100">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </span>
              <div>
                <span className="block text-xs font-bold text-[#171717]">New Revolution: Stake & Earn</span>
                <span className="block text-[10px] text-[#6B7280] mt-0.5">Join thousands earning passive XENA. Your tokens secure the network.</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              onStartInvesting();
            }}
            className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#F97316] text-white font-bold text-xs flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-md cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" /> Start Investing
          </button>
          <button
            onClick={onClose}
            className="w-full mt-2 py-2.5 rounded-xl bg-[#F8F7FC] border border-[#EDE9FE] text-[#6B7280] font-bold text-xs hover:bg-[#EDE9FE] transition-colors cursor-pointer"
          >
            Finish
          </button>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
            Principal + yield unlocked at maturity. Cancel early with admin approval.
          </div>
        </div>
      </div>
    </div>
  );
};