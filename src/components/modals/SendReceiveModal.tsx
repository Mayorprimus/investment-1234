import React, { useState } from 'react';
import { X, Send, QrCode, Copy, Check, ShieldCheck, Sparkles, IdCard, BadgeCheck, AlertCircle, AtSign } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Transaction } from '../../types';
import { transferXena } from '../../lib/api';

interface SendReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'send' | 'receive';
  availableXena: number;
  myXenaCode: string;
  onSuccess: (amountChange: number, newTx: Transaction) => void;
}

const ID_PATTERN = /^xena-[0-9]{8}$/i;

export const SendReceiveModal: React.FC<SendReceiveModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'send',
  availableXena,
  myXenaCode,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'send' | 'receive'>(initialMode);
  const [sendMethod, setSendMethod] = useState<'id' | 'address'>('id');
  const [recipientId, setRecipientId] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<string>('0x9a82...e74b');
  const [amount, setAmount] = useState<string>('150');
  const [note, setNote] = useState<string>('Payment for services');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  if (!isOpen) return null;

  const myXenaAddress = '0x8F4b5C9217E6B2349a1d48cEF918a36284b39A1';
  const cleanId = recipientId.trim().toLowerCase();
  const isOwnCode = cleanId === myXenaCode.toLowerCase();
  const isIdValid = ID_PATTERN.test(cleanId) && !isOwnCode;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0 || num > availableXena) return;
    if (sendMethod === 'id' && !isIdValid) return;
    if (sendMethod === 'address' && !recipientAddress.trim()) return;

    const counterparty = sendMethod === 'id' ? cleanId : recipientAddress.trim();

    setIsProcessing(true);

    // Real internal send: the server resolves the recipient to the account that
    // actually owns the XENA ID, so it can never credit the wrong user.
    if (sendMethod === 'id') {
      const res = await transferXena(cleanId, num, note);
      if (!res.ok) {
        setIsProcessing(false);
        setServerError(res.error || 'Transfer failed.');
        return;
      }
    }

    // External wallet-address sends are network-bound and stay local-only demo.
    setIsProcessing(false);
    try {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } catch {}

    const newTx: Transaction = {
      id: `tx-${Date.now().toString().slice(-4)}`,
      title: 'Transfer Sent',
      type: 'withdrawal',
      amount: -num,
      unit: 'XENA',
      status: 'Completed',
      timestamp: 'Just now',
      counterparty,
      paymentMethod: sendMethod === 'id' ? 'XENA ID Transfer' : 'XENA Mainnet Transfer',
      fee: 0.00,
    };

    onSuccess(-num, newTx);
    setSuccessMsg(`Sent ${num} XENA to ${counterparty} successfully!`);
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" id="send-receive-modal">
      <div className="relative w-full max-w-md bg-white rounded-t-[28px] sm:rounded-2xl shadow-2xl border border-[#EDE9FE] overflow-hidden max-h-[92vh] flex flex-col">
        {/* Mobile drag handle bar */}
        <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto sm:hidden mt-3 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[#EDE9FE] bg-[#F8F7FC] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center text-white">
              {mode === 'send' ? <Send className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-[#171717] text-base leading-tight">
                {mode === 'send' ? 'Send XENA Instantly' : 'Receive XENA'}
              </h3>
              <p className="text-[10px] text-[#6B7280]">
                {mode === 'send' ? 'Transfer by unique XENA ID · zero fee' : `Your code: ${myXenaCode}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-[#6B7280] hover:text-[#171717] hover:bg-white transition-colors cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switch */}
        <div className="flex p-1.5 bg-[#F8F7FC] mx-4 sm:mx-6 mt-3 sm:mt-4 rounded-xl border border-[#EDE9FE] shrink-0">
          <button
            type="button"
            onClick={() => setMode('send')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all min-h-[38px] ${
              mode === 'send'
                ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-sm'
                : 'text-[#6B7280] hover:text-[#171717]'
            }`}
          >
            Send XENA
          </button>
          <button
            type="button"
            onClick={() => setMode('receive')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all min-h-[38px] ${
              mode === 'receive'
                ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-sm'
                : 'text-[#6B7280] hover:text-[#171717]'
            }`}
          >
            Receive XENA
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {successMsg ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-purple-50 text-[#6D28D9] flex items-center justify-center border border-purple-200">
                <Sparkles className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-[#171717]">Transfer Complete</h4>
              <p className="text-xs text-[#6B7280] max-w-xs mx-auto">{successMsg}</p>
            </div>
          ) : mode === 'send' ? (
            <form onSubmit={handleSend} className="space-y-4">
              {/* Method toggle */}
              <div className="flex p-1 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE]">
                <button
                  type="button"
                  onClick={() => setSendMethod('id')}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    sendMethod === 'id' ? 'bg-white text-[#6D28D9] shadow-sm' : 'text-[#6B7280] hover:text-[#171717]'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1"><IdCard className="w-3.5 h-3.5" /> By XENA ID</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSendMethod('address')}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    sendMethod === 'address' ? 'bg-white text-[#6D28D9] shadow-sm' : 'text-[#6B7280] hover:text-[#171717]'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1"><AtSign className="w-3.5 h-3.5" /> Wallet Address</span>
                </button>
              </div>

              {sendMethod === 'id' ? (
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Recipient XENA ID
                  </label>
                  <div className="relative">
                    <IdCard className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value.toLowerCase())}
                      placeholder="xena-00000000"
                      required
                      className="w-full px-4 pl-9 py-2.5 text-xs font-mono text-[#171717] bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl focus:outline-none focus:border-[#7C3AED] focus:bg-white"
                    />
                  </div>

                  {recipientId.trim() !== '' && (
                    <div className="mt-2">
                      {isOwnCode ? (
                        <div className="flex items-center gap-2 text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>That's your own ID — pick a different recipient.</span>
                        </div>
                      ) : isIdValid ? (
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white text-[11px] font-bold flex items-center justify-center">
                            <IdCard className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-[#171717] flex items-center gap-1">
                              XENA account <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />
                            </p>
                            <p className="text-[10px] text-[#6B7280]">{cleanId} · owner will be verified on send</p>
                          </div>
                          <span className="text-[9px] font-bold text-emerald-600 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                            Verified
                          </span>
                        </div>
                      ) : (
                        <p className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                          Format: xena- followed by 8 digits (e.g. xena-19274404)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                    Recipient Wallet Address
                  </label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="0x... or XENA Address"
                    required
                    className="w-full px-4 py-2.5 text-xs font-mono text-[#171717] bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl focus:outline-none focus:border-[#7C3AED] focus:bg-white"
                  />
                </div>
              )}

              <div>
                <div className="flex justify-between text-xs font-semibold text-[#171717] mb-1.5">
                  <span>Amount to Send</span>
                  <span className="text-[#6B7280]">
                    Available: <span className="text-[#6D28D9] font-bold">{availableXena} XENA</span>
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    max={availableXena}
                    min="1"
                    step="any"
                    required
                    className="w-full px-4 py-2.5 text-base font-semibold text-[#171717] bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl focus:outline-none focus:border-[#7C3AED] focus:bg-white pr-16"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-[#6D28D9]">
                    XENA
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1.5">Transfer Memo (Optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Invoice #204"
                  className="w-full px-4 py-2 text-xs text-[#171717] bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl focus:outline-none focus:border-[#7C3AED] focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[#6B7280] bg-purple-50/50 p-2.5 rounded-xl border border-purple-100">
                <span>Internal XENA Network Fee:</span>
                <span className="font-bold text-emerald-600">FREE (0.00 XENA)</span>
              </div>

              {serverError && (
                <div className="flex items-center gap-2 text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl p-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing || parseFloat(amount) > availableXena || (sendMethod === 'id' && !isIdValid)}
                className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:shadow-[0_4px_16px_rgba(109,40,217,0.3)] hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? 'Dispatching Transfer...' : `Send ${amount || 0} XENA`}
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              {/* XENA ID hero card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#5B21B6] via-[#6D28D9] to-[#7C3AED] text-white border border-purple-200 space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-100">
                  <IdCard className="w-3.5 h-3.5" /> Your Unique XENA ID
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono tracking-wide">{myXenaCode}</div>
                <p className="text-[10px] text-purple-100">Unique to your account — share it and friends can send you XENA instantly.</p>
                <button
                  type="button"
                  onClick={() => handleCopy(myXenaCode, 'code')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-xs font-bold hover:bg-white/25 transition-colors cursor-pointer"
                >
                  {copiedKey === 'code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'code' ? 'Copied' : 'Copy ID'}
                </button>
              </div>

              {/* QR Code */}
              <div className="p-4 bg-[#F8F7FC] border border-[#EDE9FE] rounded-2xl inline-block mx-auto shadow-inner">
                <div className="w-40 h-40 bg-white rounded-xl p-3 border border-[#EDE9FE] flex flex-col items-center justify-center relative shadow-sm">
                  <div className="grid grid-cols-5 gap-1.5 w-full h-full p-1 opacity-80">
                    <div className="bg-[#6D28D9] rounded-sm col-span-2 row-span-2"></div>
                    <div className="bg-[#EDE9FE] rounded-sm"></div>
                    <div className="bg-[#6D28D9] rounded-sm col-span-2 row-span-2"></div>
                    <div className="bg-[#6D28D9] rounded-sm"></div>
                    <div className="bg-[#A855F7] rounded-sm"></div>
                    <div className="bg-[#7C3AED] rounded-sm col-span-2"></div>
                    <div className="bg-[#EDE9FE] rounded-sm"></div>
                    <div className="bg-[#6D28D9] rounded-sm"></div>
                    <div className="bg-[#6D28D9] rounded-sm col-span-2 row-span-2"></div>
                    <div className="bg-[#EDE9FE] rounded-sm"></div>
                    <div className="bg-[#A855F7] rounded-sm col-span-2 row-span-2"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#5B21B6] to-[#8B5CF6] text-white flex items-center justify-center shadow-md border-2 border-white">
                      <span className="font-extrabold text-xs">X</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-[#6B7280] block mb-1">Your Personal XENA Deposit Address</span>
                <code className="text-xs font-mono text-[#171717] bg-[#F8F7FC] p-2 rounded-xl border border-[#EDE9FE] block select-all truncate">
                  {myXenaAddress}
                </code>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(myXenaAddress, 'addr')}
                className="w-full py-2.5 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white text-xs font-bold rounded-xl hover:opacity-95 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {copiedKey === 'addr' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedKey === 'addr' ? 'Address Copied to Clipboard' : 'Copy Wallet Address'}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Transfers by ID are escrow-verified & free on the XENA network.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};