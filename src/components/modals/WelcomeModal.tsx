import React from 'react';
import { X, Sparkles, Banknote, Coins, ArrowDownCircle, ShieldCheck } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  firstName: string;
  onDeposit: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose, firstName, onDeposit }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" id="welcome-modal">
      <div className="relative w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[24px] shadow-2xl border border-[#EDE9FE] overflow-hidden animate-scale-up">
        <div className="h-1.5 bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#DB2777]" />
        <button
          onClick={onClose}
          className="absolute right-3.5 top-5 w-8 h-8 rounded-full bg-[#F8F7FC] hover:bg-[#EDE9FE] text-[#6B7280] font-bold flex items-center justify-center cursor-pointer transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-7">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#A855F7] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(109,40,217,0.35)]">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-extrabold text-[#171717] mt-3">Welcome to XENA, {firstName}! 🎉</h2>
            <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
              Your account is ready. Make your first deposit to claim your welcome bonus.
            </p>
          </div>

          <div className="space-y-2.5 mt-5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50/80 border border-purple-100">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white flex items-center justify-center">
                <Banknote className="w-4 h-4" />
              </span>
              <div>
                <span className="block text-xs font-bold text-[#171717]">NGN Deposit → ₦1,500 bonus</span>
                <span className="block text-[10px] text-[#6B7280] mt-0.5">Make a Naira deposit to claim ₦1,500 worth of XENA.</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50/80 border border-purple-100">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </span>
              <div>
                <span className="block text-xs font-bold text-[#171717]">USDT / Crypto Deposit → $10 bonus</span>
                <span className="block text-[10px] text-[#6B7280] mt-0.5">Make a crypto deposit to claim a $10 XENA bonus.</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                <ArrowDownCircle className="w-4 h-4" />
              </span>
              <div>
                <span className="block text-xs font-bold text-[#171717]">Bonus unlocks on your first deposit</span>
                <span className="block text-[10px] text-[#6B7280] mt-0.5">Only one welcome bonus per account. Deposit to claim yours.</span>
              </div>
            </div>
          </div>

          <button
            onClick={onDeposit}
            className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-bold text-xs flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-md cursor-pointer"
          >
            <ArrowDownCircle className="w-4 h-4" /> Make a Deposit to Claim
          </button>
          <button
            onClick={onClose}
            className="w-full mt-2 py-2.5 rounded-xl bg-[#F8F7FC] border border-[#EDE9FE] text-[#6B7280] font-bold text-xs hover:bg-[#EDE9FE] transition-colors cursor-pointer"
          >
            Maybe later
          </button>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
            Balances are credited automatically once your deposit is confirmed.
          </div>
        </div>
      </div>
    </div>
  );
};