import React, { useState } from 'react';
import { Gift, Sparkles, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface BonusCodeSectionProps {
  onRedeemBonus: (code: string) => Promise<{ ok: boolean; error?: string; amount?: number; title?: string }> | void;
  redeemedCodes?: string[];
}

export const BonusCodeSection: React.FC<BonusCodeSectionProps> = ({
  onRedeemBonus,
  redeemedCodes = [],
}) => {
  const [inputCode, setInputCode] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    amount?: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRedeem = async (codeToRedeem?: string) => {
    const rawCode = (codeToRedeem || inputCode).trim().toUpperCase();
    if (!rawCode) {
      setStatusMessage({
        type: 'error',
        text: 'Please enter a bonus or voucher code to redeem.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await onRedeemBonus(rawCode);

      if (!result || !result.ok) {
        setStatusMessage({
          type: 'error',
          text: result?.error || `Unable to redeem code "${rawCode}". Please verify your voucher code.`,
        });
        return;
      }

      const rewardAmount = result.amount ?? 0;

      try {
        confetti({
          particleCount: 85,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#7C3AED', '#A855F7', '#10B981', '#F59E0B', '#3B82F6'],
        });
      } catch {}

      setStatusMessage({
        type: 'success',
        text: `Success! +${rewardAmount.toFixed(2)} XENA credited directly to your available balance!`,
        amount: rewardAmount,
      });
      setInputCode('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="bg-white border border-[#EDE9FE] rounded-[24px] p-4 sm:p-7 shadow-xs relative overflow-hidden" id="bonus-codes-section">
      {/* Decorative gradient blur */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100/40 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      <div className="relative space-y-5">
        {/* Header with badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white flex items-center justify-center shadow-xs shrink-0">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-[#171717]">
                  Redeem Bonus & Voucher Codes
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-purple-50 text-[#6D28D9] text-[10px] font-bold border border-purple-100 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#7C3AED]" />
                  <span>Instant Credit</span>
                </span>
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Have a promo code, community gift card, or referral voucher? Enter it below to claim free XENA tokens.
              </p>
            </div>
          </div>

          {redeemedCodes.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-100 self-start sm:self-auto">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{redeemedCodes.length} Promo{redeemedCodes.length > 1 ? 's' : ''} Claimed</span>
            </div>
          )}
        </div>

        {/* Input & Redeem Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRedeem();
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="Enter bonus code (e.g. WELCOME50)"
              className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-4 py-3 text-sm font-bold tracking-wider text-[#171717] uppercase placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white transition-all pr-12 font-mono"
            />
            {inputCode && (
              <button
                type="button"
                onClick={() => setInputCode('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !inputCode.trim()}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:shadow-md text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Claiming...
              </span>
            ) : (
              <>
                <span>Redeem Voucher</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Status Toast / Alert */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center justify-between animate-fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2.5 font-semibold">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer ml-2"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
