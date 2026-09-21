import React, { useState, useMemo, useRef } from 'react';
import { TrendingUp, TrendingDown, ArrowUpRight, BarChart2, ShieldCheck, Activity, Check, Copy, Newspaper, Flame, Sparkles, Search } from 'lucide-react';
import { MarketStats, UserBalances, MarketNewsItem } from '../types';
import { XenaTokenBadge } from '../components/XenaLogo';
import { INITIAL_MARKET_NEWS } from '../data/initialData';

interface MarketPageProps {
  marketStats: MarketStats;
  balances: UserBalances;
  onBuyXena: () => void;
  onSellXena: () => void;
  onTradeSuccess: (amount: number, type: 'buy' | 'sell') => void;
  newsItems?: MarketNewsItem[];
}

/* ============================================================
   PROFESSIONAL PRICE CHART
   Line + area fill, price-axis gridlines, hover crosshair,
   tooltip, and volume bars at the bottom.
============================================================ */
interface MarketChartProps {
  points: number[];
  basePrice: number;
  up?: boolean;
}

const MarketChart: React.FC<MarketChartProps> = ({ points, basePrice, up = true }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 640;
  const H = 240;
  const PAD_X = 52;
  const PAD_TOP = 18;
  const PAD_BOTTOM = 56;

  const lineColor = up ? '#16A34A' : '#DC2626';
  const areaFrom = up ? 'rgba(22,163,74,0.22)' : 'rgba(220,38,38,0.18)';
  const areaTo = 'rgba(255,255,255,0)';

  const minP = Math.min(...points);
  const maxP = Math.max(...points);
  const padding = (maxP - minP) * 0.12 || 0.01;
  const lo = minP - padding;
  const hi = maxP + padding;

  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  const xy = useMemo(() => {
    return points.map((p, i) => {
      const x = PAD_X + (i / (points.length - 1)) * chartW;
      const y = PAD_TOP + (1 - (p - lo) / (hi - lo)) * chartH;
      return { x, y, p };
    });
  }, [points, lo, hi, chartW, chartH]);

  const linePath = xy.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L${xy[xy.length - 1].x.toFixed(2)},${H - PAD_BOTTOM} L${xy[0].x.toFixed(2)},${H - PAD_BOTTOM} Z`;

  // Volume bars (pseudo density shaping the price curve)
  const volume = points.map((p, i) => {
    const v = 0.35 + 0.65 * Math.abs(p - basePrice) / (maxP - minP || 1);
    return v;
  });
  const maxVol = Math.max(...volume);

  const gridLines = 5;
  const priceTicks = Array.from({ length: gridLines + 1 }, (_, i) => hi - (i / gridLines) * (hi - lo));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const rel = (x - PAD_X) / chartW;
    const idx = Math.round(rel * (points.length - 1));
    setHoverIdx(Math.max(0, Math.min(points.length - 1, idx)));
  };

  const hovered = hoverIdx !== null ? xy[hoverIdx] : null;
  const hoveredPrice = hovered ? hovered.p : null;
  const miniLabels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Now'];

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="marketChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={areaFrom} />
            <stop offset="100%" stopColor={areaTo} />
          </linearGradient>
          <linearGradient id="marketChartVol" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? 'rgba(22,163,74,0.5)' : 'rgba(220,38,38,0.5)'} />
            <stop offset="100%" stopColor={up ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)'} />
          </linearGradient>
        </defs>

        {/* vertical grid */}
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`vg-${i}`} x1={PAD_X + (i / 6) * chartW} y1={PAD_TOP} x2={PAD_X + (i / 6) * chartW} y2={H - PAD_BOTTOM} stroke="#EDE9FE" strokeWidth="1" />
        ))}

        {/* horizontal grid + price axis */}
        {priceTicks.map((tick, i) => {
          const y = PAD_TOP + (i / gridLines) * chartH;
          return (
            <g key={`hg-${i}`}>
              <line x1={PAD_X} y1={y} x2={W - 0} y2={y} stroke="#EDE9FE" strokeWidth="1" />
              <text x={PAD_X - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#9CA3AF" fontFamily="monospace">
                ${tick.toFixed(4)}
              </text>
            </g>
          );
        })}

        {/* volume bars area */}
        {xy.map((pt, i) => {
          const vh = (volume[i] / maxVol) * 34;
          return (
            <rect
              key={`vol-${i}`}
              x={pt.x - (chartW / points.length / 2) * 0.7}
              y={H - PAD_BOTTOM - vh}
              width={(chartW / points.length) * 0.62}
              height={vh}
              rx={1}
              fill="url(#marketChartVol)"
              opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.4}
            />
          );
        })}

        {/* time labels */}
        {miniLabels.map((label, i) => {
          const x = PAD_X + (i / (miniLabels.length - 1)) * chartW;
          return (
            <text key={`tl-${i}`} x={x} y={H - 26} textAnchor="middle" fontSize="9" fill="#9CA3AF" fontFamily="monospace">
              {label}
            </text>
          );
        })}
        <text x={W - PAD_X + 4} y={H - 26} textAnchor="middle" fontSize="9" fill="#6B7280" fontFamily="monospace">USD</text>

        {/* area + line */}
        <path d={areaPath} fill="url(#marketChartFill)" />
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />

        {/* crosshair */}
        {hovered && (
          <g>
            <line x1={hovered.x} y1={PAD_TOP} x2={hovered.x} y2={H - PAD_BOTTOM} stroke="#C4B5FD" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={PAD_X} y1={hovered.y} x2={W} y2={hovered.y} stroke="#C4B5FD" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={hovered.x} cy={hovered.y} r="4.5" fill={lineColor} stroke="#fff" strokeWidth="2" />
          </g>
        )}

        {/* current price tag */}
        {!hovered && (
          <g>
            <circle cx={xy[xy.length - 1].x} cy={xy[xy.length - 1].y} r="4.5" fill={lineColor} stroke="#fff" strokeWidth="2" />
            <rect x={xy[xy.length - 1].x - 52} y={Math.max(4, xy[xy.length - 1].y - 24)} width="44" height="16" rx="4" fill={up ? '#16A34A' : '#DC2626'} />
            <text x={xy[xy.length - 1].x - 30} y={Math.max(4, xy[xy.length - 1].y - 24) + 11} textAnchor="middle" fontSize="9" fill="#fff" fontFamily="monospace" fontWeight="bold">
              ${points[points.length - 1].toFixed(4)}
            </text>
          </g>
        )}
      </svg>

      {/* Tooltip card */}
      {hovered && hoveredPrice !== null && (
        <div
          className="absolute pointer-events-none bg-white border border-[#EDE9FE] rounded-lg shadow-lg px-2.5 py-1.5 text-center"
          style={{ left: `calc(${((hovered.x) / W) * 100}% )`, top: `calc(${((hovered.y) / H) * 100}% )`, transform: 'translate(-50%, -120%)' }}
        >
          <p className="text-[10px] font-bold text-[#171717] font-mono">${hoveredPrice.toFixed(4)}</p>
          <p className="text-[9px] text-[#6B7280] font-mono">{miniLabels[hoverIdx ?? 0] || ''}</p>
        </div>
      )}

      {/* change badge */}
      <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-white/85 backdrop-blur border border-[#EDE9FE] text-[10px] font-bold shadow-xs">
        {up ? <TrendingUp className="w-3 h-3 text-[#16A34A]" /> : <TrendingDown className="w-3 h-3 text-[#DC2626]" />}
        <span className={`font-mono ${up ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{up ? '+' : ''}{changePct.toFixed(2)}%</span>
      </div>
    </div>
  );
};

