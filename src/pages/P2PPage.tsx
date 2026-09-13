import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  Zap,
  Plus,
  X,
  CreditCard,
  Info,
  Check,
  Headphones,
  MessageCircle,
  Mail,
  LifeBuoy,
  ChevronRight,
  BadgeCheck,
  FileText,
  Lock,
} from 'lucide-react';
import { P2POffer } from '../types';

interface P2PPageProps {
  offers: P2POffer[];
  onSelectOffer: (offer: P2POffer, initialPaymentMethod?: string) => void;
  onAddOffer?: (newOffer: P2POffer) => void;
  defaultPrice?: number;
}

const EXPRESS_CHANNELS = ['Revolut', 'Bank Transfer', 'Wise', 'SEPA Instant'];

export const P2PPage: React.FC<P2PPageProps> = ({ offers, onSelectOffer, onAddOffer, defaultPrice = 2.85 }) => {
  const [viewMode, setViewMode] = useState<'marketplace' | 'express'>('marketplace');
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [selectedAsset, setSelectedAsset] = useState<string>('XENA');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [amountQuery, setAmountQuery] = useState<string>('');
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'price' | 'rate' | 'orders' | 'speed'>('price');

  const [expressFiatAmount, setExpressFiatAmount] = useState<string>('250');
  const [expressPayment, setExpressPayment] = useState<string>('Revolut');

  const [showPostAdModal, setShowPostAdModal] = useState<boolean>(false);
  const [showSafetyGuide, setShowSafetyGuide] = useState<boolean>(false);
  const [showMerchantModal, setShowMerchantModal] = useState<boolean>(false);
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false);
  const [isMerchantVerified, setIsMerchantVerified] = useState<boolean>(false);
  const [adSuccessToast, setAdSuccessToast] = useState<string | null>(null);

  const [adTradeType, setAdTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [adPrice, setAdPrice] = useState<string>(String(defaultPrice || 2.85));
  const [adTotalXena, setAdTotalXena] = useState<string>('1000');
  const [adMinLimit, setAdMinLimit] = useState<string>('50');
  const [adMaxLimit, setAdMaxLimit] = useState<string>('2500');
  const [adPaymentMethods, setAdPaymentMethods] = useState<string[]>(['Bank Transfer', 'Revolut']);
  const [adTerms, setAdTerms] = useState<string>('Fast release, strictly no third-party bank transfers.');

  const filteredOffers = useMemo(() => {
    return offers
      .filter((offer) => {
        if (offer.type && offer.type.toUpperCase() !== tradeType) {
          if (tradeType === 'SELL' && offer.type === 'BUY') return false;
        }
        if (verifiedOnly && offer.merchantTier === 'Trader') return false;
        if (selectedPaymentMethod !== 'all') {
          const methods = offer.paymentMethods || (offer.paymentMethod ? offer.paymentMethod.split(',').map((s) => s.trim()) : []);
          if (!methods.some((m) => m.toLowerCase().includes(selectedPaymentMethod.toLowerCase()))) {
            return false;
          }
        }
        if (amountQuery) {
          const parsed = parseFloat(amountQuery);
          if (!isNaN(parsed) && (parsed < offer.minLimit || parsed > offer.maxLimit)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price') return tradeType === 'BUY' ? a.pricePerXena - b.pricePerXena : b.pricePerXena - a.pricePerXena;
        if (sortBy === 'rate') return b.completionRate - a.completionRate;
        if (sortBy === 'orders') return (b.completedOrders || b.ordersCount || 0) - (a.completedOrders || a.ordersCount || 0);
        if (sortBy === 'speed') return (a.responseTimeMinutes || 5) - (b.responseTimeMinutes || 5);
        return 0;
      });
  }, [offers, tradeType, verifiedOnly, selectedPaymentMethod, amountQuery, sortBy]);

  const expressMatchedOffer = useMemo(() => {
    const candidate = filteredOffers.find((o) => {
      const methods = o.paymentMethods || (o.paymentMethod ? [o.paymentMethod] : ['Bank Transfer']);
      if (expressPayment && expressPayment !== 'all') {
        return methods.some((m) => m.toLowerCase().includes(expressPayment.toLowerCase()));
      }
      return true;
    }) || filteredOffers[0] || offers[0];
    return candidate;
  }, [filteredOffers, expressPayment, offers]);

  const expressAmountNum = parseFloat(expressFiatAmount) || 0;
  const expressCalculatedXena = expressMatchedOffer ? (expressAmountNum / expressMatchedOffer.pricePerXena).toFixed(2) : '0.00';

  const handlePostAdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newOffer: P2POffer = {
      id: `p2p-ad-${Date.now()}`,
      merchantName: 'You (Verified Merchant)',
      merchantTier: 'VIP Merchant',
      completionRate: 100.0,
      completedOrders: 1,
      ordersCount: 1,
      type: adTradeType,
      pricePerXena: parseFloat(adPrice) || defaultPrice || 2.85,
      currency: selectedCurrency,
      minLimit: parseFloat(adMinLimit) || 50,
      maxLimit: parseFloat(adMaxLimit) || 2500,
      availableXena: parseFloat(adTotalXena) || 1000,
      paymentMethods: adPaymentMethods,
      paymentMethod: adPaymentMethods.join(', '),
      responseTimeMinutes: 2,
      isOnline: true,
    };
    if (onAddOffer) onAddOffer(newOffer);
    setShowPostAdModal(false);
    setAdSuccessToast(`Your ${adTradeType} trade ad (#${newOffer.id.slice(-5)}) has been submitted for admin approval. It will go live once approved.`);
    setTimeout(() => setAdSuccessToast(null), 5000);
  };

  const toggleAdPaymentMethod = (method: string) => {
    setAdPaymentMethods((prev) => (prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]));
  };

  const getMethods = (offer: P2POffer): string[] =>
    offer.paymentMethods || (offer.paymentMethod ? offer.paymentMethod.split(',').map((s) => s.trim()) : ['Bank Transfer']);

  const inputCls =
    'w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white transition-all';

  const filterCls =
    'h-8 bg-[#F8F7FC] border border-[#EDE9FE] rounded-lg px-2.5 text-[11px] font-bold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white transition-all';

  return (
    <div className="space-y-3 animate-fade-in" id="p2p-page-view">
      {/* ============ HEADER ============ */}
      <div className="bg-white border border-[#EDE9FE] rounded-[20px] px-4 sm:px-6 py-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold text-[#171717] tracking-tight">P2P Trading</h1>
              <p className="text-[11px] text-[#6B7280] truncate">
                Buy & sell XENA directly with verified merchants via your local payment methods.
              </p>
            </div>
          </div>

          {/* Buy / Sell toggle */}
          <div className="flex bg-[#F8F7FC] p-0.5 rounded-lg border border-[#EDE9FE] self-start sm:self-auto">
            <button
              onClick={() => setTradeType('BUY')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${tradeType === 'BUY' ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#171717]'}`}
            >
              Buy
            </button>
            <button
              onClick={() => setTradeType('SELL')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${tradeType === 'SELL' ? 'bg-[#171717] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#171717]'}`}
            >
              Sell
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {adSuccessToast && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{adSuccessToast}</span>
          </div>
          <button onClick={() => setAdSuccessToast(null)} className="text-xs font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* ============ EXPRESS MODE ============ */}
      {viewMode === 'express' && (
        <div className="bg-white border border-[#EDE9FE] rounded-[20px] p-4 sm:p-5 shadow-xs animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EDE9FE]">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-[#6D28D9] text-[10px] font-extrabold uppercase tracking-wide">Express</span>
              <h2 className="text-sm font-bold text-[#171717]">Instant Best-Rate Match</h2>
            </div>
            <div className="flex bg-[#F8F7FC] p-0.5 rounded-lg border border-[#EDE9FE] self-start sm:self-auto">
              <button
                onClick={() => setTradeType('BUY')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${tradeType === 'BUY' ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#171717]'}`}
              >
                Instant Buy
              </button>
              <button
                onClick={() => setTradeType('SELL')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${tradeType === 'SELL' ? 'bg-[#171717] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#171717]'}`}
              >
                Instant Sell
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
            <div className="lg:col-span-7 space-y-3">
              <div className="relative">
                <input
                  type="number"
                  value={expressFiatAmount}
                  onChange={(e) => setExpressFiatAmount(e.target.value)}
                  placeholder="Enter amount"
                  className={`${inputCls} pr-24`}
                />
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white border border-[#EDE9FE] rounded-lg px-2 py-1 text-[11px] font-bold text-[#171717] focus:outline-none cursor-pointer"
                >
                  {['USD', 'EUR', 'GBP'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 -mt-1">
                <span className="text-[10px] font-bold text-[#6B7280]">Quick:</span>
                {['50', '100', '250', '500', '1000'].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setExpressFiatAmount(amt)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${expressFiatAmount === amt ? 'bg-purple-50 text-[#6D28D9] border-purple-200' : 'bg-[#F8F7FC] text-[#6B7280] border-[#EDE9FE] hover:text-[#6D28D9]'}`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-[#6B7280] font-medium">{tradeType === 'BUY' ? 'You receive' : 'You sell'}</p>
                  <p className="text-lg font-extrabold text-[#6D28D9] font-mono leading-tight">{expressCalculatedXena} XENA</p>
                  <p className="text-[9px] text-[#6B7280]">Unit {selectedCurrency} {expressMatchedOffer?.pricePerXena.toFixed(4) || (defaultPrice || 2.85).toFixed(4)}</p>
                </div>
                <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">0% Fee</span>
              </div>

              <div>
                <p className="text-[10px] font-bold text-[#171717] mb-1.5">Payment Channel</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {EXPRESS_CHANNELS.map((method) => (
                    <button
                      key={method}
                      onClick={() => setExpressPayment(method)}
                      className={`p-2 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${expressPayment === method ? 'border-[#7C3AED] bg-purple-50 text-[#6D28D9] ring-1 ring-[#7C3AED]' : 'border-[#EDE9FE] bg-[#F8F7FC] text-[#6B7280] hover:text-[#171717]'}`}
                    >
                      <CreditCard className="w-3 h-3" />
                      {method}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl p-4 flex flex-col justify-between gap-3">
              {expressMatchedOffer ? (
                <>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white font-extrabold text-xs flex items-center justify-center">
                      {expressMatchedOffer.merchantName.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#171717] truncate flex items-center gap-1">
                        {expressMatchedOffer.merchantName}
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                      </p>
                      <p className="text-[10px] text-[#6B7280]">
                        <span className="text-emerald-700 font-bold">{expressMatchedOffer.completionRate}%</span>
                        {' '}· {(expressMatchedOffer.completedOrders || expressMatchedOffer.ordersCount || 1000).toLocaleString()} trades
                      </p>
                    </div>
                    <span className="ml-auto text-[10px] font-bold text-[#16A34A] flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> Online
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between text-[#6B7280]">
                      <span>Release speed</span>
                      <span className="font-bold text-[#171717]">~{expressMatchedOffer.responseTimeMinutes || 2}m avg</span>
                    </div>
                    <div className="flex justify-between text-[#6B7280]">
                      <span>Order limit</span>
                      <span className="font-bold text-[#171717]">${expressMatchedOffer.minLimit} – ${expressMatchedOffer.maxLimit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[#6B7280]">
                      <span>Escrow</span>
                      <span className="font-bold text-[#16A34A]">Auto-Locked & Insured</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectOffer(expressMatchedOffer, expressPayment)}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${tradeType === 'BUY' ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7]' : 'bg-[#171717] hover:bg-slate-800'}`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {tradeType === 'BUY' ? `Buy ${expressCalculatedXena} XENA` : `Sell for ${selectedCurrency} ${expressFiatAmount}`}
                  </button>
                </>
              ) : (
                <div className="text-center py-6 text-xs text-[#6B7280]">No merchant available for this criteria.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ MARKETPLACE MODE ============ */}
      {viewMode === 'marketplace' && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="bg-white border border-[#EDE9FE] rounded-[20px] px-3 sm:px-4 py-2.5 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
              {/* Trade type + asset (left cluster) */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-[#F8F7FC] p-0.5 rounded-lg border border-[#EDE9FE]">
                  <button
                    onClick={() => setTradeType('BUY')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${tradeType === 'BUY' ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#171717]'}`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setTradeType('SELL')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${tradeType === 'SELL' ? 'bg-[#171717] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#171717]'}`}
                  >
                    Sell
                  </button>
                </div>

                <button
                  onClick={() => setShowPostAdModal(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${tradeType === 'SELL' ? 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100' : 'bg-[#F8F7FC] text-[#6B7280] border border-[#EDE9FE] hover:text-[#171717]'}`}
                >
                  <Plus className={`w-3.5 h-3.5 ${tradeType === 'SELL' ? 'text-amber-600' : ''}`} />
                  <span>{tradeType === 'SELL' ? 'List XENA for Sale' : 'Post Ad'}</span>
                </button>

                <button
                  onClick={() => setViewMode('express')}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Express</span>
                </button>
              </div>

              {/* Inline filters (right cluster) */}
              <div className="flex-1 flex flex-wrap items-center gap-2 lg:justify-end">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] shrink-0">
                  {selectedCurrency}
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className={`${filterCls} w-20 cursor-pointer`}
                  >
                    {['USD', 'EUR', 'GBP', 'NGN', 'BRL'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>

                <input
                  type="number"
                  value={amountQuery}
                  onChange={(e) => setAmountQuery(e.target.value)}
                  placeholder="Amount"
                  className={`${filterCls} w-24`}
                />

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className={`${filterCls} w-36 cursor-pointer`}
                >
                  <option value="price">Sort: Best Price</option>
                  <option value="rate">Highest Completion</option>
                  <option value="orders">Most Orders</option>
                  <option value="speed">Fastest Release</option>
                </select>

                <button
                  onClick={() => setVerifiedOnly(!verifiedOnly)}
                  className={`${filterCls} w-auto px-2.5 flex items-center justify-center gap-1 cursor-pointer ${verifiedOnly ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : ''}`}
                >
                  <BadgeCheck className={`w-3.5 h-3.5 ${verifiedOnly ? 'text-emerald-600' : 'text-slate-400'}`} />
                  {verifiedOnly ? 'Verified' : 'All'}
                </button>
              </div>
            </div>
          </div>

          {/* Offers table / cards */}
          <div className="bg-white border border-[#EDE9FE] rounded-[20px] shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-[#EDE9FE] text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#171717]">{filteredOffers.length} offers</span>
                <span className="text-[#6B7280] hidden sm:inline">· 0% platform fee</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" /> Escrow Active
              </span>
            </div>

            {filteredOffers.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-purple-50 text-[#7C3AED] mx-auto flex items-center justify-center">
                  <Search className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-[#171717]">No Matching Offers</h4>
                <p className="text-xs text-[#6B7280] max-w-xs mx-auto">Try clearing filters to see more listings.</p>
                <button
                  onClick={() => { setSelectedPaymentMethod('all'); setAmountQuery(''); setVerifiedOnly(false); }}
                  className="px-4 py-1.5 rounded-lg bg-purple-50 text-[#6D28D9] text-xs font-bold hover:bg-purple-100 transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-[#F4F0FA]">
                  {filteredOffers.map((offer) => {
                    const methods = getMethods(offer);
                    return (
                      <div key={offer.id} className="p-3.5 space-y-2">
                        {/* Row 1: Price + available */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col">
                            <span className={`text-lg font-black font-mono leading-none ${tradeType === 'BUY' ? 'text-[#16A34A]' : 'text-[#E11D48]'}`}>{offer.pricePerXena.toFixed(4)}</span>
                            <span className="text-[10px] text-[#9CA3AF] font-semibold">{selectedCurrency}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-black text-[#171717] font-mono leading-tight">{offer.availableXena.toLocaleString()} {selectedAsset}</p>
                            <p className="text-[10px] text-[#6B7280] leading-tight">{selectedCurrency} {offer.minLimit.toFixed(0)} – {offer.maxLimit.toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Row 2: Merchant */}
                        <div className="flex items-center gap-2">
                          <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white font-extrabold text-[10px] flex items-center justify-center">
                              {offer.merchantName.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-[#171717] truncate">{offer.merchantName}</span>
                              <CheckCircle2 className="w-3 h-3 text-[#16A34A] shrink-0" />
                              {offer.merchantTier && (
                                <span className="px-1 py-0.5 bg-purple-50 text-[#6D28D9] text-[8px] font-bold rounded border border-purple-100 shrink-0">{offer.merchantTier}</span>
                              )}
                            </div>
                            <p className="text-[10px] text-[#6B7280]">
                              <span className="font-bold text-[#16A34A]">{offer.completionRate}% completion</span> · {(offer.completedOrders || offer.ordersCount || 100).toLocaleString()} orders · ⚡ {offer.responseTimeMinutes || 2}m
                            </p>
                          </div>
                        </div>

                        {/* Row 3: Payment methods + action */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F4F0FA]">
                          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                            {methods.map((pm) => (
                              <button
                                key={pm}
                                onClick={() => onSelectOffer(offer, pm)}
                                className="px-2 py-0.5 rounded bg-[#F4F1FA] text-[#6D28D9] text-[9px] font-bold whitespace-nowrap cursor-pointer shrink-0"
                              >
                                {pm}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => onSelectOffer(offer, methods[0])}
                            className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold text-white shrink-0 cursor-pointer active:scale-95 transition-transform ${tradeType === 'BUY' ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7]' : 'bg-[#171717]'}`}
                          >
                            {tradeType === 'BUY' ? 'Buy' : 'Sell'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#EDE9FE] text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">
                        <th className="py-2.5 pl-5 pr-2">Merchant</th>
                        <th className="py-2.5 px-2">Unit Price</th>
                        <th className="py-2.5 px-2">Available</th>
                        <th className="py-2.5 px-2">Payment Methods</th>
                        <th className="py-2.5 px-2">24h Completion</th>
                        <th className="py-2.5 px-5 text-right">Trade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F4F0FA] text-xs">
                      {filteredOffers.map((offer) => {
                        const methods = getMethods(offer);
                        return (
                          <tr key={offer.id} className="hover:bg-[#FAF8FF] transition-colors group">
                            <td className="py-2.5 pl-5 pr-2">
                              <div className="flex items-center gap-2">
                                <div className="relative shrink-0">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white font-extrabold text-[10px] flex items-center justify-center">
                                    {offer.merchantName.substring(0, 2).toUpperCase()}
                                  </div>
                                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="font-bold text-[#171717] truncate group-hover:text-[#6D28D9] transition-colors">{offer.merchantName}</span>
                                    <CheckCircle2 className="w-3 h-3 text-[#16A34A] shrink-0" />
                                  </div>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {offer.merchantTier && (
                                      <span className="px-1 py-0.5 bg-purple-50 text-[#6D28D9] text-[8px] font-bold rounded border border-purple-100">{offer.merchantTier}</span>
                                    )}
                                    <span className="text-[9px] text-[#6B7280]">{(offer.completedOrders || offer.ordersCount || 120).toLocaleString()} orders</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-2">
                              <div className="flex flex-col">
                                <span className={`text-base font-black font-mono leading-tight ${tradeType === 'BUY' ? 'text-[#16A34A]' : 'text-[#E11D48]'}`}>{offer.pricePerXena.toFixed(4)}</span>
                                <span className="text-[10px] text-[#9CA3AF] font-semibold leading-tight">≈ ${offer.pricePerXena.toFixed(2)} {selectedCurrency}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2">
                              <p className="font-bold text-[#171717] font-mono leading-tight">{offer.availableXena.toLocaleString()} {selectedAsset}</p>
                              <p className="text-[10px] text-[#6B7280] leading-tight">{selectedCurrency} {offer.minLimit.toFixed(0)} – {offer.maxLimit.toLocaleString()}</p>
                            </td>
                            <td className="py-2.5 px-2">
                              <div className="flex flex-wrap gap-1 max-w-[180px]">
                                {methods.map((pm) => (
                                  <button
                                    key={pm}
                                    onClick={() => onSelectOffer(offer, pm)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F4F1FA] text-[#6D28D9] font-bold text-[10px] hover:bg-[#EDE6FA] transition-colors cursor-pointer"
                                  >
                                    {pm}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className={`font-black text-sm leading-tight ${offer.completionRate >= 90 ? 'text-[#16A34A]' : 'text-[#F59E0B]'}`}>{offer.completionRate}%</span>
                                <span className="text-[10px] text-[#9CA3AF] leading-tight">⚡ {offer.responseTimeMinutes || 2}m</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-5 text-right">
                              <button
                                onClick={() => onSelectOffer(offer, methods[0])}
                                className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white transition-all shadow-xs cursor-pointer hover:scale-[1.02] active:scale-[0.97] ${tradeType === 'BUY' ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7]' : 'bg-[#171717] hover:bg-slate-800'}`}
                              >
                                {tradeType === 'BUY' ? `Buy` : `Sell`}
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============ HOW ESCROW WORKS (compact) ============ */}
      <div className="bg-white border border-[#EDE9FE] rounded-[20px] p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-[#171717] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#7C3AED]" />
            Escrow-Safe Trading
          </h3>
          <button onClick={() => setShowSafetyGuide(true)} className="text-[11px] font-bold text-[#6D28D9] hover:underline cursor-pointer">
            Full Safety Guide →
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-3">
          {[
            { icon: Lock, title: '1. Escrow Locked', desc: 'Seller crypto is locked in the vault the moment an order is created.' },
            { icon: CreditCard, title: '2. Local Payment', desc: 'Buyer pays the exact amount via bank, Revolut or Wise.' },
            { icon: CheckCircle2, title: '3. Instant Release', desc: 'On seller confirmation, escrow releases crypto instantly.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-3 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE] flex items-start gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-purple-50 text-[#7C3AED] flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5" />
              </span>
              <div>
                <p className="text-[11px] font-bold text-[#171717]">{title}</p>
                <p className="text-[10px] text-[#6B7280] leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ============ SUPPORT (CS) MODAL ============ */}
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
                  <p className="text-[10px] text-[#6B7280]">24/7 Live human assistance</p>
                </div>
              </div>
              <button onClick={() => setShowSupportModal(false)} className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#171717] hover:bg-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-2.5 overflow-y-auto">
              {[
                { icon: MessageCircle, title: 'Live Chat', desc: 'Avg. response 30 seconds', accent: 'bg-purple-50 text-[#7C3AED]' },
                { icon: Mail, title: 'Support Email', desc: 'support@xena.exchange', accent: 'bg-blue-50 text-blue-600' },
                { icon: FileText, title: 'Dispute Center', desc: 'Open a mediation ticket for P2P trades', accent: 'bg-amber-50 text-amber-600' },
                { icon: Headphones, title: 'Call Center', desc: 'Dedicated line for verified merchants', accent: 'bg-emerald-50 text-emerald-600' },
              ].map(({ icon: Icon, title, desc, accent }) => (
                <button
                  key={title}
                  className="w-full flex items-center gap-3 p-3 bg-[#F8F7FC] hover:bg-white border border-[#EDE9FE] hover:border-purple-200 rounded-xl transition-all text-left cursor-pointer group"
                >
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
                <p>For trading disputes, our 24/7 team reviews bank proofs and releases escrow fairly on both sides.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ POST AD MODAL ============ */}
      {showPostAdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-[20px] shadow-2xl border border-[#EDE9FE] overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EDE9FE] bg-[#F8F7FC]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#6D28D9] flex items-center justify-center font-bold text-xs">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#171717] text-sm">Post P2P Trade Advertisement</h3>
                  <p className="text-[10px] text-[#6B7280]">Publish your custom buy or sell listing</p>
                </div>
              </div>
              <button onClick={() => setShowPostAdModal(false)} className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#171717] hover:bg-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePostAdSubmit} className="p-5 overflow-y-auto space-y-3 flex-1">
              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1">Advertisement Type</label>
                <div className="grid grid-cols-2 gap-1.5 bg-[#F8F7FC] p-0.5 rounded-lg border border-[#EDE9FE]">
                  <button
                    type="button"
                    onClick={() => setAdTradeType('BUY')}
                    className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${adTradeType === 'BUY' ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-xs' : 'text-[#6B7280]'}`}
                  >
                    Buy XENA
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdTradeType('SELL')}
                    className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${adTradeType === 'SELL' ? 'bg-[#171717] text-white shadow-xs' : 'text-[#6B7280]'}`}
                  >
                    Sell XENA
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-[#171717] block mb-1">Price (USD)</label>
                  <input type="number" step="0.0001" value={adPrice} onChange={(e) => setAdPrice(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#171717] block mb-1">Volume (XENA)</label>
                  <input type="number" value={adTotalXena} onChange={(e) => setAdTotalXena(e.target.value)} required className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-[#171717] block mb-1">Min Limit</label>
                  <input type="number" value={adMinLimit} onChange={(e) => setAdMinLimit(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#171717] block mb-1">Max Limit</label>
                  <input type="number" value={adMaxLimit} onChange={(e) => setAdMaxLimit(e.target.value)} required className={inputCls} />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1.5">Accepted Payment Methods</label>
                <div className="flex flex-wrap gap-1.5">
                  {['Bank Transfer', 'Revolut', 'Wise', 'SEPA Instant', 'Zelle', 'Apple Pay', 'PayPal'].map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => toggleAdPaymentMethod(pm)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${adPaymentMethods.includes(pm) ? 'border-[#7C3AED] bg-purple-50 text-[#6D28D9] ring-1 ring-[#7C3AED]' : 'border-[#EDE9FE] bg-[#F8F7FC] text-[#6B7280]'}`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1">Terms & Instructions</label>
                <textarea rows={2} value={adTerms} onChange={(e) => setAdTerms(e.target.value)} className={`${inputCls} resize-none`} />
              </div>

              <button type="submit" className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:shadow-[0_4px_16px_rgba(109,40,217,0.3)] transition-all cursor-pointer">
                Publish Advertisement (0% Fee)
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============ SAFETY GUIDE MODAL ============ */}
      {showSafetyGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-[20px] shadow-2xl border border-[#EDE9FE] overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EDE9FE] bg-[#F8F7FC]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#7C3AED]" />
                <h3 className="font-bold text-[#171717] text-sm">P2P Security Protocol</h3>
              </div>
              <button onClick={() => setShowSafetyGuide(false)} className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#171717] hover:bg-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3 text-xs">
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 space-y-1">
                <span className="font-bold block text-xs text-[#6D28D9]">3 Golden Rules for Safe Trading</span>
                <p className="text-[10px] text-[#6B7280]">Follow these to ensure secure, stress-free trades.</p>
              </div>
              {[
                ['Verify in Your Banking App', 'Never rely on SMS or screenshots. Always confirm funds directly in your bank or payment app before releasing crypto.'],
                ['No Third-Party Accounts', 'The counterparty account name must strictly match the KYC name on XENA Exchange.'],
                ['24/7 Dispute Arbitration', 'Open a Dispute for any issue. Our team reviews bank proof and releases escrow fairly.'],
              ].map(([title, desc]) => (
                <div key={title} className="flex gap-2.5 p-3 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE]">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#171717] block">{title}</span>
                    <p className="text-[#6B7280] text-[10px] mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
              <button onClick={() => setShowSafetyGuide(false)} className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:opacity-95 cursor-pointer">
                I Understand & Agree
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MERCHANT MODAL ============ */}
      {showMerchantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-[20px] shadow-2xl border border-[#EDE9FE] overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EDE9FE] bg-gradient-to-r from-purple-50 to-amber-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <BadgeCheck className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#171717] text-sm">Verified Merchant Desk</h3>
                  <p className="text-[10px] text-[#6B7280]">Earn spread income & post fiat ads</p>
                </div>
              </div>
              <button onClick={() => setShowMerchantModal(false)} className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#171717] hover:bg-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE]">
                  <span className="text-[9px] text-[#6B7280] font-bold uppercase block">Maker Fee</span>
                  <span className="text-sm font-black text-[#16A34A]">0.0% Lifetime</span>
                </div>
                <div className="p-3 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE]">
                  <span className="text-[9px] text-[#6B7280] font-bold uppercase block">Placement</span>
                  <span className="text-sm font-black text-[#6D28D9]">Top Featured</span>
                </div>
              </div>
              <div className="space-y-1.5 p-3 bg-purple-50/50 rounded-xl border border-purple-100 text-[11px]">
                <span className="font-bold text-[#171717] block">Merchant Checklist</span>
                {['Identity KYC Level 2', 'Account Security (2FA + PIN)', 'Security Escrow Deposit 500 XENA (Refundable)'].map((item, i) => (
                  <div key={item} className="flex items-center justify-between">
                    <span className="text-[#4B5563]">{item}</span>
                    {i < 2 ? (
                      <span className="text-[#16A34A] font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Passed</span>
                    ) : (
                      <span className="text-[#6D28D9] font-bold">Required</span>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setIsMerchantVerified(true); setShowMerchantModal(false); setAdSuccessToast('Congratulations! You are now an active Verified Merchant on XENA P2P.'); setTimeout(() => setAdSuccessToast(null), 5000); }}
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:shadow-[0_4px_16px_rgba(109,40,217,0.3)] transition-all cursor-pointer"
              >
                {isMerchantVerified ? 'Merchant Privileges Active' : 'Lock 500 XENA & Activate Merchant Desk'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};