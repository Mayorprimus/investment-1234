import React, { useState } from 'react';
import { X, TrendingUp, Calendar, CheckCircle, Award, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { InvestmentPlan, Transaction } from '../../types';

interface InvestmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: InvestmentPlan | null;
  availableXena: number;
  onClaimYield: (planId: string, amount: number, newTx: Transaction) => void;
}

export const InvestmentDetailModal: React.FC<InvestmentDetailModalProps> = ({
  isOpen,
  onClose,
  plan,
  availableXena,
  onClaimYield,
}) => {
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  if (!isOpen || !plan) return null;

  const handleClaim = () => {
    if (plan.earnedAmount <= 0) return;
    setIsClaiming(true);
    setTimeout(() => {
      setIsClaiming(false);
      setClaimed(true);
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } catch {}

      const newTx: Transaction = {
        id: `tx-${Date.now().toString().slice(-4)}`,
        title: 'Yield Reward Claimed',
        type: 'staking_reward',
        amount: plan.earnedAmount,
        unit: 'XENA',
        status: 'Completed',
        timestamp: 'Just now',
        counterparty: `${plan.name} Yield Pool`,
        fee: 0.00,
      };

      onClaimYield(plan.id, plan.earnedAmount, newTx);
      setTimeout(() => {
        setClaimed(false);
        onClose();
      }, 1600);
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" id="investment-detail-modal">
      <div className="relative w-full max-w-lg bg-white rounded-t-[28px] sm:rounded-2xl shadow-2xl border border-[#EDE9FE] overflow-hidden max-h-[92vh] flex flex-col">
        {/* Mobile drag handle bar */}
        <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto sm:hidden mt-3 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[#EDE9FE] bg-[#F8F7FC] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center text-white">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[#171717] text-base">{plan.name}</h3>
              <p className="text-[11px] text-[#6B7280]">
                {plan.category} Tier · Fixed Yield Contract
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-[#6B7280] hover:text-[#171717] hover:bg-white transition-colors cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE] text-center">
              <span className="text-[11px] text-[#6B7280] block mb-1">Principal Invested</span>
              <span className="font-extrabold text-[#171717] text-sm md:text-base">
                {plan.investedAmount.toLocaleString()} <span className="text-[10px] text-[#6D28D9]">XENA</span>
              </span>
            </div>
            <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-100 text-center">
              <span className="text-[11px] text-emerald-700 font-semibold block mb-1">You Get Back</span>
              <span className="font-extrabold text-[#16A34A] text-sm md:text-base">
                {(plan.investedAmount * (1 + (plan.projectedReturnPercent || 0) / 100)).toLocaleString()} <span className="text-[10px]">XENA</span>
              </span>
            </div>
            <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-100 text-center">
              <span className="text-[11px] text-[#7C3AED] font-semibold block mb-1">Accrued Profit</span>
              <span className="font-extrabold text-[#6D28D9] text-sm md:text-base">
                +{plan.earnedAmount} <span className="text-[10px]">XENA</span>
              </span>
            </div>
          </div>

          {/* Progress Bar Detail */}
          <div className="p-4 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE] space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-[#171717]">Maturity Progress</span>
              <span className="text-[#6D28D9] font-bold">{plan.progressPercent}%</span>
            </div>
            <div className="w-full bg-white h-2.5 rounded-full overflow-hidden border border-[#EDE9FE]">
              <div
                className="h-full bg-gradient-to-r from-[#7C3AED] to-[#A855F7] rounded-full transition-all duration-500"
                style={{ width: `${plan.progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-[#6B7280] pt-1">
              <span>Started {plan.startDate}</span>
              <span className="font-semibold text-[#7C3AED]">{plan.daysRemaining} days remaining</span>
              <span>Ends {plan.endDate}</span>
            </div>
          </div>

          {/* Plan Attributes */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-2 border-b border-[#EDE9FE]">
              <span className="text-[#6B7280]">Daily Reward Payout:</span>
              <span className="font-semibold text-[#171717]">+{plan.dailyYieldXena} XENA / day</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#EDE9FE]">
              <span className="text-[#6B7280]">Total Return Over Lock:</span>
              <span className="font-semibold text-[#16A34A]">+{plan.projectedReturnPercent}%</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#EDE9FE]">
              <span className="text-[#6B7280]">Principal Protection:</span>
              <span className="font-semibold text-[#16A34A] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> 100% Guaranteed by XENA Treasury
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">Auto-Compound:</span>
              <span className="font-semibold text-[#6D28D9]">Enabled (Reinvest Daily)</span>
            </div>
          </div>

          {/* Claim or Compound Buttons */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={handleClaim}
              disabled={isClaiming || plan.earnedAmount <= 0}
              className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:shadow-[0_4px_16px_rgba(109,40,217,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isClaiming ? (
                'Claiming Rewards...'
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Claim +{plan.earnedAmount} XENA</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
