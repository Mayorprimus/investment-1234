import React, { useState } from 'react';
import { X, TrendingUp, RefreshCw, CheckCircle2, ArrowRight, Shield } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Transaction } from '../../types';
import { XenaTokenBadge } from '../XenaLogo';

interface BuySellModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'buy' | 'sell';
  currentPrice: number;
  availableXena: number;
  onSuccess: (amountChange: number, newTx: Transaction) => void;
}

export const BuySellModal: React.FC<BuySellModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'buy',
  currentPrice = 0.0002,
  availableXena,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'buy' | 'sell'>(initialMode);
  const [amountXena, setAmountXena] = useState<string>('200');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  const xenaValue = parseFloat(amountXena) || 0;
  const usdtTotal = (xenaValue * currentPrice).toFixed(2);

  const handleAmountChange = (val: string) => {
    setAmountXena(val);
  };

  const handleUsdtChange = (val: string) => {
    const usdt = parseFloat(val) || 0;
    setAmountXena((usdt / currentPrice).toFixed(2));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (xenaValue <= 0) return;
    if (mode === 'sell' && xenaValue > availableXena) return;

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsDone(true);
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } catch {}

      const newTx: Transaction = {
        id: `tx-${Date.now().toString().slice(-4)}`,
        title: mode === 'buy' ? 'Buy XENA' : 'Sell XENA',
        type: mode === 'buy' ? 'buy' : 'sell',
        amount: mode === 'buy' ? xenaValue : -xenaValue,
        unit: 'XENA',
        status: 'Completed',
        timestamp: 'Just now',
        fee: 0.50,
        paymentMethod: mode === 'buy' ? 'USDT Balance / Card' : 'Direct Settlement',
      };

      onSuccess(mode === 'buy' ? xenaValue : -xenaValue, newTx);
      setTimeout(() => {
        setIsDone(false);
        onClose();
      }, 1600);
    }, 750);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" id="buy-sell-modal">
      <div className="relative w-full max-w-md bg-white rounded-t-[28px] sm:rounded-2xl shadow-2xl border border-[#EDE9FE] overflow-hidden max-h-[92vh] flex flex-col">
        {/* Mobile drag handle bar */}
        <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto sm:hidden mt-3 mb-1 shrink-0" />

        {/* Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[#EDE9FE] bg-[#F8F7FC] shrink-0">
          <div className="flex items-center gap-2.5">
            <XenaTokenBadge size={32} />
            <div>
              <h3 className="font-bold text-[#171717] text-base">
                {mode === 'buy' ? 'Buy XENA Token' : 'Sell XENA Token'}
              </h3>
              <p className="text-[11px] text-[#6B7280]">
                Market Rate: <span className="font-semibold text-[#6D28D9]">{currentPrice.toFixed(4)} USDT</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#6B7280] hover:text-[#171717] hover:bg-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Buy / Sell Toggle Tabs */}
        <div className="flex p-1.5 bg-[#F8F7FC] mx-4 sm:mx-6 mt-3 sm:mt-4 rounded-xl border border-[#EDE9FE] shrink-0">
          <button
            type="button"
            onClick={() => setMode('buy')}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all min-h-[38px] ${
              mode === 'buy'
                ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-sm'
                : 'text-[#6B7280] hover:text-[#171717]'
            }`}
          >
            Buy XENA
          </button>
          <button
            type="button"
            onClick={() => setMode('sell')}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all min-h-[38px] ${
              mode === 'sell'
                ? 'bg-[#171717] text-white shadow-sm'
                : 'text-[#6B7280] hover:text-[#171717]'
            }`}
          >
            Sell XENA
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {isDone ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-purple-50 text-[#6D28D9] flex items-center justify-center border border-purple-200">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-[#171717]">Order Filled Instantly!</h4>
              <p className="text-xs text-[#6B7280]">
                {mode === 'buy' ? `+${xenaValue} XENA credited to your wallet.` : `Settled $${usdtTotal} USDT to your balance.`}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* You Pay / You Receive */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-[#171717] mb-1.5">
                  <span>{mode === 'buy' ? 'You Pay (USDT)' : 'You Sell (XENA)'}</span>
                  {mode === 'sell' && (
                    <span className="text-[11px] text-[#6B7280]">
                      Available: <span className="text-[#6D28D9] font-bold">{availableXena} XENA</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={mode === 'buy' ? usdtTotal : amountXena}
                    onChange={(e) => (mode === 'buy' ? handleUsdtChange(e.target.value) : handleAmountChange(e.target.value))}
                    step="any"
                    min="1"
                    required
                    className="w-full px-4 py-2.5 text-base font-semibold text-[#171717] bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl focus:outline-none focus:border-[#7C3AED] focus:bg-white pr-20"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs bg-white px-2 py-1 rounded-md border border-[#EDE9FE] text-[#171717]">
                    {mode === 'buy' ? 'USDT' : 'XENA'}
                  </span>
                </div>
              </div>

              {/* Converter Arrow */}
              <div className="flex justify-center -my-1">
                <div className="p-1.5 rounded-full bg-purple-50 text-[#7C3AED] border border-purple-100 shadow-sm">
                  <RefreshCw className="w-3.5 h-3.5" />
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-[#171717] mb-1.5">
                  {mode === 'buy' ? 'You Receive (XENA)' : 'You Receive (USDT)'}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={mode === 'buy' ? amountXena : usdtTotal}
                    onChange={(e) => (mode === 'buy' ? handleAmountChange(e.target.value) : handleUsdtChange(e.target.value))}
                    step="any"
                    min="1"
                    required
                    className="w-full px-4 py-2.5 text-base font-semibold text-[#171717] bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl focus:outline-none focus:border-[#7C3AED] focus:bg-white pr-20"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs bg-purple-50 px-2 py-1 rounded-md border border-purple-100 text-[#6D28D9]">
                    {mode === 'buy' ? 'XENA' : 'USDT'}
                  </span>
                </div>
              </div>

              {/* Fee & Rate Summary */}
              <div className="p-3 rounded-xl bg-[#F8F7FC] border border-[#EDE9FE] text-xs space-y-1.5">
                <div className="flex justify-between text-[#6B7280]">
                  <span>Execution Fee (0.05%):</span>
                  <span className="font-semibold text-emerald-600">Zero Fee Promo</span>
                </div>
                <div className="flex justify-between text-[#6B7280]">
                  <span>Guaranteed Rate:</span>
                  <span className="font-medium text-[#171717]">1 XENA = {currentPrice} USDT</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing || (mode === 'sell' && xenaValue > availableXena)}
                className={`w-full py-3 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 ${
                  mode === 'buy'
                    ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:shadow-[0_4px_18px_rgba(124,58,237,0.35)]'
                    : 'bg-[#171717] hover:bg-black'
                } disabled:opacity-50`}
              >
                {isProcessing ? (
                  'Executing Order...'
                ) : (
                  <>
                    <span>{mode === 'buy' ? `Buy ${amountXena || 0} XENA` : `Sell ${amountXena || 0} XENA`}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