/* ============================================================
   PAGE
============================================================ */
export const MarketPage: React.FC<MarketPageProps> = ({
  marketStats,
  balances,
  onBuyXena,
  onSellXena,
  onTradeSuccess,
  newsItems = INITIAL_MARKET_NEWS,
}) => {
  const [timeframe, setTimeframe] = useState<'1H' | '24H' | '7D' | '1M' | '1Y' | 'ALL'>('24H');
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [orderMethod, setOrderMethod] = useState<'market' | 'limit'>('market');
  const [tradeAmount, setTradeAmount] = useState<string>('100');
  const [copiedContract, setCopiedContract] = useState(false);
  const [tradeSuccessMsg, setTradeSuccessMsg] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [newsSearch, setNewsSearch] = useState<string>('');
  const [activeArticle, setActiveArticle] = useState<MarketNewsItem | null>(null);

  const chartShapes: Record<string, number[]> = {
    '1H': [0.000194, 0.000196, 0.000198, 0.000197, 0.000199, 0.000201, 0.000202],
    '24H': [0.000178, 0.000182, 0.000186, 0.000191, 0.000197, 0.000200, 0.000202],
    '7D': [0.000173, 0.000177, 0.000182, 0.000187, 0.000192, 0.000198, 0.000202],
    '1M': [0.000156, 0.000168, 0.000185, 0.000178, 0.000199, 0.000216, 0.000202],
    '1Y': [0.000054, 0.000078, 0.000108, 0.000137, 0.000167, 0.000185, 0.000202],
    'ALL': [0.000024, 0.000044, 0.000088, 0.000127, 0.000171, 0.000205, 0.000202],
  };

  // Scale the historical shape so its latest point equals the live XENA price,
  // keeping the chart in sync whenever the admin changes the global price.
  const shape = chartShapes[timeframe];
  const anchor = shape[shape.length - 1] || 1;
  const points = shape.map((v) => (v / anchor) * marketStats.price);
  const up = points[points.length - 1] >= points[0];
  const changePct = points[0] ? ((points[points.length - 1] - points[0]) / points[0]) * 100 : 0;

  const numAmount = parseFloat(tradeAmount) || 0;
  const estimatedCost = orderType === 'buy' ? numAmount * marketStats.price : numAmount;

  const handleExecuteQuickTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) return;
    if (orderType === 'buy') {
      onTradeSuccess(numAmount, 'buy');
      setTradeSuccessMsg(`Purchased ${numAmount.toLocaleString()} XENA for $${(numAmount * marketStats.price).toFixed(2)} USD!`);
    } else {
      if (numAmount > balances.availableXena) {
        alert('Insufficient XENA balance in spot account.');
        return;
      }
      onTradeSuccess(numAmount, 'sell');
      setTradeSuccessMsg(`Sold ${numAmount.toLocaleString()} XENA for $${(numAmount * marketStats.price).toFixed(2)} USD!`);
    }
    setTimeout(() => setTradeSuccessMsg(null), 4000);
  };

  const handleCopyContract = () => {
    navigator.clipboard.writeText('0x71c89f92d7a224a51e6074de30e0ef18d9b1c741');
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2500);
  };

  return (
    <div className="space-y-3 animate-fade-in" id="market-page-view">
      {/* ===== 1. Compact Ticker Header ===== */}
      <div className="bg-gradient-to-br from-[#1E1B4B] via-[#6D28D9] to-[#DB2777] rounded-[20px] px-4 sm:px-5 py-3.5 shadow-lg shadow-purple-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#F59E0B]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-[#22D3EE]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <XenaTokenBadge size={30} />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-extrabold text-white tracking-tight">
                  XENA<span className="text-purple-200 font-normal text-xs">/USD</span>
                </h1>
                <span className="px-1.5 py-0.5 rounded bg-white/15 text-white text-[9px] font-bold border border-white/30">Spot</span>
                <span className="px-1.5 py-0.5 rounded bg-white/15 text-emerald-300 text-[9px] font-bold border border-emerald-200/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" /> Live
                </span>
              </div>
              <p className="text-[10px] text-purple-200">Xena Network Native Asset</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 2. Main Grid ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* LEFT: Chart + Orderbook */}
        <div className="lg:col-span-8 space-y-3">
          {/* Chart Card */}
          <div className="bg-white border border-[#EDE9FE] rounded-[20px] p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#EDE9FE]">
              <div>
                <h3 className="text-xs font-bold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#7C3AED]" /> <span className="text-gradient">Price Analytics</span>
                </h3>
                <p className="text-[10px] text-[#6B7280]">Real-time tick data from decentralized liquidity pools</p>
              </div>
              <div className="flex bg-[#F8F7FC] p-0.5 rounded-lg border border-[#EDE9FE]">
                {(['1H', '24H', '7D', '1M', '1Y', 'ALL'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${timeframe === tf ? 'bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#171717]'}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative mt-2">
              <MarketChart points={points} basePrice={marketStats.price} up={up} />
            </div>

            {/* compact metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              {[
                ['Market Cap', '$1,212.5M'],
                ['Supply', '250M XENA'],
                ['TVL', '$142.8M'],
                ['ATH', '$6.40 (2026)'],
              ].map(([label, value]) => (
                <div key={label} className="p-2 bg-[#F8F7FC] rounded-lg border border-[#EDE9FE]">
                  <span className="text-[9px] text-[#6B7280] block leading-none">{label}</span>
                  <span className="text-[11px] font-bold text-[#171717] font-mono leading-tight block mt-0.5">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Orderbook Depth */}
          <div className="bg-white border border-[#EDE9FE] rounded-[20px] p-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#EDE9FE]">
              <div className="flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-[#7C3AED]" />
                <h3 className="text-xs font-bold text-[#171717]">Orderbook Depth</h3>
              </div>
              <span className="text-[10px] font-mono text-[#6B7280]">Spread: 0.002 (0.04%)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
              <div>
                <div className="flex justify-between text-[9px] font-bold text-[#6B7280] uppercase pb-1 border-b border-[#EDE9FE]">
                  <span>Bid Price (USD)</span><span>Amount (XENA)</span>
                </div>
                <div className="space-y-1 mt-1 font-mono text-[11px]">
                  {(() => {
                    const base = marketStats.price;
                    const spread = base * 0.0004; // 0.04% spread
                    return [
                      { price: base - spread * 4, amount: '12,450', depth: 85 },
                      { price: base - spread * 3, amount: '8,200', depth: 60 },
                      { price: base - spread * 2, amount: '24,100', depth: 95 },
                      { price: base - spread, amount: '5,600', depth: 40 },
                    ];
                  })().map((bid, i) => (
                    <div key={i} className="flex justify-between relative py-1 px-1">
                      <div className="absolute inset-y-0 left-0 bg-emerald-50/70 rounded-xs" style={{ width: `${bid.depth}%` }} />
                      <span className="text-[#16A34A] font-bold relative z-10">${bid.price.toFixed(4)}</span>
                      <span className="text-[#171717] relative z-10">{bid.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[9px] font-bold text-[#6B7280] uppercase pb-1 border-b border-[#EDE9FE]">
                  <span>Ask Price (USD)</span><span>Amount (XENA)</span>
                </div>
                <div className="space-y-1 mt-1 font-mono text-[11px]">
                  {(() => {
                    const base = marketStats.price;
                    const spread = base * 0.0004;
                    return [
                      { price: base + spread, amount: '14,300', depth: 75 },
                      { price: base + spread * 2, amount: '9,800', depth: 50 },
                      { price: base + spread * 3, amount: '31,200', depth: 100 },
                      { price: base + spread * 4, amount: '6,400', depth: 35 },
                    ];
                  })().map((ask, i) => (
                    <div key={i} className="flex justify-between relative py-1 px-1">
                      <div className="absolute inset-y-0 left-0 bg-red-50/70 rounded-xs" style={{ width: `${ask.depth}%` }} />
                      <span className="text-[#DC2626] font-bold relative z-10">${ask.price.toFixed(4)}</span>
                      <span className="text-[#171717] relative z-10">{ask.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Trade Panel */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-[#EDE9FE] rounded-[20px] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#171717]">Spot Trading</h3>
              <span className="text-[9px] font-bold text-[#6B7280] bg-[#F8F7FC] px-1.5 py-0.5 rounded-full border border-[#EDE9FE]">0.1% fee</span>
            </div>

            <div className="flex p-0.5 bg-[#F8F7FC] rounded-lg border border-[#EDE9FE]">
              <button onClick={() => setOrderType('buy')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${orderType === 'buy' ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#171717]'}`}>
                Buy XENA
              </button>
              <button onClick={() => setOrderType('sell')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${orderType === 'sell' ? 'bg-[#171717] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#171717]'}`}>
                Sell XENA
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setOrderMethod('market')} className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md cursor-pointer ${orderMethod === 'market' ? 'bg-purple-50 text-[#6D28D9] border border-purple-100' : 'text-[#6B7280] hover:bg-[#F8F7FC]'}`}>
                Market
              </button>
              <button onClick={() => setOrderMethod('limit')} className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md cursor-pointer ${orderMethod === 'limit' ? 'bg-purple-50 text-[#6D28D9] border border-purple-100' : 'text-[#6B7280] hover:bg-[#F8F7FC]'}`}>
                Limit
              </button>
            </div>

            <form onSubmit={handleExecuteQuickTrade} className="space-y-2.5">
              <div>
                <div className="flex justify-between text-[10px] text-[#6B7280] mb-1">
                  <span>Amount (XENA)</span>
                  <span>Available: {balances.availableXena.toLocaleString()}</span>
                </div>
                <div className="relative">
                  <input type="number" step="any" value={tradeAmount} onChange={(e) => setTradeAmount(e.target.value)} placeholder="0.00"
                    className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-lg px-3 py-2 text-sm font-bold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#6D28D9]">XENA</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1">
                {[25, 50, 75, 100].map((pct) => (
                  <button key={pct} type="button" onClick={() => { const base = orderType === 'buy' ? 500 : balances.availableXena; setTradeAmount(((base * pct) / 100).toFixed(2)); }}
                    className="py-1 rounded-md bg-[#F8F7FC] hover:bg-purple-50 text-[#6B7280] hover:text-[#6D28D9] text-[9px] font-bold border border-[#EDE9FE] cursor-pointer">
                    {pct}%
                  </button>
                ))}
              </div>

              <div className="p-2.5 bg-[#F8F7FC] rounded-lg border border-[#EDE9FE] space-y-1 text-[10px]">
                <div className="flex justify-between text-[#6B7280]">
                  <span>Execution Price</span>
                  <span className="font-mono text-[#171717] font-bold">${marketStats.price.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-[#6B7280]">
                  <span>Fee (0.1%)</span>
                  <span className="font-mono text-[#171717]">${(estimatedCost * 0.001).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#EDE9FE] font-bold">
                  <span className="text-[#171717]">{orderType === 'buy' ? 'Total Cost' : 'Output'}</span>
                  <span className="text-[#6D28D9] font-mono">${(estimatedCost * 1.001).toFixed(2)}</span>
                </div>
              </div>

              {tradeSuccessMsg && (
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[#16A34A] text-[10px] font-bold flex items-center gap-1.5 animate-fade-in">
                  <Check className="w-3.5 h-3.5 shrink-0" /> <span>{tradeSuccessMsg}</span>
                </div>
              )}

              <button type="submit" className={`w-full py-2.5 rounded-lg font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer ${orderType === 'buy' ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white' : 'bg-[#171717] text-white hover:bg-slate-800'}`}>
                {orderType === 'buy' ? `Buy ${tradeAmount || '0'} XENA` : `Sell ${tradeAmount || '0'} XENA`}
              </button>
            </form>
          </div>

          {/* Holdings */}
          <div className="bg-white border border-[#EDE9FE] rounded-[20px] p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#EDE9FE]">
              <h3 className="text-xs font-bold text-[#171717]">My Position</h3>
              <span className="text-[9px] text-[#16A34A] font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                +${((balances.availableXena * marketStats.price) - (balances.availableXena * balances.averageBuyPrice)).toFixed(2)}
              </span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between"><span className="text-[#6B7280]">Spot Balance</span><span className="font-bold text-[#171717] font-mono">{balances.availableXena.toLocaleString()} XENA</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">Fiat Value</span><span className="font-bold text-[#6D28D9] font-mono">${(balances.availableXena * marketStats.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">Avg. Entry</span><span className="font-bold text-[#171717] font-mono">${balances.averageBuyPrice.toFixed(4)}</span></div>
            </div>
          </div>

          {/* Contract */}
          <div className="p-3 bg-[#F8F7FC] rounded-[16px] border border-[#EDE9FE] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#171717] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" /> CertiK Audited 99/100
              </span>
              <button onClick={handleCopyContract} className="text-[#7C3AED] hover:underline cursor-pointer p-0.5">
                {copiedContract ? <Check className="w-3 h-3 text-[#16A34A]" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <p className="font-mono text-[9px] text-[#6B7280] truncate">0x71c89f92d7a224a51e6074de30e0ef18d9b1c741</p>
          </div>
        </div>
      </div>

      {/* ===== 3. Market News ===== */}
      <section className="bg-white border border-[#EDE9FE] rounded-[20px] p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2.5 border-b border-[#EDE9FE]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#6D28D9] flex items-center justify-center">
              <Newspaper className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-extrabold text-[#171717]">Market News</h2>
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-[#16A34A] text-[9px] font-bold border border-emerald-100 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-[#16A34A] animate-pulse" /> Live
            </span>
          </div>
          <div className="flex items-center gap-3 bg-[#F8F7FC] px-3 py-1.5 rounded-xl border border-[#EDE9FE]">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-[#16A34A] flex items-center justify-center font-bold text-[10px]">78</div>
            <div>
              <span className="text-[8px] uppercase font-bold text-[#6B7280] block leading-none">Sentiment</span>
              <span className="text-[10px] font-bold text-[#16A34A] flex items-center gap-1 leading-none mt-0.5">
                <Flame className="w-3 h-3 text-amber-500 fill-amber-500" /> Extreme Greed
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {['All', 'Ecosystem', 'Market', 'DeFi', 'Technology', 'Regulation'].map((cat) => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${selectedCategory === cat ? 'bg-[#6D28D9] text-white shadow-xs' : 'bg-[#F8F7FC] text-[#6B7280] hover:text-[#171717] border border-[#EDE9FE]'}`}>
                {cat === 'All' ? 'All' : cat}
              </button>
            ))}
          </div>
          <div className="relative min-w-[180px] sm:w-56">
            <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-2.5 top-2" />
            <input type="text" placeholder="Search news..." value={newsSearch} onChange={(e) => setNewsSearch(e.target.value)}
              className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-[#171717] placeholder-[#6B7280] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {newsItems
            .filter((item) => {
              const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
              const matchesSearch = !newsSearch || item.title.toLowerCase().includes(newsSearch.toLowerCase()) || item.summary.toLowerCase().includes(newsSearch.toLowerCase());
              return matchesCategory && matchesSearch;
            })
            .map((item) => (
              <article key={item.id} onClick={() => setActiveArticle(item)}
                className="bg-[#F8F7FC] hover:bg-white border border-[#EDE9FE] hover:border-purple-200 hover:shadow-sm rounded-xl p-3 flex flex-col justify-between gap-2 transition-all cursor-pointer group">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold text-[#6D28D9] bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-100">{item.category}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${item.sentiment === 'Bullish' ? 'bg-emerald-50 text-[#16A34A] border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{item.sentiment}</span>
                  </div>
                  <h3 className="text-xs font-bold text-[#171717] group-hover:text-[#6D28D9] transition-colors line-clamp-2 leading-snug">{item.title}</h3>
                  <p className="text-[10px] text-[#6B7280] leading-relaxed line-clamp-2">{item.summary}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#EDE9FE] text-[9px] text-[#6B7280]">
                  <span className="font-semibold text-[#171717]">{item.source} · {item.timestamp}</span>
                  <span className="flex items-center gap-0.5 text-[#6D28D9] font-bold">{item.readTime} <ArrowUpRight className="w-3 h-3" /></span>
                </div>
              </article>
            ))}
        </div>
      </section>

      {/* News modal */}
      {activeArticle && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[20px] max-w-lg w-full p-5 space-y-3 shadow-2xl border border-[#EDE9FE] animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-[#EDE9FE]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#6D28D9] bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">{activeArticle.category}</span>
                <span className="text-xs text-[#6B7280]">{activeArticle.timestamp}</span>
              </div>
              <button onClick={() => setActiveArticle(null)} className="w-7 h-7 rounded-full bg-[#F8F7FC] hover:bg-[#EDE9FE] text-[#6B7280] flex items-center justify-center cursor-pointer font-bold">✕</button>
            </div>
            <h2 className="text-base font-extrabold text-[#171717] leading-snug">{activeArticle.title}</h2>
            <p className="text-xs text-[#4B5563] leading-relaxed">{activeArticle.summary}</p>
            <div className="p-3 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE] text-xs text-[#6B7280]">
              <span className="font-bold text-[#171717] flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[#6D28D9]" /> Market Impact</span>
              <p className="mt-1">Positive on-chain inflows and enhanced staking yields bolster liquidity stability for the XENA network.</p>
            </div>
            <button onClick={() => setActiveArticle(null)} className="w-full py-2.5 rounded-xl bg-[#6D28D9] text-white font-bold text-xs hover:bg-[#5B21B6] transition-colors cursor-pointer">Close Report</button>
          </div>
        </div>
      )}
    </div>
  );
};