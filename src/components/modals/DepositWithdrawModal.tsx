import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ArrowDownRight,
  ArrowUpRight,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  QrCode,
  Landmark,
  Banknote,
  ExternalLink,
  Loader2,
  Clock,
  Send,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SavedBankDetail, SavedWalletAddress, Transaction } from '../../types';
import { flutterwaveInitialize, flutterwaveVerify, cryptoCreateInvoice, cryptoCheckDeposit, createWithdrawalRequest } from '../../lib/api';

interface DepositWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'deposit' | 'withdraw';
  availableXena: number;
  nairaBalance: number;
  xenaNgnRate: number;
  xenaUsdPrice: number;
  limits?: { min_deposit_ngn?: number; min_withdrawal_ngn?: number };
  email?: string;
  savedBankDetails?: SavedBankDetail[];
  savedWallets?: SavedWalletAddress[];
  onSuccess: (amountChange: number, newTx: Transaction) => void;
}

const NGN_BANKS = [
  'GTBank',
  'Zenith Bank',
  'Access Bank',
  'UBA',
  'First Bank',
  'Providus Bank',
  'Kuda',
  'OPay',
  'Moniepoint',
];

const CRYPTO_COINS = [
  { id: 'usdt', label: 'USDT', network: 'TRC20', icon: '₮' },
  { id: 'btc', label: 'BTC', network: 'Bitcoin', icon: '₿' },
  { id: 'sol', label: 'SOL', network: 'Solana', icon: '◎' },
  { id: 'eth', label: 'ETH', network: 'Ethereum', icon: 'Ξ' },
] as const;

