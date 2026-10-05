import React from 'react';
import { Sparkles, X, Trophy } from 'lucide-react';
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

  React.useEffect(() => {
    if (!open) return;
    setChecked(false);
    setReward(null);
    setError(null);
    dailySpinCheck().then((res) => {
      setCanSpin(!!res.canSpin);
      setChecked(true);
    });
  }, [open]);

  if (!open || (checked && !canSpin && reward === null)) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[24px] p-6 w-full max-w-sm shadow-xl relative text-center">
        <button onClick={onClose} className="absolute top-4 right-4 text-[#6B7280] hover:text-[#171717] cursor-pointer">
          <X className="w-4 h-4" />
        </button>
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center text-white">
          <Sparkles className="w-6 h-6" />
        </div>
        <h3 className="mt-4 text-lg font-extrabold text-[#171717]">Daily Spin</h3>
        <p className="text-xs text-[#6B7280] mt-1">Spin once every 24 hours for a chance to win XENA.</p>

        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {['1000', '500', '300', '100', '50'].map((v) => (
            <span key={v} className="px-2.5 py-1 rounded-full bg-purple-50 text-[#6D28D9] text-[10px] font-bold border border-purple-100">{v} XENA</span>
          ))}
        </div>

        {reward !== null ? (
          <div className="mt-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
            <Trophy className="w-6 h-6 text-emerald-600 mx-auto" />
            <p className="mt-1 text-xl font-black text-emerald-700">+{reward.toLocaleString()} XENA</p>
            <p className="text-[10px] text-emerald-600">Credited to your balance. Come back tomorrow!</p>
          </div>
        ) : (
          <button
            onClick={handleSpin}
            disabled={spinning || !canSpin}
            className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-extrabold text-sm hover:opacity-95 disabled:opacity-50 cursor-pointer"
          >
            {spinning ? 'Spinning…' : canSpin ? 'Spin Now' : 'Already spun — come back in 24h'}
          </button>
        )}

        {error && <p className="mt-3 text-xs font-bold text-red-600">{error}</p>}
      </div>
    </div>
  );
};
