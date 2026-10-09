import React from 'react';
import { Sparkles, X, Trophy, CheckCircle2, Loader2 } from 'lucide-react';
import { dailySpinCheck, dailySpin } from '../../lib/api';

interface DailySpinModalProps {
  open: boolean;
  onClose: () => void;
  onWon?: (reward: number) => void;
}

export const DailySpinModal: React.FC<DailySpinModalProps> = ({ open, onClose, onWon }) => {
  const [checked, setChecked] = React.useState(false);
  const [canSpin, setCanSpin] = React.useState(false);
  const [spinning, setSpinning] = React.useState(false);
  const [reward, setReward] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [claimed, setClaimed] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setChecked(false);
    setCanSpin(false);
    setReward(null);
    setError(null);
    setClaimed(false);
    dailySpinCheck().then((res) => {
      if (!open) return;
      if (res.ok) {
        setCanSpin(!!res.canSpin);
      } else {
        setError(res.error || 'Failed to check spin eligibility.');
        setCanSpin(false);
      }
      setChecked(true);
    });
  }, [open]);

  if (!open) return null;

  const handleSpin = async () => {
    setSpinning(true);
    setError(null);
    const res = await dailySpin();
    setSpinning(false);
    if (res.ok && typeof res.reward === 'number') {
      setReward(res.reward);
      onWon?.(res.reward);
    } else {
      setError(res.error || 'Spin failed.');
      if (/already spun/i.test(res.error || '')) setCanSpin(false);
    }
  };

  const handleClaim = () => {
    setClaimed(true);
    // Give a moment for the claim animation, then close
    setTimeout(() => onClose(), 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-[24px] p-6 w-full max-w-sm shadow-xl relative text-center animate-slide-up">
        <button onClick={onClose} className="absolute top-4 right-4 text-[#6B7280] hover:text-[#171717] cursor-pointer transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center text-white">
          <Sparkles className="w-7 h-7" />
        </div>
        <h3 className="mt-4 text-lg font-extrabold text-[#171717]">Daily Spin</h3>
        <p className="text-xs text-[#6B7280] mt-1">Spin once every 24 hours for a chance to win XENA.</p>

        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {['1000', '500', '300', '100', '50'].map((v) => (
            <span key={v} className="px-2.5 py-1 rounded-full bg-purple-50 text-[#6D28D9] text-[10px] font-bold border border-purple-100">{v} XENA</span>
          ))}
        </div>

        {!checked ? (
          <div className="mt-5 flex items-center justify-center gap-2 text-[#6D28D9]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Checking eligibility…</span>
          </div>
        ) : reward !== null ? (
          <div className="mt-5 space-y-3">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 animate-pulse-subtle">
              <Trophy className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="mt-2 text-2xl font-black text-emerald-700">+{reward.toLocaleString()} XENA</p>
              <p className="text-[11px] text-emerald-600">You won! Click Claim to add to your balance.</p>
            </div>
            {!claimed ? (
              <button
                onClick={handleClaim}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-extrabold text-sm hover:opacity-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Claim Reward
              </button>
            ) : (
              <div className="text-sm font-bold text-emerald-700 flex items-center justify-center gap-1.5 text-green-600">
                <CheckCircle2 className="w-4 h-4 animate-bounce" /> Claimed! Added to your balance.
              </div>
            )}
          </div>
        ) : canSpin ? (
          <button
            onClick={handleSpin}
            disabled={spinning}
            className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-extrabold text-sm hover:opacity-95 disabled:opacity-50 cursor-pointer transition-all"
          >
            {spinning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Spinning…
              </>
            ) : (
              'Spin Now'
            )}
          </button>
        ) : (
          <div className="mt-5 p-4 rounded-2xl bg-amber-50 border border-amber-100">
            <p className="text-sm font-bold text-amber-700">Already spun today</p>
            <p className="text-[11px] text-amber-600 mt-1">Come back tomorrow for another spin!</p>
          </div>
        )}

        {error && <p className="mt-3 text-xs font-bold text-red-600">{error}</p>}
      </div>
    </div>
  );
};