export const DepositWithdrawModal: React.FC<DepositWithdrawModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'deposit',
  availableXena,
  nairaBalance,
  xenaNgnRate,
  xenaUsdPrice,
  limits,
  email,
  savedBankDetails,
  savedWallets,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>(initialTab);
  const [depositMethod, setDepositMethod] = useState<'ngn' | 'usdt' | 'btc' | 'sol' | 'eth'>('ngn');
  const [ngnAmount, setNgnAmount] = useState<string>('50000');
  const [cryptoAmount, setCryptoAmount] = useState<string>('50');

  const [ngnBank, setNgnBank] = useState('GTBank');
  const [ngnAccountNumber, setNgnAccountNumber] = useState('');
  const [ngnAccountName, setNgnAccountName] = useState('');

  const [withdrawMethod, setWithdrawMethod] = useState<'ngn' | 'crypto'>('ngn');
  const [withdrawCoin, setWithdrawCoin] = useState<string>('usdt');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('50');

  const [copied, setCopied] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [invoice, setInvoice] = useState<any>(null);
  const [waitingPayment, setWaitingPayment] = useState(false);
  const [txRef, setTxRef] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Prefill withdrawal destination from details saved in Settings.
  useEffect(() => {
    if (savedBankDetails && savedBankDetails.length > 0 && !ngnAccountNumber) {
      const b = savedBankDetails[0];
      setNgnBank(b.bankName || 'GTBank');
      setNgnAccountNumber(b.accountNumber || '');
      setNgnAccountName(b.accountName || '');
    }
  }, [savedBankDetails]);

  const lastAutoCoin = useRef<string | null>(null);
  useEffect(() => {
    if (!savedWallets || savedWallets.length === 0) return;
    if (!withdrawAddress && lastAutoCoin.current === null) {
      const w = savedWallets[0];
      setWithdrawAddress(w.address);
      setWithdrawCoin((w.coin as any) || 'usdt');
      lastAutoCoin.current = w.coin;
    }
  }, [savedWallets]);

  useEffect(() => {
    if (!savedWallets) return;
    const match = savedWallets.find((w) => w.coin === withdrawCoin);
    if (match && lastAutoCoin.current !== withdrawCoin && !withdrawAddress) {
      setWithdrawAddress(match.address);
      lastAutoCoin.current = withdrawCoin;
    }
  }, [withdrawCoin, savedWallets]);

  const rate = Math.max(0.0001, xenaNgnRate);
  const minDeposit = limits?.min_deposit_ngn ?? 3000;
  const minWithdrawal = limits?.min_withdrawal_ngn ?? 3000;

  const xenaFromNgn = (n: number) => Math.round((n / rate) * 10000) / 10000;
  const fmtNgn = (n: number) => `₦${Math.round(n).toLocaleString('en-US')}`;
  const ngnFromXena = (x: number) => Math.round(x * rate);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const resetState = () => {
    setError(null);
    setInvoice(null);
    setWaitingPayment(false);
    setTxRef('');
    setSuccessMessage(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const showSuccess = (msg: string) => {
    try { confetti({ particleCount: 80, spread: 65, origin: { y: 0.6 } }); } catch {}
    setSuccessMessage(msg);
    setTimeout(() => { setSuccessMessage(null); handleClose(); }, 2500);
  };

  // ──────────── NGN DEPOSIT (Flutterwave) ────────────
  const handleNgnDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ngn = parseFloat(ngnAmount);
    if (isNaN(ngn) || ngn <= 0) { setError('Enter a valid amount.'); return; }
    if (ngn < minDeposit) { setError(`Minimum deposit is ${fmtNgn(minDeposit)}.`); return; }

    setIsSubmitting(true);
    setError(null);
    const res = await flutterwaveInitialize(ngn);
    setIsSubmitting(false);

    if (!res.ok || !res.paymentLink) { setError(res.error || 'Unable to start payment.'); return; }

    setTxRef(res.txRef || res.reference || '');
    setWaitingPayment(true);
    window.open(res.paymentLink, '_blank', 'noopener,noreferrer');
  };

  const handleVerifyFlutterwave = async () => {
    if (!txRef) { setError('No transaction reference.'); return; }
    setIsSubmitting(true);
    setError(null);
    const res = await flutterwaveVerify(txRef);
    setIsSubmitting(false);

    if (!res.ok) { setError(res.error || 'Payment not confirmed yet. If you paid, try again in a few seconds.'); return; }

    const xena = res.xena || 0;
    const ngn = parseFloat(ngnAmount) || 0;
    const newTx: Transaction = {
      id: `tx-${Date.now().toString().slice(-4)}`,
      title: 'Naira Deposit (Flutterwave)',
      type: 'deposit',
      amount: xena,
      unit: 'XENA',
      status: 'Completed',
      timestamp: 'Just now',
      txHash: txRef,
      paymentMethod: 'Flutterwave · NGN',
      fee: 0,
    };
    onSuccess(xena, newTx);
    showSuccess(`+${xena.toLocaleString()} XENA deposited from ${fmtNgn(ngn)}!`);
  };

  // ──────────── CRYPTO DEPOSIT (NOWPayments) ────────────
  const handleCryptoDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const usd = parseFloat(cryptoAmount);
    if (isNaN(usd) || usd <= 0) { setError('Enter a valid USD amount.'); return; }
    if (usd < 10) { setError('Minimum crypto deposit is $10.'); return; }

    setIsSubmitting(true);
    setError(null);
    const res = await cryptoCreateInvoice(depositMethod, usd);
    setIsSubmitting(false);

    if (!res.ok || !res.invoice) { setError(res.error || 'Unable to create invoice.'); return; }
    setInvoice(res.invoice);
  };

  const handleCheckPayment = async () => {
    if (!invoice?.payment_id) { setError('No active payment.'); return; }
    setIsSubmitting(true);
    setError(null);
    const res = await cryptoCheckDeposit(invoice.payment_id);
    setIsSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Unable to check payment.');
      return;
    }
    if (res.status === 'confirmed' || res.status === 'finished') {
      const xena = res.xena || 0;
      const newTx: Transaction = {
        id: `tx-${Date.now().toString().slice(-4)}`,
        title: 'Crypto Deposit (NOWPayments)',
        type: 'deposit',
        amount: xena,
        unit: 'XENA',
        status: 'Completed',
        timestamp: 'Just now',
        txHash: invoice.payment_id,
        paymentMethod: `NOWPayments · ${invoice.pay_currency?.toUpperCase()}`,
        fee: 0,
      };
      onSuccess(xena, newTx);
      showSuccess(`${xena.toLocaleString()} XENA credited from your crypto deposit!`);
    } else if (res.status === 'waiting' || res.status === 'partially_paid' || res.status === 'confirming') {
      setError('Payment not confirmed yet. Once your transfer reaches the address, click check again (usually 1-3 confirmations).');
    } else {
      setError(`Payment status: ${res.status}. If you think this is wrong, contact support.`);
    }
  };

  // ──────────── NGN WITHDRAWAL ────────────
  const handleNgnWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const ngn = parseFloat(ngnAmount);
    const xena = xenaFromNgn(ngn);
    if (isNaN(ngn) || ngn <= 0) { setError('Enter a valid amount.'); return; }
    if (ngn < minWithdrawal) { setError(`Minimum withdrawal is ${fmtNgn(minWithdrawal)}.`); return; }
    if (xena > availableXena) { setError(`Insufficient balance. You have ${availableXena.toFixed(2)} XENA.`); return; }
    if (!ngnAccountNumber || !ngnAccountName) { setError('Fill in your bank details.'); return; }

    setIsSubmitting(true);
    setError(null);
    const res = await createWithdrawalRequest({
      method: 'ngn',
      amount_xena: xena,
      amount_ngn: ngn,
      bank: ngnBank,
      account_number: ngnAccountNumber,
      account_name: ngnAccountName,
    });
    setIsSubmitting(false);

    if (!res.ok) { setError(res.error || 'Unable to submit withdrawal.'); return; }
    showSuccess(`Withdrawal of ${fmtNgn(ngn)} (${xena.toFixed(2)} XENA) submitted — pending admin approval.`);
  };

  // ──────────── CRYPTO WITHDRAWAL (manual) ────────────
  const handleCryptoWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const xena = parseFloat(withdrawAmount);
    if (isNaN(xena) || xena <= 0) { setError('Enter a valid amount.'); return; }
    if (xena < 1) { setError('Minimum crypto withdrawal is 1 XENA.'); return; }
    if (xena > availableXena) { setError(`Insufficient balance. You have ${availableXena.toFixed(2)} XENA.`); return; }
    if (!withdrawAddress) { setError('Enter a destination address.'); return; }

    setIsSubmitting(true);
    setError(null);
    const res = await createWithdrawalRequest({
      method: withdrawCoin,
      amount_xena: xena,
      address: withdrawAddress,
    });
    setIsSubmitting(false);

    if (!res.ok) { setError(res.error || 'Unable to submit withdrawal.'); return; }
    showSuccess(`Withdrawal of ${xena.toFixed(2)} XENA (${withdrawCoin.toUpperCase()}) submitted — pending admin approval.`);
  };

  const ngnDeposit = Math.max(0, parseFloat(ngnAmount) || 0);
  const availableNgn = ngnFromXena(availableXena);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-t-[28px] sm:rounded-2xl shadow-2xl border border-[#EDE9FE] overflow-hidden max-h-[92vh] flex flex-col">
        <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto sm:hidden mt-3 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[#EDE9FE] bg-[#F8F7FC] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center text-white">
              {activeTab === 'deposit' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-[#171717] text-base sm:text-lg leading-tight">
                {activeTab === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
              </h3>
              <p className="text-[10px] text-[#6B7280]">
                {activeTab === 'deposit' ? 'Flutterwave (NGN) & Crypto' : 'Bank transfer or crypto wallet'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg text-[#6B7280] hover:text-[#171717] hover:bg-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#EDE9FE] p-1.5 bg-[#F8F7FC]/70 mx-4 sm:mx-6 mt-3 sm:mt-4 rounded-xl shrink-0">
          {(['deposit', 'withdraw'] as const).map((t) => (
            <button key={t} type="button" onClick={() => { setActiveTab(t); resetState(); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all min-h-[38px] ${
                activeTab === t ? 'bg-white text-[#6D28D9] shadow-sm font-bold' : 'text-[#6B7280] hover:text-[#171717]'
              }`}>
              {t === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">

          {/* ── Success screen ── */}
          {successMessage ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-[#16A34A] flex items-center justify-center border border-emerald-200">
                <Sparkles className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-[#171717]">Transaction Processed</h4>
              <p className="text-sm text-[#6B7280] max-w-xs mx-auto">{successMessage}</p>
            </div>

          /* ── Deposit tab ── */
          ) : activeTab === 'deposit' ? (

            <div className="space-y-4">

              {/* Method selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">Deposit Method</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'ngn', label: '₦ Naira', desc: 'Flutterwave · 0% fee' },
                    ...CRYPTO_COINS.map((c) => ({ id: c.id, label: `${c.icon} ${c.label}`, desc: c.network })),
                  ].map((m) => (
                    <button key={m.id} type="button" onClick={() => { setDepositMethod(m.id as any); resetState(); }}
                      className={`p-2.5 text-left rounded-xl border text-xs transition-all ${
                        depositMethod === m.id
                          ? 'border-[#7C3AED] bg-purple-50/50 text-[#6D28D9] ring-1 ring-[#7C3AED]'
                          : 'border-[#EDE9FE] bg-white text-[#6B7280] hover:border-purple-200'
                      }`}>
                      <span className="font-bold block text-[#171717]">{m.label}</span>
                      <span className="text-[10px] text-[#6B7280]">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── NGN via Flutterwave ── */}
              {depositMethod === 'ngn' && !waitingPayment && (
                <form onSubmit={handleNgnDeposit} className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white border border-purple-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Landmark className="w-5 h-5" />
                        <div>
                          <p className="text-xs font-extrabold">Flutterwave Checkout</p>
                          <p className="text-[9px] text-purple-100">Card · Bank Transfer · USSD · Mobile Money</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-white/15 border border-white/25 text-[9px] font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-300" /> Secured
                      </span>
                    </div>
                    <p className="text-[9px] text-purple-100 leading-relaxed">
                      You'll be redirected to Flutterwave's secure checkout. Choose from multiple payment methods — card, bank transfer, USSD, or mobile money.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Amount (₦ Naira)</label>
                    <div className="relative">
                      <Banknote className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input type="number" value={ngnAmount} onChange={(e) => setNgnAmount(e.target.value)}
                        min={minDeposit} step="any" required
                        className="w-full px-4 pl-9 py-2.5 text-base font-semibold text-[#171717] bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl focus:outline-none focus:border-[#7C3AED] focus:bg-white transition-all pr-16"
                        placeholder="0.00" />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-[#6D28D9]">₦</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1.5">
                      <span className="text-[#6B7280]">Min: {fmtNgn(minDeposit)}</span>
                      <span className="font-semibold text-[#6D28D9]">1 XENA ≈ {fmtNgn(rate)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-[#171717] bg-emerald-50 border border-emerald-100 rounded-lg p-2 mt-1.5">
                      <span>You receive</span>
                      <span className="text-emerald-600">{ngnDeposit > 0 ? `+${xenaFromNgn(ngnDeposit).toLocaleString()} XENA` : '— XENA'}</span>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
                    </div>
                  )}

                  <button type="submit" disabled={isSubmitting || ngnDeposit < minDeposit}
                    className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:shadow-[0_4px_16px_rgba(109,40,217,0.3)] hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Initializing...</> : <>Pay {fmtNgn(ngnDeposit)} via Flutterwave</>}
                  </button>
                </form>
              )}

              {/* ── Waiting for Flutterwave payment ── */}
              {depositMethod === 'ngn' && waitingPayment && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Clock className="w-5 h-5 animate-pulse" />
                      <span className="text-sm font-bold">Waiting for payment...</span>
                    </div>
                    <p className="text-xs text-amber-600">Flutterwave checkout opened in a new tab. Complete the payment there, then come back and click verify.</p>
                    <p className="text-[10px] text-amber-500 font-mono">Ref: {txRef}</p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
                    </div>
                  )}

                  <button onClick={handleVerifyFlutterwave} disabled={isSubmitting}
                    className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#16A34A] to-[#22C55E] hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : <><Check className="w-4 h-4" /> I've Paid — Verify</>}
                  </button>

                  <button onClick={() => { setWaitingPayment(false); setTxRef(''); resetState(); }} className="w-full py-2 text-xs font-bold text-[#6B7280] hover:text-[#171717] transition-colors">Cancel</button>
                </div>
              )}

              {/* ── Crypto via NOWPayments ── */}
              {depositMethod !== 'ngn' && !invoice && (
                <form onSubmit={handleCryptoDeposit} className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-[#F8F7FC] border border-[#EDE9FE] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#6B7280]">NOWPayments Invoice</span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Auto-credited</span>
                    </div>
                    <p className="text-[10px] text-[#6B7280]">
                      Send exactly the amount shown to the generated address. Your XENA balance is credited automatically once confirmed on-chain (usually 1-3 confirmations).
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Deposit Amount (USD)</label>
                    <div className="relative">
                      <input type="number" value={cryptoAmount} onChange={(e) => setCryptoAmount(e.target.value)}
                        min="10" step="any" required
                        className="w-full px-4 py-2.5 text-base font-semibold text-[#171717] bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl focus:outline-none focus:border-[#7C3AED] focus:bg-white transition-all pr-16"
                        placeholder="0.00" />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-[#6D28D9]">USD</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1.5">
                      <span className="text-[#6B7280]">Min: $10 · Coin: {CRYPTO_COINS.find((c) => c.id === depositMethod)?.label}</span>
                      <span className="font-semibold text-[#6D28D9]">≈ {((parseFloat(cryptoAmount) || 0) / Math.max(0.0001, xenaUsdPrice)).toFixed(2)} XENA</span>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
                    </div>
                  )}

                  <button type="submit" disabled={isSubmitting}
                    className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:shadow-[0_4px_16px_rgba(109,40,217,0.3)] hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating Invoice...</> : 'Generate Invoice'}
                  </button>
                </form>
              )}

              {/* ── Crypto invoice details ── */}
              {depositMethod !== 'ngn' && invoice && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-[#F8F7FC] border border-[#EDE9FE] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#171717]">Pay {invoice.pay_currency?.toUpperCase()} to this address</span>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                        {invoice.status || 'waiting'}
                      </span>
                    </div>

                    {invoice.pay_address && (
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-white rounded-lg border border-[#EDE9FE] text-[#6D28D9]">
                          <QrCode className="w-5 h-5" />
                        </div>
                        <code className="flex-1 text-xs font-mono text-[#171717] bg-white p-2 rounded-lg border border-[#EDE9FE] break-all select-all">
                          {invoice.pay_address}
                        </code>
                        <button type="button" onClick={() => handleCopy(invoice.pay_address, 'addr')}
                          className="px-3 py-2 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white text-xs font-medium rounded-lg hover:opacity-90 flex items-center gap-1 shadow-sm">
                          {copied === 'addr' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied === 'addr' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white rounded-lg p-2 border border-[#EDE9FE]">
                        <span className="text-[10px] text-[#6B7280] block">Send exactly</span>
                        <span className="font-bold text-[#171717] font-mono">{invoice.pay_amount} {invoice.pay_currency?.toUpperCase()}</span>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-[#EDE9FE]">
                        <span className="text-[10px] text-[#6B7280] block">You receive</span>
                        <span className="font-bold text-[#6D28D9] font-mono">≈ {((invoice.pay_amount || 0) / Math.max(0.0001, xenaUsdPrice)).toFixed(2)} XENA</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>After sending, tap 'Check Payment Status' to confirm and credit your XENA.</span>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
                    </div>
                  )}

                  <button onClick={handleCheckPayment} disabled={isSubmitting}
                    className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:shadow-[0_4px_16px_rgba(109,40,217,0.3)] hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</> : <><Check className="w-4 h-4" /> Check Payment Status</>}
                  </button>

                  <button onClick={() => { setInvoice(null); resetState(); }} className="w-full py-2 text-xs font-bold text-[#6B7280] hover:text-[#171717] transition-colors">Cancel</button>
                </div>
              )}
            </div>

          /* ── Withdraw tab ── */
          ) : (
            <div className="space-y-4">

              {/* Balance */}
              <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B7280]">Available for Withdrawal</span>
                  <span className="text-sm font-bold text-[#6D28D9] text-right font-mono">
                    {availableXena.toLocaleString()} XENA
                    <span className="block text-[10px] font-semibold text-[#6B7280]">≈ {fmtNgn(availableNgn)}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#6B7280] border-t border-purple-100 pt-1.5">
                  <span>Min withdrawal</span>
                  <span className="font-bold text-[#171717]">{fmtNgn(minWithdrawal)} (≈ {xenaFromNgn(minWithdrawal).toFixed(2)} XENA)</span>
                </div>
              </div>

              {/* Method selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">Withdraw As</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'ngn', label: '₦ Naira (Bank)', desc: 'To Nigerian account' },
                    { id: 'crypto', label: 'Crypto', desc: 'USDT / BTC / SOL / ETH' },
                  ].map((m) => (
                    <button key={m.id} type="button" onClick={() => { setWithdrawMethod(m.id as any); setError(null); }}
                      className={`p-2.5 text-left rounded-xl border text-xs transition-all ${
                        withdrawMethod === m.id
                          ? 'border-[#7C3AED] bg-purple-50/50 text-[#6D28D9] ring-1 ring-[#7C3AED]'
                          : 'border-[#EDE9FE] bg-white text-[#6B7280] hover:border-purple-200'
                      }`}>
                      <span className="font-bold block text-[#171717]">{m.label}</span>
                      <span className="text-[10px] text-[#6B7280]">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── NGN bank withdrawal ── */}
              {withdrawMethod === 'ngn' && (
              <form onSubmit={handleNgnWithdraw} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-[#171717] mb-1.5">Beneficiary Bank</label>
                      <select value={ngnBank} onChange={(e) => setNgnBank(e.target.value)}
                        className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2.5 text-xs font-bold text-[#171717] focus:outline-none focus:border-[#7C3AED] cursor-pointer">
                        {NGN_BANKS.map((b) => <option key={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#171717] mb-1.5">Account Number</label>
                      <input type="text" value={ngnAccountNumber} onChange={(e) => setNgnAccountNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                        required placeholder="0123456789"
                        className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-[#171717] focus:outline-none focus:border-[#7C3AED]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Account Name</label>
                    <input type="text" value={ngnAccountName} onChange={(e) => setNgnAccountName(e.target.value)}
                      required placeholder="Full Name"
                      className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2.5 text-xs font-bold text-[#171717] focus:outline-none focus:border-[#7C3AED]" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-[#171717]">Withdraw Amount (₦)</label>
                      <div className="flex gap-1.5">
                        {[0.25, 0.5, 0.75, 1].map((pct) => (
                          <button key={pct} type="button"
                            onClick={() => setNgnAmount(Math.max(minWithdrawal, Math.round(availableNgn * pct)).toString())}
                            className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-50 text-[#7C3AED] hover:bg-purple-100 transition-colors">
                            {pct === 1 ? 'MAX' : `${pct * 100}%`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <Banknote className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input type="number" value={ngnAmount} onChange={(e) => setNgnAmount(e.target.value)}
                        max={availableNgn} min={minWithdrawal} step="any" required
                        className="w-full px-4 pl-9 py-2.5 text-base font-semibold text-[#171717] bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl focus:outline-none focus:border-[#7C3AED] focus:bg-white transition-all pr-16"
                        placeholder="0.00" />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-[#6D28D9]">₦</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1.5">
                      <span className="text-[#6B7280]">Debits</span>
                      <span className="font-semibold text-[#6D28D9]">≈ {xenaFromNgn(parseFloat(ngnAmount) || 0).toFixed(2)} XENA @ {fmtNgn(rate)}</span>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Admin reviews all withdrawals. Settlement via NIBSS Instant Transfer on approval.</span>
                  </div>

                  <button type="submit" disabled={isSubmitting || xenaFromNgn(parseFloat(ngnAmount) || 0) > availableXena}
                    className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#5B21B6] via-[#7C3AED] to-[#8B5CF6] hover:shadow-[0_4px_16px_rgba(109,40,217,0.3)] hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><Send className="w-4 h-4" /> Submit Withdrawal</>}
                  </button>
                </form>
              )}

              {/* ── Crypto withdrawal (manual) ── */}
              {withdrawMethod === 'crypto' && (
                <form onSubmit={handleCryptoWithdraw} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">Coin</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {CRYPTO_COINS.map((c) => (
                        <button key={c.id} type="button" onClick={() => setWithdrawCoin(c.id)}
                          className={`p-2 rounded-xl border text-xs transition-all ${
                            withdrawCoin === c.id
                              ? 'border-[#7C3AED] bg-purple-50/50 text-[#6D28D9] ring-1 ring-[#7C3AED]'
                              : 'border-[#EDE9FE] bg-white text-[#6B7280] hover:border-purple-200'
                          }`}>
                          <span className="font-bold block text-[#171717]">{c.icon} {c.label}</span>
                          <span className="text-[10px] text-[#6B7280]">{c.network}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                      Destination {withdrawCoin.toUpperCase()} Address
                    </label>
                    <input type="text" value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)}
                      required placeholder={`Enter ${withdrawCoin.toUpperCase()} (${CRYPTO_COINS.find((c) => c.id === withdrawCoin)?.network}) address`}
                      className="w-full px-4 py-2.5 text-xs font-mono text-[#171717] bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl focus:outline-none focus:border-[#7C3AED]" />
                    {savedWallets && savedWallets.some((w) => w.coin === withdrawCoin) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {savedWallets.filter((w) => w.coin === withdrawCoin).map((w) => (
                          <button key={w.address} type="button"
                            onClick={() => { setWithdrawAddress(w.address); lastAutoCoin.current = withdrawCoin; }}
                            className={`px-2 py-1 text-[9px] font-bold rounded-lg border transition-colors cursor-pointer ${
                              withdrawAddress === w.address
                                ? 'bg-purple-100 text-[#6D28D9] border-purple-200'
                                : 'bg-[#F8F7FC] text-[#6B7280] border-[#EDE9FE] hover:border-purple-200'
                            }`}>
                            Use saved {w.address.slice(0, 10)}…{w.address.slice(-6)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-[#171717]">Withdraw Amount (XENA)</label>
                      <div className="flex gap-1.5">
                        {[0.25, 0.5, 0.75, 1].map((pct) => (
                          <button key={pct} type="button"
                            onClick={() => setWithdrawAmount(Math.max(1, availableXena * pct).toFixed(2))}
                            className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-50 text-[#7C3AED] hover:bg-purple-100 transition-colors">
                            {pct === 1 ? 'MAX' : `${pct * 100}%`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                        max={availableXena} min="1" step="any" required
                        className="w-full px-4 py-2.5 text-base font-semibold text-[#171717] bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl focus:outline-none focus:border-[#7C3AED] focus:bg-white transition-all pr-16"
                        placeholder="0.00" />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-[#6D28D9]">XENA</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1.5">
                      <span className="text-[#6B7280]">Debits</span>
                      <span className="font-semibold text-[#6D28D9]">≈ ${((parseFloat(withdrawAmount) || 0) * Math.max(0.0001, xenaUsdPrice)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Processed manually. Admin reviews and approves before payout is sent to your address.</span>
                  </div>

                  <button type="submit" disabled={isSubmitting || parseFloat(withdrawAmount) > availableXena}
                    className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#5B21B6] via-[#7C3AED] to-[#8B5CF6] hover:shadow-[0_4px_16px_rgba(109,40,217,0.3)] hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><Send className="w-4 h-4" /> Submit Withdrawal</>}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
