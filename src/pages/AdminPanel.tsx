import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users as UsersIcon,
  ArrowLeftRight,
  Handshake,
  PiggyBank,
  Newspaper,
  LifeBuoy,
  BadgePercent,
  Settings,
  ShieldCheck,
  Search,
  Check,
  X,
  Plus,
  Trash2,
  TrendingUp,
  Eye,
  EyeOff,
  Activity,
  Zap,
  ArrowDownRight,
  ArrowUpRight,
  Mail,
  FileText,
  ChevronRight,
  Lock,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  ClipboardList,
  Timer,
  Banknote,
  UserPlus,
  BadgeCheck,
  Ban,
  Download,
  Gift,
  Copy,
  KeyRound,
  Gem,
  Send,
  Inbox,
  RotateCcw,
} from 'lucide-react';
import { getSupportConversations, replySupportConversation, resolveSupportConversation, replaceAnnouncements, replacePromos, updateAdminSettings } from '../lib/api';
import type { SupportConversation } from '../types';

interface Props {
  onNavigateTab: (tab: string) => void;
  registeredUsers?: { name: string; email: string; country: string; phone: string; dob: string; referrer: string }[];
  users: any[];
  setUsers: React.Dispatch<React.SetStateAction<any[]>>;
  txs: any[];
  setTxs: React.Dispatch<React.SetStateAction<any[]>>;
  merchants: any[];
  setMerchants: React.Dispatch<React.SetStateAction<any[]>>;
  p2pOffers: any[];
  onApproveP2POffer: (offerId: string) => void | Promise<void>;
  onRejectP2POffer: (offerId: string) => void | Promise<void>;
  p2pTrades: any[];
  onApproveP2PPayment: (tradeId: string) => void | Promise<void>;
  onRejectP2PPayment: (tradeId: string) => void | Promise<void>;
  accounts: any[];
  onAdjustBalance: (targetEmail: string, amount: number, memo?: string) => Promise<{ ok: boolean; error?: string }>;
  onDeleteAccount: (targetEmail: string) => Promise<{ ok: boolean; error?: string }>;
  xenaPrice: number;
  onSetXenaPrice: (price: number, ngnRate?: number) => Promise<{ ok: boolean; error?: string }>;
  xenaNgnRate?: number;
  disputes: any[];
  setDisputes: React.Dispatch<React.SetStateAction<any[]>>;
  tickets: any[];
  setTickets: React.Dispatch<React.SetStateAction<any[]>>;
  promos: any[];
  setPromos: React.Dispatch<React.SetStateAction<any[]>>;
  announcements: any[];
  setAnnouncements: React.Dispatch<React.SetStateAction<any[]>>;
  audit: any[];
  setAudit: React.Dispatch<React.SetStateAction<any[]>>;
  deposits: any[];
  setDeposits: React.Dispatch<React.SetStateAction<any[]>>;
  referrals: any[];
  setReferrals: React.Dispatch<React.SetStateAction<any[]>>;
  bonusLog: { id: string; code: string; name: string; xena: number; time: string }[];
  setBonusLog: React.Dispatch<React.SetStateAction<{ id: string; code: string; name: string; xena: number; time: string }[]>>;
  settings: { maintenanceMode: boolean; p2pZeroFee: boolean; withdrawApproval: boolean };
  setSettings: React.Dispatch<React.SetStateAction<{ maintenanceMode: boolean; p2pZeroFee: boolean; withdrawApproval: boolean }>>;
  // New write-through features
  withdrawals?: any[];
  onDecideWithdrawal?: (requestId: string, decision: 'approved' | 'rejected', note?: string) => Promise<{ ok: boolean; error?: string }>;
  payments?: any[];
  onMoveP2POffer?: (offerId: string, direction: 'up' | 'down') => Promise<{ ok: boolean; error?: string }>;
  allInvestments?: any[];
  onRestartInvestment?: (id: string, note?: string) => Promise<{ ok: boolean; error?: string }>;
  onCancelInvestment?: (id: string, note?: string) => Promise<{ ok: boolean; error?: string }>;
  onPayoutInvestment?: (id: string, note?: string) => Promise<{ ok: boolean; error?: string }>;
  onPayoutAllVaults?: () => Promise<{ ok: boolean; error?: string; processed?: number }>;
  vaultCatalog?: any[];
  onUpdateVault?: (vaultId: string, updates: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  onAddVault?: (payload: Record<string, unknown>) => Promise<{ ok: boolean; error?: string; id?: string }>;
  onDeleteVault?: (vaultId: string) => Promise<{ ok: boolean; error?: string }>;
  limits?: { min_deposit_ngn?: number; min_withdrawal_ngn?: number };
  onUpdateLimits?: (minDeposit: number, minWithdrawal: number) => Promise<{ ok: boolean; error?: string }>;
}

export const SEED_USERS = [
  { id: 'u1', name: 'Alex Morgan', email: 'alex.morgan@xena.fi', country: 'Canada', kycTier: 'Tier 2', balance: 12840, status: 'Active' },
  { id: 'u2', name: 'Fatima Abubakar', email: 'fatima.a@xena.fi', country: 'Nigeria', kycTier: 'Tier 2', balance: 4520, status: 'Active' },
  { id: 'u3', name: 'David Chen', email: 'd.chen@xena.fi', country: 'Singapore', kycTier: 'Tier 1', balance: 980, status: 'Active' },
  { id: 'u4', name: 'Grace Okafor', email: 'grace.o@xena.fi', country: 'Ghana', kycTier: 'Tier 1', balance: 1210, status: 'Frozen' },
  { id: 'u5', name: 'Omar Hassan', email: 'omar.h@xena.fi', country: 'UAE', kycTier: 'Tier 3 (Institutional)', balance: 78200, status: 'Active' },
  { id: 'u6', name: 'Lina Kowalski', email: 'lina.k@xena.fi', country: 'Poland', kycTier: 'Tier 2', balance: 3360, status: 'Active' },
  { id: 'u7', name: 'Chen Wei', email: 'chen.wei@xena.fi', country: 'China', kycTier: 'Tier 1', balance: 540, status: 'Pending KYC' },
  { id: 'u8', name: 'Sara Mensah', email: 'sara.m@xena.fi', country: 'Kenya', kycTier: 'Tier 1', balance: 720, status: 'Active' },
];

export const SEED_TXS = [
  { id: 't1', user: 'Alex Morgan', type: 'Deposit', amount: 2500, unit: 'XENA', status: 'Completed', time: '2 min ago', method: 'USDT' },
  { id: 't2', user: 'Fatima Abubakar', type: 'Withdrawal', amount: 1500, unit: 'XENA', status: 'Pending', time: '8 min ago', method: 'NGN Bank' },
  { id: 't3', user: 'Omar Hassan', type: 'P2P Sell', amount: 5000, unit: 'XENA', status: 'Completed', time: '22 min ago', method: 'Escrow' },
  { id: 't4', user: 'David Chen', type: 'Deposit', amount: 400, unit: 'XENA', status: 'Completed', time: '1 hr ago', method: 'BTC' },
  { id: 't5', user: 'Lina Kowalski', type: 'Withdrawal', amount: 800, unit: 'XENA', status: 'Pending', time: '2 hrs ago', method: 'USDT' },
  { id: 't6', user: 'Grace Okafor', type: 'P2P Buy', amount: 200, unit: 'XENA', status: 'Failed', time: '3 hrs ago', method: 'Escrow' },
  { id: 't7', user: 'Sara Mensah', type: 'Investment', amount: 50, unit: 'XENA', status: 'Completed', time: '5 hrs ago', method: 'Vault' },
  { id: 't8', user: 'Chen Wei', type: 'Withdrawal', amount: 120, unit: 'XENA', status: 'Completed', time: '8 hrs ago', method: 'SOL' },
];

export const SEED_MERCHANTS = [
  { id: 'm1', name: 'CryptoDesk NG', owner: 'Fatima Abubakar', verified: true, orders: 1240, rating: 98.6 },
  { id: 'm2', name: 'QuickXchange', owner: 'David Chen', verified: false, orders: 312, rating: 92.1 },
  { id: 'm3', name: 'AfriTrade Hub', owner: 'Sara Mensah', verified: true, orders: 860, rating: 97.2 },
  { id: 'm4', name: 'Gulf Prime', owner: 'Omar Hassan', verified: true, orders: 2210, rating: 99.1 },
  { id: 'm5', name: 'EuroBridge', owner: 'Lina Kowalski', verified: false, orders: 145, rating: 88.4 },
];

export const SEED_DISPUTES = [
  { id: 'd1', offer: 'CryptoDesk NG', buyer: 'User 8842', seller: 'Fatima Abubakar', amount: 1500, reason: 'Payment not received', status: 'Open' },
  { id: 'd2', offer: 'Gulf Prime', buyer: 'User 1201', seller: 'Omar Hassan', amount: 3200, reason: 'Wrong NGN amount credited', status: 'Open' },
  { id: 'd3', offer: 'AfriTrade Hub', buyer: 'User 5530', seller: 'Sara Mensah', amount: 800, reason: 'Seller wants release without proof', status: 'Escalated' },
];

export const SEED_TICKETS = [
  { id: 's1', user: 'Alex Morgan', subject: 'Withdrawal stuck on Pending', status: 'Open', priority: 'High', time: '12 min ago' },
  { id: 's2', user: 'Omar Hassan', subject: 'KYC tier upgrade request', status: 'Open', priority: 'Medium', time: '45 min ago' },
  { id: 's3', user: 'Chen Wei', subject: 'Cannot verify identity documents', status: 'Pending', priority: 'High', time: '2 hrs ago' },
  { id: 's4', user: 'Grace Okafor', subject: 'Account frozen — appeal', status: 'Resolved', priority: 'Low', time: '1 day ago' },
];

export const SEED_PROMOS = [
  { id: 'p1', code: 'XENA25', value: 25, unit: 'USD', used: 842, cap: 1000, active: true },
  { id: 'p2', code: 'WELCOME10', value: 10, unit: 'XENA', used: 1210, cap: 2500, active: true },
  { id: 'p3', code: 'STAKER20', value: 20, unit: 'USD', used: 320, cap: 500, active: false },
];

export const SEED_AUDIT = [
  { id: 'a1', action: 'Admin login', actor: 'Super Admin', detail: 'Signed in from 192.168.1.4', time: '2 min ago' },
  { id: 'a2', action: 'Wallet freeze', actor: 'admin@xena.fi', detail: 'Froze account Grace Okafor', time: '1 hr ago' },
  { id: 'a3', action: 'KYC approval', actor: 'KYC Officer', detail: 'Upgraded Chen Wei to Tier 1', time: '3 hrs ago' },
  { id: 'a4', action: 'Payout run', actor: 'System', detail: 'Auto-compounded 1,240 vaults', time: '6 hrs ago' },
  { id: 'a5', action: 'Settings change', actor: 'Super Admin', detail: 'Maintenance mode disabled', time: '1 day ago' },
];

const VAULTS = [
  { category: 'Flexible', apy: 12.0, staked: 82000, plans: 412 },
  { category: '2-Week (14D)', apy: 20.0, staked: 134000, plans: 980 },
  { category: 'Fixed Term (30D)', apy: 28.0, staked: 61000, plans: 355 },
  { category: 'VIP Tier', apy: 42.0, staked: 188000, plans: 210 },
  { category: 'Institutional', apy: 52.0, staked: 420000, plans: 64 },
];

export const SEED_DEPOSITS = [
  { id: 'dep1', user: 'Alex Morgan', email: 'alex.morgan@xena.fi', method: 'USDT (TRC-20)', amount: 2500, unit: 'USD', xena: 8750, status: 'Completed', time: '2 min ago' },
  { id: 'dep2', user: 'Omar Hassan', email: 'omar.h@xena.fi', method: 'Bank Transfer (AED)', amount: 8000, unit: 'USD', xena: 28000, status: 'Completed', time: '22 min ago' },
  { id: 'dep3', user: 'David Chen', email: 'd.chen@xena.fi', method: 'BTC', amount: 400, unit: 'USD', xena: 1400, status: 'Completed', time: '1 hr ago' },
  { id: 'dep4', user: 'Sara Mensah', email: 'sara.m@xena.fi', method: 'M-Pesa', amount: 200, unit: 'USD', xena: 700, status: 'Pending', time: '4 hrs ago' },
  { id: 'dep5', user: 'Lina Kowalski', email: 'lina.k@xena.fi', method: 'EUR SEPA', amount: 1200, unit: 'USD', xena: 4200, status: 'Completed', time: '6 hrs ago' },
  { id: 'dep6', user: 'Fatima Abubakar', email: 'fatima.a@xena.fi', method: 'NGN Bank Transfer', amount: 900, unit: 'USD', xena: 3150, status: 'Pending', time: '9 hrs ago' },
];

export const SEED_REFERRALS = [
  { id: 'r1', user: 'Fatima Abubakar', refCode: 'FATIMA-X', count: 24, earned: 360 },
  { id: 'r2', user: 'Omar Hassan', refCode: 'OMAR-X', count: 41, earned: 615 },
  { id: 'r3', user: 'Alex Morgan', refCode: 'ALEX-X', count: 18, earned: 270 },
  { id: 'r4', user: 'Sara Mensah', refCode: 'SARA-X', count: 12, earned: 180 },
  { id: 'r5', user: 'David Chen', refCode: 'DAVID-X', count: 6, earned: 90 },
  { id: 'r6', user: 'Lina Kowalski', refCode: 'LINA-X', count: 9, earned: 135 },
];

const TxStatusTone: Record<string, string> = {
  Completed: 'bg-emerald-50 text-[#16A34A] border-emerald-100',
  Pending: 'bg-amber-50 text-amber-600 border-amber-100',
  Failed: 'bg-red-50 text-red-600 border-red-100',
};

export const AdminPanel: React.FC<Props> = ({
  onNavigateTab,
  registeredUsers = [],
  users,
  setUsers,
  txs,
  setTxs,
  merchants,
  setMerchants,
  p2pOffers,
  onApproveP2POffer,
  onRejectP2POffer,
  p2pTrades,
  onApproveP2PPayment,
  onRejectP2PPayment,
  accounts,
  onAdjustBalance,
  onDeleteAccount,
  xenaPrice,
  xenaNgnRate = 1500,
  onSetXenaPrice,
  disputes,
  setDisputes,
  tickets,
  setTickets,
  promos,
  setPromos,
  announcements,
  setAnnouncements,
  audit,
  setAudit,
  deposits,
  setDeposits,
  referrals,
  setReferrals,
  bonusLog,
  setBonusLog,
  settings,
  setSettings,
  withdrawals = [],
  onDecideWithdrawal,
  payments = [],
  onMoveP2POffer,
  allInvestments = [],
  onRestartInvestment,
  onCancelInvestment,
  onPayoutInvestment,
  onPayoutAllVaults,
  vaultCatalog = [],
  onUpdateVault,
  onAddVault,
  onDeleteVault,
  limits = {},
  onUpdateLimits,
}) => {
  const { maintenanceMode = false, p2pZeroFee = true, withdrawApproval = true } = settings;
  const updateSettings = (patch: Partial<{ maintenanceMode: boolean; p2pZeroFee: boolean; withdrawApproval: boolean }>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    updateAdminSettings(next).catch(() => {});
  };

  const [section, setSection] = useState<string>('dashboard');
  const [notice, setNotice] = useState<string | null>(null);

  const [userQuery, setUserQuery] = useState('');
  const [txFilter, setTxFilter] = useState('All');
  const [depositFilter, setDepositFilter] = useState('All');
  const [ticketQuery, setTicketQuery] = useState('');

  const [showNewAnn, setShowNewAnn] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnTag, setNewAnnTag] = useState('');
  const [newAnnSummary, setNewAnnSummary] = useState('');
  const [adjustEmail, setAdjustEmail] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustMemo, setAdjustMemo] = useState('');
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const [priceInput, setPriceInput] = useState<string>(String(xenaPrice || 2.85));
  const [ngnRateInput, setNgnRateInput] = useState<string>(String(xenaNgnRate || 1500));
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [convReplies, setConvReplies] = useState<Record<string, string>>({});
  const [convBusy, setConvBusy] = useState(false);
  const [convNotice, setConvNotice] = useState<string | null>(null);

  const pendingWithdrawals = withdrawals.filter((w) => w.status === 'pending');
  const [wdNotes, setWdNotes] = useState<Record<string, string>>({});
  const [wdBusy, setWdBusy] = useState(false);
  const [wdNotice, setWdNotice] = useState<string | null>(null);
  const wdNotify = (msg: string) => {
    setWdNotice(msg);
    setTimeout(() => setWdNotice(null), 4000);
  };

  const [minDepInput, setMinDepInput] = useState<string>(String(limits?.min_deposit_ngn ?? 3000));
  const [minWdInput, setMinWdInput] = useState<string>(String(limits?.min_withdrawal_ngn ?? 3000));
  const [limitsBusy, setLimitsBusy] = useState(false);
  const [limitsError, setLimitsError] = useState<string | null>(null);

  const [vaultEditorId, setVaultEditorId] = useState<string | null>(null);
  const [vaultDraft, setVaultDraft] = useState<Record<string, any>>({});
  const [showAddVault, setShowAddVault] = useState(false);

  const handleDecideWithdrawal = async (id: string, decision: 'approved' | 'rejected') => {
    if (!onDecideWithdrawal) return;
    const note = (wdNotes[id] || '').trim() || undefined;
    if (decision === 'approved' && !window.confirm('Approve this withdrawal? XENA will be debited from the user and settled.')) return;
    setWdBusy(true);
    const res = await onDecideWithdrawal(id, decision, note);
    setWdBusy(false);
    if (!res.ok) {
      wdNotify(res.error || 'Unable to update withdrawal.');
      return;
    }
    setWdNotes((prev) => ({ ...prev, [id]: '' }));
    wdNotify(`Withdrawal ${decision === 'approved' ? 'approved' : 'rejected'}.`);
  };

  const handleApplyLimits = async () => {
    const md = parseFloat(minDepInput);
    const mw = parseFloat(minWdInput);
    if (!md || !mw || md <= 0 || mw <= 0) {
      setLimitsError('Enter valid minimums greater than 0.');
      return;
    }
    if (!onUpdateLimits) {
      setLimitsError('Limits update unavailable.');
      return;
    }
    setLimitsBusy(true);
    setLimitsError(null);
    const res = await onUpdateLimits(md, mw);
    setLimitsBusy(false);
    if (!res.ok) {
      setLimitsError(res.error || 'Unable to update limits.');
      return;
    }
    setLimitsError(null);
    notify('Deposit & withdrawal minimums updated for all users.');
  };

  const loadConversations = async () => {
    const res = await getSupportConversations();
    if (res.ok && res.conversations) setConversations(res.conversations);
  };

  useEffect(() => {
    if (section === 'support') loadConversations();
  }, [section]);

  const handleApplyPrice = async () => {
    const p = parseFloat(priceInput);
    if (!p || p <= 0) {
      setPriceError('Enter a valid price greater than 0.');
      return;
    }
    const r = parseFloat(ngnRateInput);
    if (!r || r <= 0) {
      setPriceError('Enter a valid ₦ rate greater than 0.');
      return;
    }
    setPriceBusy(true);
    setPriceError(null);
    const res = await onSetXenaPrice(p, r);
    setPriceBusy(false);
    if (!res.ok) {
      setPriceError(res.error || 'Unable to update price.');
      return;
    }
    setPriceInput(String(p));
    setNgnRateInput(String(r));
    setNotice('XENA price & ₦ rate updated for all users.');
  };

  const handleReplyConversation = async (conversationId: string, email: string) => {
    const text = (convReplies[conversationId] || '').trim();
    if (!text) return;
    setConvBusy(true);
    const res = await replySupportConversation(email, text);
    setConvBusy(false);
    if (!res.ok) {
      setConvNotice(res.error || 'Unable to send reply.');
      return;
    }
    if (res.conversation) {
      setConversations((prev) =>
        prev.map((c) => (c.id === res.conversation?.id ? (res.conversation as SupportConversation) : c))
      );
    }
    setConvReplies((prev) => ({ ...prev, [conversationId]: '' }));
    setConvNotice('Reply sent. The user will see it in their support chat.');
  };

  const handleResolveConversation = async (conversationId: string, status: 'open' | 'resolved') => {
    const res = await resolveSupportConversation(conversationId, status);
    if (res.ok) {
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, status } : c)));
    }
  };

  const handleDeleteUser = async (email: string, name: string) => {
    if (!window.confirm(`Delete account for ${name} (${email})? This permanently removes their account and data.`)) return;
    setAdjustBusy(true);
    const res = await onDeleteAccount(email);
    setAdjustBusy(false);
    setUsers((prev) => prev.filter((u) => u.email.toLowerCase() !== email.toLowerCase()));
    if (!res.ok && res.error !== 'No account found with that email.') {
      setAdjustError(res.error || 'Unable to delete account.');
      return;
    }
    setNotice(`Account ${email} deleted.`);
  };

  const handleAdjustBalance = async () => {
    const email = adjustEmail.trim();
    const amount = parseFloat(adjustAmount);
    if (!email || !amount) {
      setAdjustError('Enter a valid email and amount.');
      return;
    }
    setAdjustBusy(true);
    setAdjustError(null);
    if (!onAdjustBalance) {
      notify('Balance adjustment unavailable.');
      setAdjustBusy(false);
      return;
    }
    const res = await onAdjustBalance(email, amount, adjustMemo || undefined);
    setAdjustBusy(false);
    if (!res.ok) {
      setAdjustError(res.error || 'Unable to adjust balance.');
      return;
    }
    setAdjustEmail('');
    setAdjustAmount('');
    setAdjustMemo('');
    notify(`${amount >= 0 ? 'Added' : 'Removed'} ${Math.abs(amount)} XENA ${amount >= 0 ? 'to' : 'from'} ${email}`);
  };

  const notify = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const allUsers = [
    ...users.map((u) => ({
      ...u,
      uid: u.uid || u.xenaId || (u.id ? `XN-${u.id.replace(/\D/g, '').padStart(6, '0')}` : '-'),
    })),
    ...registeredUsers.map((r, i) => {
      const live = accounts.find((a) => a.email.toLowerCase() === r.email.toLowerCase());
      return {
        id: `reg-${i}-${r.email.replace(/[^a-z0-9]/gi, '').toLowerCase()}`,
        name: r.name,
        email: r.email,
        country: r.country,
        kycTier: 'Tier 1',
        balance: live?.balances?.availableXena || 0,
        status: 'Active',
        registered: true,
        dob: r.dob,
        phone: r.phone,
        uid: live?.xenaId || `XN-${String(i).padStart(6, '0')}`,
        liveAccount: !!live,
      };
    }),
  ];
  const filteredUsers = allUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(userQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(userQuery.toLowerCase()) ||
      u.country.toLowerCase().includes(userQuery.toLowerCase()) ||
      (u.uid || '').toLowerCase().includes(userQuery.toLowerCase())
  );
  const filteredTxs = txs.filter((t) => txFilter === 'All' || t.status === txFilter);
  const filteredTickets = tickets.filter(
    (t) => t.subject.toLowerCase().includes(ticketQuery.toLowerCase()) || t.user.toLowerCase().includes(ticketQuery.toLowerCase())
  );
  const filteredDeposits = deposits.filter((d) => depositFilter === 'All' || d.status === depositFilter);
  const totalDepositedUsd = deposits.filter((d) => d.status === 'Completed').reduce((sum, d) => sum + d.amount, 0);
  const pendingDepositCount = deposits.filter((d) => d.status === 'Pending').length;

  const referredRegistrations = registeredUsers.filter((ru) => ru.referrer);
  const referralOverview = referrals.map((r) => {
    const matched = referredRegistrations.filter((ru) => ru.referrer.toUpperCase() === r.refCode.toUpperCase());
    const deposited = matched.filter((ru) => deposits.some((d) => d.email.toLowerCase() === ru.email.toLowerCase()));
    const bonusCount = matched.length + deposited.length;
    const earnedXena = deposited.length * 100;
    return { ...r, newCount: matched.length, depositedCount: deposited.length, earnedXena };
  });
  const referralBonusTotal = referralOverview.reduce((s, r) => s + r.earnedXena, 0);

  const kpi = {
    totalUsers: '48,203',
    activeUsers: '12,840',
    volume24h: '$8.4M',
    xenaCirculation: '250M',
    totalStaked: '885K',
    pendingPayouts: pendingWithdrawals.length,
  };

  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: UsersIcon },
    { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
    { id: 'withdrawals', label: 'Withdrawals', icon: ArrowUpRight },
    { id: 'deposits', label: 'Deposits', icon: Banknote },
    { id: 'referrals', label: 'Referrals', icon: UserPlus },
    { id: 'p2p', label: 'P2P Marketplace', icon: Handshake },
    { id: 'investments', label: 'Investments & Staking', icon: PiggyBank },
    { id: 'announcements', label: 'Announcements', icon: Newspaper },
    { id: 'support', label: 'Support Tickets', icon: LifeBuoy },
    { id: 'promos', label: 'Promo Codes', icon: BadgePercent },
    { id: 'system', label: 'System & Audit', icon: Settings },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in" id="admin-panel-view">
      {/* Admin Header */}
      <div className="bg-gradient-to-br from-[#1E1B4B] via-[#7C3AED] to-[#DB2777] rounded-[22px] p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">Admin Control Center</h1>
                <span className="px-2 py-0.5 rounded-md bg-white/15 border border-white/25 text-[9px] font-extrabold uppercase tracking-wide">Staff</span>
              </div>
              <p className="text-[11px] text-purple-100">Manage users, markets, staking, announcements and support</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('home')}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer backdrop-blur self-start sm:self-auto"
          >
            <X className="w-3.5 h-3.5" /> Exit Admin
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs font-bold text-[#16A34A] flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Sidebar */}
        <div className="md:col-span-3 bg-white border border-[#EDE9FE] rounded-[20px] p-2 shadow-sm md:sticky md:top-20">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {nav.map(({ id, label, icon: Icon }) => {
              const isActive = section === id;
              return (
                <button
                  key={id}
                  onClick={() => setSection(id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex-1 md:flex-none ${
                    isActive ? 'bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white shadow-md shadow-fuchsia-200/50' : 'text-[#6B7280] hover:text-[#171717] hover:bg-[#F8F7FC]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                  {isActive && <span className="ml-auto hidden md:block w-1.5 h-1.5 rounded-full bg-white" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="md:col-span-9 space-y-4">
          {/* ============ DASHBOARD ============ */}
          {section === 'dashboard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Total Users', value: kpi.totalUsers, icon: UsersIcon, tone: 'bg-purple-50 text-[#7C3AED]' },
                  { label: 'Active Users', value: kpi.activeUsers, icon: Activity, tone: 'bg-emerald-50 text-emerald-600' },
                  { label: '24h Volume', value: kpi.volume24h, icon: TrendingUp, tone: 'bg-sky-50 text-sky-600' },
                  { label: 'XENA in Circulation', value: kpi.xenaCirculation, icon: Zap, tone: 'bg-amber-50 text-amber-600' },
                  { label: 'Total Staked', value: kpi.totalStaked, icon: PiggyBank, tone: 'bg-fuchsia-50 text-fuchsia-600' },
                  { label: 'Pending Payouts', value: kpi.pendingPayouts, icon: Timer, tone: 'bg-red-50 text-red-500' },
                ].map(({ label, value, icon: Icon, tone }) => (
                  <div key={label} className="bg-white border border-[#EDE9FE] rounded-2xl p-3.5 shadow-sm">
                    <span className={`w-8 h-8 rounded-lg ${tone} flex items-center justify-center`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="block text-lg font-extrabold text-[#171717] font-mono mt-2">{value}</span>
                    <span className="block text-[10px] text-[#6B7280] font-semibold mt-0.5">{label}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[#EDE9FE]">
                  <h3 className="text-sm font-bold text-[#171717]">Platform Health</h3>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">All systems operational</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  {[
                    { label: 'API Uptime', value: '99.98%', bar: 99 },
                    { label: 'Escrow Protection', value: '100%', bar: 100 },
                    { label: 'KYC Throughput', value: '94%', bar: 94 },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <span className="block text-base font-extrabold text-[#171717] font-mono">{s.value}</span>
                      <span className="block text-[9px] text-[#6B7280] mt-0.5 mb-1.5">{s.label}</span>
                      <div className="h-1.5 bg-[#EDE9FE] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#7C3AED] to-[#A855F7] rounded-full" style={{ width: `${s.bar}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => setSection('withdrawals')} className="w-full flex items-center justify-between bg-white border border-[#EDE9FE] rounded-2xl p-4 hover:border-purple-200 transition-colors cursor-pointer shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><AlertTriangle className="w-4 h-4" /></span>
                  <div className="text-left">
                    <span className="block text-xs font-bold text-[#171717]">{pendingWithdrawals.length} withdrawal{pendingWithdrawals.length === 1 ? '' : 's'} awaiting approval</span>
                    <span className="block text-[10px] text-[#6B7280]">Review pending withdrawal requests now</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#6B7280]" />
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={() => setSection('deposits')} className="flex items-center justify-between bg-white border border-[#EDE9FE] rounded-2xl p-4 hover:border-purple-200 transition-colors cursor-pointer shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Banknote className="w-4 h-4" /></span>
                    <div className="text-left">
                      <span className="block text-xs font-bold text-[#171717]">${totalDepositedUsd.toLocaleString()} deposited</span>
                      <span className="block text-[10px] text-[#6B7280]">View the full deposit ledger — all money deposited</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6B7280]" />
                </button>
                <button onClick={() => setSection('referrals')} className="flex items-center justify-between bg-white border border-[#EDE9FE] rounded-2xl p-4 hover:border-purple-200 transition-colors cursor-pointer shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-purple-50 text-[#7C3AED] flex items-center justify-center"><UserPlus className="w-4 h-4" /></span>
                    <div className="text-left">
                      <span className="block text-xs font-bold text-[#171717]">{referralBonusTotal} XENA referral bonuses</span>
                      <span className="block text-[10px] text-[#6B7280]">View referrals — 100 XENA auto-approved per verified deposit</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6B7280]" />
                </button>
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[#EDE9FE]">
                  <h3 className="text-sm font-bold text-[#171717]">Recent Admin Activity</h3>
                  <button onClick={() => setSection('system')} className="text-[10px] font-bold text-[#6D28D9] hover:underline cursor-pointer">View all</button>
                </div>
                <div className="divide-y divide-[#EDE9FE]">
                  {audit.map((a) => (
                    <div key={a.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="font-bold text-[#171717] block">{a.action}</span>
                        <span className="text-[10px] text-[#6B7280] block truncate">{a.detail}</span>
                      </div>
                      <span className="text-[9px] text-[#9CA3AF] shrink-0">{a.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============ USERS ============ */}
          {section === 'users' && (
            <div className="space-y-4">
              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EDE9FE]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-[#171717]">User Management</h3>
                    {registeredUsers.length > 0 && <span className="text-[10px] font-bold text-[#16A34A] bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">{registeredUsers.length} new registration{registeredUsers.length === 1 ? '' : 's'}</span>}
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Search name, email, UID, country..." className="w-full sm:w-72 pl-9 pr-3 py-2 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7C3AED] transition-all" />
                  </div>
                </div>
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-left text-xs min-w-[640px]">
                    <thead>
                      <tr className="text-[10px] text-[#9CA3AF] uppercase tracking-wide font-bold border-b border-[#EDE9FE]">
                        <th className="py-2 pr-3">User</th>
                        <th className="py-2 pr-3">UID</th>
                        <th className="py-2 pr-3">Country</th>
                        <th className="py-2 pr-3">KYC</th>
                        <th className="py-2 pr-3 text-right">Balance (XENA)</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDE9FE]">
                      {filteredUsers.map((u) => {
                        const frozen = u.status === 'Frozen';
                        const banned = u.status === 'Banned';
                        const pendingKyc = u.status === 'Pending KYC';
                        return (
                          <tr key={u.id} className="hover:bg-[#F8F7FC]">
                            <td className="py-2.5 pr-3">
                              <span className="block font-bold text-[#171717]">{u.name} {u.registered && <span className="ml-1 text-[8px] font-extrabold text-[#16A34A] bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">New</span>}</span>
                              <span className="block text-[10px] text-[#6B7280]">{u.email}</span>
                              {u.registered && <span className="block text-[10px] text-[#9CA3AF]">{u.phone || ''}</span>}
                            </td>
                            <td className="py-2.5 pr-3"><span className="font-mono text-[10px] text-[#6D28D9] bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">{u.uid}</span></td>
                            <td className="py-2.5 pr-3 text-[#6B7280]">{u.country}</td>
                            <td className="py-2.5 pr-3"><span className="text-[10px] font-bold text-[#6D28D9] bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">{u.kycTier}</span></td>
                            <td className="py-2.5 pr-3 text-right font-mono font-bold text-[#171717]">{u.balance.toLocaleString()}</td>
                            <td className="py-2.5 pr-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${banned ? 'bg-slate-800 text-white border-slate-800' : frozen ? 'bg-red-50 text-red-600 border-red-100' : pendingKyc ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-[#16A34A] border-emerald-100'}`}>{u.status}</span>
                            </td>
                            <td className="py-2.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {pendingKyc && (
                                  <button
                                    onClick={() => { setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, status: 'Active', kycTier: x.kycTier === 'Tier 1' ? 'Tier 2' : x.kycTier } : x)); notify(`${u.name} KYC approved`); }}
                                    className="px-2 py-1 rounded-lg bg-purple-50 text-[#6D28D9] text-[10px] font-bold border border-purple-100 cursor-pointer"><BadgeCheck className="w-3 h-3 inline mr-0.5" />KYC</button>
                                )}
                                <button
                                  onClick={() => {
                                    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, status: frozen ? 'Active' : 'Frozen' } : x));
                                    notify(`${u.name} ${frozen ? 'unfrozen' : 'frozen'}`);
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${frozen ? 'bg-emerald-50 text-[#16A34A] border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}
                                >
                                  {frozen ? 'Unfreeze' : 'Freeze'}
                                </button>
                                <button
                                  onClick={() => {
                                    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, status: banned ? 'Active' : 'Banned' } : x));
                                    notify(`${u.name} ${banned ? 'unbanned' : 'banned'}`);
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer items-center gap-1 ${banned ? 'bg-emerald-50 text-[#16A34A] border-emerald-100' : 'bg-slate-100 text-slate-700 border-slate-200'}`}
                                >
                                  <Ban className="w-3 h-3 inline mr-0.5" />{banned ? 'Unban' : 'Ban'}
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.email, u.name)}
                                  disabled={adjustBusy}
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold border border-red-100 bg-red-50 text-red-600 cursor-pointer items-center gap-1 disabled:opacity-60"
                                  title="Delete account permanently"
                                >
                                  <Trash2 className="w-3 h-3 inline mr-0.5" />Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && <p className="text-center text-xs text-[#9CA3AF] py-6">No users match your search.</p>}
                </div>
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Adjust User Balance</h3>
                <p className="text-[10px] text-[#6B7280] mt-2">Add or remove XENA from a registered account's balance. Use a positive amount to credit, or a negative amount to debit.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3">
                  <input value={adjustEmail} onChange={(e) => setAdjustEmail(e.target.value)} placeholder="User email" className="px-3 py-2 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7C3AED] transition-all" />
                  <input value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} type="number" step="any" placeholder="Amount XENA (e.g. 100 or -50)" className="px-3 py-2 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7C3AED] transition-all" />
                  <input value={adjustMemo} onChange={(e) => setAdjustMemo(e.target.value)} placeholder="Reason (optional)" className="px-3 py-2 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7C3AED] transition-all" />
                  <button onClick={handleAdjustBalance} disabled={adjustBusy} className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60">
                    <Banknote className="w-3.5 h-3.5" /> {adjustBusy ? 'Applying...' : 'Apply Adjustment'}
                  </button>
                </div>
                {adjustError && <p className="text-[10px] font-bold text-red-600 mt-2">{adjustError}</p>}
              </div>
            </div>
          )}

          {/* ============ TRANSACTIONS ============ */}
          {section === 'transactions' && (
            <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-[#EDE9FE]">
                <h3 className="text-sm font-bold text-[#171717]">Transaction Monitoring</h3>
                <div className="flex bg-[#F8F7FC] p-0.5 rounded-lg border border-[#EDE9FE] text-[10px] font-bold">
                  {['All', 'Completed', 'Pending', 'Failed'].map((s) => (
                    <button key={s} onClick={() => setTxFilter(s)} className={`px-2.5 py-1 rounded-md cursor-pointer transition-all ${txFilter === s ? 'bg-[#6D28D9] text-white' : 'text-[#6B7280] hover:text-[#171717]'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left text-xs min-w-[560px]">
                  <thead>
                    <tr className="text-[10px] text-[#9CA3AF] uppercase tracking-wide font-bold border-b border-[#EDE9FE]">
                      <th className="py-2 pr-3">User</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3 text-right">Amount</th>
                      <th className="py-2 pr-3">Method</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDE9FE]">
                    {filteredTxs.map((t) => (
                      <tr key={t.id} className="hover:bg-[#F8F7FC]">
                        <td className="py-2.5 pr-3 font-bold text-[#171717]">{t.user}</td>
                        <td className="py-2.5 pr-3 text-[#6B7280]">{t.type}</td>
                        <td className="py-2.5 pr-3 text-right font-mono font-bold text-[#171717]">{t.amount.toLocaleString()} {t.unit}</td>
                        <td className="py-2.5 pr-3 text-[#6B7280]">{t.method}</td>
                        <td className="py-2.5 pr-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TxStatusTone[t.status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>{t.status}</span></td>
                        <td className="py-2.5">
                          {t.status === 'Pending' ? (
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => { setTxs((prev) => prev.map((x) => x.id === t.id ? { ...x, status: 'Completed' } : x)); notify('Withdrawal approved'); }} className="px-2 py-1 rounded-lg bg-emerald-50 text-[#16A34A] text-[10px] font-bold border border-emerald-100 cursor-pointer">Approve</button>
                              <button onClick={() => { setTxs((prev) => prev.map((x) => x.id === t.id ? { ...x, status: 'Failed' } : x)); notify('Withdrawal rejected'); }} className="px-2 py-1 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold border border-red-100 cursor-pointer">Reject</button>
                            </div>
                          ) : (
                            <span className="text-[9px] text-[#9CA3AF]">{t.time}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============ WITHDRAWALS ============ */}
          {section === 'withdrawals' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Awaiting Approval', value: pendingWithdrawals.length, icon: Timer, tone: 'bg-amber-50 text-amber-600' },
                  { label: 'Approved', value: withdrawals.filter((w) => w.status === 'approved').length, icon: Check, tone: 'bg-emerald-50 text-[#16A34A]' },
                  { label: 'Rejected', value: withdrawals.filter((w) => w.status === 'rejected').length, icon: X, tone: 'bg-red-50 text-red-600' },
                  { label: 'Total Requests', value: withdrawals.length, icon: ArrowUpRight, tone: 'bg-purple-50 text-[#7C3AED]' },
                ].map((s) => (
                  <div key={s.label} className="bg-white border border-[#EDE9FE] rounded-2xl p-3.5 shadow-sm">
                    <span className={`w-8 h-8 rounded-lg ${s.tone} flex items-center justify-center`}><s.icon className="w-4 h-4" /></span>
                    <span className="block text-lg font-extrabold text-[#171717] font-mono mt-2">{s.value}</span>
                    <span className="block text-[10px] text-[#6B7280] font-semibold mt-0.5">{s.label}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Withdrawal Queue — Admin Approval Only</h3>
                <p className="text-[10px] text-[#6B7280] mt-2">Approving debits the user's XENA and marks the payout for settlement. No withdrawal is ever paid automatically.</p>
                {wdNotice && <p className="text-[10px] font-bold text-[#6D28D9] bg-purple-50 border border-purple-100 rounded-lg px-2.5 py-1.5 mt-2">{wdNotice}</p>}
                {pendingWithdrawals.length === 0 ? (
                  <p className="text-center text-xs text-[#9CA3AF] py-8">No pending withdrawal requests.</p>
                ) : (
                  <div className="divide-y divide-[#EDE9FE] mt-2">
                    {pendingWithdrawals.map((w) => (
                      <div key={w.id} className="py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#171717">{w.user_name || w.email}</span>
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Pending</span>
                        </div>
                        <span className="block text-[10px] text-[#6B7280] mt-0.5">
                          <b className="text-[#6D28D9]">{Number(w.amount_xena || 0)} XENA</b> → {w.method === 'ngn' ? `NGN ${Number(w.amount_ngn || 0).toLocaleString()} · ${w.bank || ''} ${w.account_number || ''}` : `${String(w.method || '').toUpperCase()} ${w.address || ''}`}
                        </span>
                        <span className="block text-[9px] text-[#9CA3AF] mt-0.5">Ref {w.reference}</span>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <input
                            value={wdNotes[w.id] || ''}
                            onChange={(e) => setWdNotes((prev) => ({ ...prev, [w.id]: e.target.value }))}
                            placeholder="Note / memo (optional)"
                            className="flex-1 min-w-[160px] px-3 py-2 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7C3AED] transition-all"
                          />
                          <button onClick={() => handleDecideWithdrawal(w.id, 'approved')} disabled={wdBusy} className="px-2.5 py-2 rounded-lg bg-emerald-50 text-[#16A34A] text-[10px] font-bold border border-emerald-100 cursor-pointer disabled:opacity-60"><Check className="w-3 h-3 inline mr-0.5" />Approve</button>
                          <button onClick={() => handleDecideWithdrawal(w.id, 'rejected')} disabled={wdBusy} className="px-2.5 py-2 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold border border-red-100 cursor-pointer disabled:opacity-60"><X className="w-3 h-3 inline mr-0.5" />Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Withdrawal History</h3>
                {withdrawals.filter((w) => w.status !== 'pending').length === 0 ? (
                  <p className="text-center text-xs text-[#9CA3AF] py-6">No decided withdrawals yet.</p>
                ) : (
                  <div className="divide-y divide-[#EDE9FE] mt-2">
                    {withdrawals.filter((w) => w.status !== 'pending').map((w) => (
                      <div key={w.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="block text-xs font-bold text-[#171717]">{w.user_name || w.email}</span>
                          <span className="block text-[10px] text-[#6B7280]">{Number(w.amount_xena || 0)} XENA · {w.method === 'ngn' ? 'NGN Bank' : String(w.method || '').toUpperCase()} · {w.reference}</span>
                          {w.admin_note && <span className="block text-[9px] text-[#9CA3AF]">Note: {w.admin_note}</span>}
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${w.status === 'approved' ? 'bg-emerald-50 text-[#16A34A] border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                          {w.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ DEPOSITS ============ */}
          {section === 'deposits' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Deposited', value: `$${totalDepositedUsd.toLocaleString()}`, icon: Banknote, tone: 'bg-emerald-50 text-emerald-600' },
                  { label: 'Deposits (30d)', value: deposits.length, icon: ArrowDownRight, tone: 'bg-sky-50 text-sky-600' },
                  { label: 'Awaiting Approval', value: pendingDepositCount, icon: Timer, tone: 'bg-amber-50 text-amber-600' },
                  { label: 'Avg Deposit', value: `$${deposits.length ? Math.round(totalDepositedUsd / deposits.length).toLocaleString() : 0}`, icon: TrendingUp, tone: 'bg-purple-50 text-[#7C3AED]' },
                ].map((s) => (
                  <div key={s.label} className="bg-white border border-[#EDE9FE] rounded-2xl p-3.5 shadow-sm">
                    <span className={`w-8 h-8 rounded-lg ${s.tone} flex items-center justify-center`}><s.icon className="w-4 h-4" /></span>
                    <span className="block text-lg font-extrabold text-[#171717] font-mono mt-2">{s.value}</span>
                    <span className="block text-[10px] text-[#6B7280] font-semibold mt-0.5">{s.label}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EDE9FE]">
                  <h3 className="text-sm font-bold text-[#171717]">Deposit Ledger — All Money Deposited</h3>
                  <div className="flex bg-[#F8F7FC] p-0.5 rounded-lg border border-[#EDE9FE] text-[10px] font-bold">
                    {['All', 'Completed', 'Pending'].map((s) => (
                      <button key={s} onClick={() => setDepositFilter(s)} className={`px-2.5 py-1 rounded-md cursor-pointer transition-all ${depositFilter === s ? 'bg-[#6D28D9] text-white' : 'text-[#6B7280] hover:text-[#171717]'}`}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[560px]">
                    <thead>
                      <tr className="text-[10px] text-[#9CA3AF] uppercase tracking-wide font-bold border-b border-[#EDE9FE]">
                        <th className="py-2 pr-3">User</th>
                        <th className="py-2 pr-3">Method</th>
                        <th className="py-2 pr-3 text-right">Amount (USD)</th>
                        <th className="py-2 pr-3 text-right">XENA</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDE9FE]">
                      {filteredDeposits.map((d) => {
                        const matchedRef = referralOverview.find((r) => registeredUsers.some((ru) => ru.email.toLowerCase() === d.email.toLowerCase() && ru.referrer.toUpperCase() === r.refCode.toUpperCase()));
                        return (
                          <tr key={d.id} className="hover:bg-[#F8F7FC]">
                            <td className="py-2.5 pr-3">
                              <span className="block font-bold text-[#171717]">{d.user}</span>
                              <span className="block text-[10px] text-[#6B7280]">{d.email}</span>
                            </td>
                            <td className="py-2.5 pr-3 text-[#6B7280]">{d.method}</td>
                            <td className="py-2.5 pr-3 text-right font-mono font-bold text-[#171717]">${d.amount.toLocaleString()}</td>
                            <td className="py-2.5 pr-3 text-right font-mono text-[#6D28D9]">{d.xena.toLocaleString()}</td>
                            <td className="py-2.5 pr-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${d.status === 'Completed' ? 'bg-emerald-50 text-[#16A34A] border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{d.status}</span></td>
                            <td className="py-2.5 text-right whitespace-nowrap">
                              {d.status === 'Pending' ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setDeposits((prev) => prev.map((x) => x.id === d.id ? { ...x, status: 'Completed' } : x));
                                      if (matchedRef) {
                                        setBonusLog((prev) => [{ id: `b-${Date.now()}`, code: matchedRef.refCode, name: matchedRef.name, xena: 100, time: 'Just now' }, ...prev]);
                                        notify(`${d.user} deposited — +100 XENA bonus auto-approved to ${matchedRef.name}'s referral`);
                                      } else {
                                        notify('Deposit approved');
                                      }
                                    }}
                                    className="px-2 py-1 rounded-lg bg-emerald-50 text-[#16A34A] text-[10px] font-bold border border-emerald-100 cursor-pointer">Approve</button>
                                </div>
                              ) : (
                                <span className="text-[9px] text-[#9CA3AF]">{d.time}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Live Payment Ledger (Paystack / NOWPayments)</h3>
                <p className="text-[10px] text-[#6B7280] mt-2">Deposits credited automatically when confirmed. Webhook + verify both idempotent.</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[640px]">
                    <thead>
                      <tr className="text-[10px] text-[#9CA3AF] uppercase tracking-wide font-bold border-b border-[#EDE9FE]">
                        <th className="py-2 pr-3">Email</th>
                        <th className="py-2 pr-3">Provider</th>
                        <th className="py-2 pr-3 text-right">Amount</th>
                        <th className="py-2 pr-3 text-right">XENA</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Reference</th>
                        <th className="py-2">When</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDE9FE]">
                      {payments.slice(0, 40).map((p) => (
                        <tr key={p.id} className="hover:bg-[#F8F7FC]">
                          <td className="py-2.5 pr-3 font-bold text-[#171717]">{p.email || '—'}</td>
                          <td className="py-2.5 pr-3">
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-[#F8F7FC] text-[#6B7280] border-[#EDE9FE]">{String(p.provider || '').toUpperCase()}</span>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono font-bold text-[#171717]">{Number(p.amount || 0).toLocaleString()} {p.currency || 'USD'}</td>
                          <td className="py-2.5 pr-3 text-right font-mono text-[#6D28D9]">{Number(p.xena || 0)}</td>
                          <td className="py-2.5 pr-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              p.status === 'confirmed' ? 'bg-emerald-50 text-[#16A34A] border-emerald-100'
                              : p.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100'
                              : 'bg-red-50 text-red-600 border-red-100'}`}>
                              {String(p.status || 'pending').toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-[10px] text-[#9CA3AF] font-mono max-w-[140px] truncate">{p.reference}</td>
                          <td className="py-2.5 text-[10px] text-[#6B7280] whitespace-nowrap">{p.created_at ? new Date(p.created_at).toLocaleString() : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {payments.length === 0 && <p className="text-center text-xs text-[#9CA3AF] py-6">No live payments yet.</p>}
                </div>
              </div>

              {bonusLog.length > 0 && (
                <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE] flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-[#16A34A]" /> Auto-Approved Referral Bonuses</h3>
                  <div className="divide-y divide-[#EDE9FE]">
                    {bonusLog.map((b) => (
                      <div key={b.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <span className="font-bold text-[#171717] block">+{b.xena} XENA → {b.name}</span>
                          <span className="text-[10px] text-[#6B7280] block">Referral code {b.code}</span>
                        </div>
                        <span className="text-[9px] font-bold text-[#16A34A] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Approved · {b.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============ REFERRALS ============ */}
          {section === 'referrals' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-[#1E1B4B] via-[#7C3AED] to-[#DB2777] rounded-2xl p-4 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold flex items-center gap-2"><Gift className="w-4 h-4" /> Referral Program</h3>
                    <p className="text-[10px] text-purple-100 mt-0.5">Each referred person who deposits = <b className="text-amber-300">+100 XENA bonus</b>, auto-approved instantly.</p>
                  </div>
                  <span className="text-[10px] font-bold bg-white/15 border border-white/25 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"><Gem className="w-3.5 h-3.5" /> Earned this month: <span className="font-mono font-extrabold">{referralBonusTotal} XENA</span></span>
                </div>
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Referral Activity</h3>
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-left text-xs min-w-[560px]">
                    <thead>
                      <tr className="text-[10px] text-[#9CA3AF] uppercase tracking-wide font-bold border-b border-[#EDE9FE]">
                        <th className="py-2 pr-3">Referrer</th>
                        <th className="py-2 pr-3">Ref Code</th>
                        <th className="py-2 pr-3 text-right">Referred</th>
                        <th className="py-2 pr-3 text-right">Deposited</th>
                        <th className="py-2 pr-3 text-right">Bonus (XENA)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDE9FE]">
                      {referralOverview.map((r) => (
                        <tr key={r.id} className="hover:bg-[#F8F7FC]">
                          <td className="py-2.5 pr-3 font-bold text-[#171717]">{r.name}</td>
                          <td className="py-2.5 pr-3"><span className="font-mono text-[10px] font-bold text-[#6D28D9] bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">{r.refCode}</span></td>
                          <td className="py-2.5 pr-3 text-right"><span className="text-[10px] font-bold bg-[#F8F7FC] px-2 py-0.5 rounded-full border border-[#EDE9FE]">{r.count + r.newCount}</span></td>
                          <td className="py-2.5 pr-3 text-right font-bold text-[#171717]">{r.depositedCount}</td>
                          <td className="py-2.5 pr-3 text-right"><span className="text-[10px] font-bold text-[#16A34A] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">+{r.earnedXena}</span></td>
                        </tr>
                      ))}
                      {referredRegistrations.length === 0 && (
                        <tr><td colSpan={5} className="py-6 text-center text-[#9CA3AF] text-xs">No active referrals yet. Share referral codes to start earning 100 XENA per verified deposit.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {referredRegistrations.length > 0 && (
                <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE] flex items-center gap-2"><UserPlus className="w-4 h-4 text-[#7C3AED]" /> People Referred ({referredRegistrations.length})</h3>
                  <div className="divide-y divide-[#EDE9FE]">
                    {referredRegistrations.map((ru, i) => {
                      const deposited = deposits.some((d) => d.email.toLowerCase() === ru.email.toLowerCase());
                      return (
                        <div key={i} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <span className="font-bold text-[#171717] block">{ru.name}</span>
                            <span className="text-[10px] text-[#6B7280] block">{ru.email}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] font-bold text-[#6D28D9] bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100 font-mono">{ru.referrer}</span>
                            {deposited ? <span className="text-[9px] font-bold text-[#16A34A] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1"><Check className="w-3 h-3" /> Deposited · +100 XENA</span> : <span className="text-[9px] text-[#9CA3AF]">No deposit yet</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============ P2P ============ */}
          {section === 'p2p' && (
            <div className="space-y-4">
              {/* P2P Listing Approvals */}
              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Coin Listing Approvals</h3>
                <p className="text-[10px] text-[#6B7280] mt-2">New P2P ads only appear on the marketplace after you approve them.</p>
                <div className="divide-y divide-[#EDE9FE] mt-2">
                  {p2pOffers.filter((o) => o.status === 'pending').map((o) => (
                    <div key={o.id} className="py-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[#171717]">{o.merchantName} — {o.type || 'BUY'}</span>
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Pending</span>
                      </div>
                      <span className="block text-[10px] text-[#6B7280] mt-0.5">
                        {o.availableXena} XENA @ ${o.pricePerXena} · {String(o.listedBy || '').toLowerCase()} · {o.minLimit}–{o.maxLimit}
                      </span>
                      <div className="flex items-center gap-1.5 mt-2">
                        <button onClick={() => { onApproveP2POffer(o.id); notify(`${o.merchantName} listing approved`); }} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[#16A34A] text-[10px] font-bold border border-emerald-100 cursor-pointer"><Check className="w-3 h-3 inline mr-0.5" />Approve Listing</button>
                        <button onClick={() => { onRejectP2POffer(o.id); notify(`${o.merchantName} listing rejected`); }} className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold border border-red-100 cursor-pointer"><X className="w-3 h-3 inline mr-0.5" />Reject</button>
                      </div>
                    </div>
                  ))}
                  {p2pOffers.filter((o) => o.status === 'pending').length === 0 && (
                    <p className="text-center text-xs text-[#9CA3AF] py-4">No listings awaiting approval.</p>
                  )}
                </div>
              </div>

              {/* P2P Payment Validations */}
              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Payment Validation</h3>
                <p className="text-[10px] text-[#6B7280] mt-2">Validate buyer settlements to release XENA to their balances.</p>
                <div className="divide-y divide-[#EDE9FE] mt-2">
                  {p2pTrades.filter((t) => t.status === 'awaiting_validation').map((t) => (
                    <div key={t.id} className="py-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[#171717]">{t.merchantName} — {String(t.buyerEmail || '').toLowerCase()}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${t.status === 'awaiting_validation' ? 'bg-amber-50 text-amber-600 border-amber-100' : t.status === 'approved' ? 'bg-emerald-50 text-[#16A34A] border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                          {t.status === 'awaiting_validation' ? 'Awaiting Validation' : t.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                      </div>
                      <span className="block text-[10px] text-[#6B7280] mt-0.5">
                        ${t.fiatAmount.toLocaleString()} via {t.method} → <strong className="text-[#6D28D9]">{t.xenaAmount} XENA</strong> @ ${t.pricePerXena}
                      </span>
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          onClick={() => { onApproveP2PPayment(t.id); notify('Payment validated — XENA released'); }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[#16A34A] text-[10px] font-bold border border-emerald-100 cursor-pointer"
                        >
                          <Check className="w-3 h-3 inline mr-0.5" />Validate & Release
                        </button>
                        <button onClick={() => { onRejectP2PPayment(t.id); notify('Payment rejected'); }} className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold border border-red-100 cursor-pointer"><X className="w-3 h-3 inline mr-0.5" />Reject</button>
                      </div>
                    </div>
                  ))}
                  {p2pTrades.filter((t) => t.status === 'awaiting_validation').length === 0 && (
                    <p className="text-center text-xs text-[#9CA3AF] py-4">No payments awaiting validation.</p>
                  )}
                </div>
              </div>

              {/* Live Listings — admin can reorder the marketplace (top/bottom) */}
              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Live Listings &amp; Positioning</h3>
                <p className="text-[10px] text-[#6B7280] mt-2">Approved ads appear in marketplace order. Move any listing up to the top or down toward the bottom.</p>
                <div className="divide-y divide-[#EDE9FE] mt-2">
                  {p2pOffers.filter((o) => o.status === 'approved').map((o, i, arr) => (
                    <div key={o.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-[#171717]">#{i + 1} {o.merchantName} — {o.type || 'SELL'}</span>
                        <span className="block text-[10px] text-[#6B7280]">{Number(o.availableXena || 0)} XENA @ ${o.pricePerXena} · {Number(o.minLimit || 0)}–{Number(o.maxLimit || 0)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={async () => {
                            if (!onMoveP2POffer) return;
                            const res = await onMoveP2POffer(o.id, 'up');
                            notify(res.ok ? 'Listing moved up' : (res.error || 'Move failed'));
                          }}
                          disabled={i === 0 || !onMoveP2POffer}
                          className="px-2.5 py-1 rounded-lg bg-purple-50 text-[#6D28D9] text-[10px] font-bold border border-purple-100 cursor-pointer disabled:opacity-40"
                        >
                          <ArrowUpRight className="w-3 h-3 inline mr-0.5" />Move Up
                        </button>
                        <button
                          onClick={async () => {
                            if (!onMoveP2POffer) return;
                            const res = await onMoveP2POffer(o.id, 'down');
                            notify(res.ok ? 'Listing moved down' : (res.error || 'Move failed'));
                          }}
                          disabled={i === arr.length - 1 || !onMoveP2POffer}
                          className="px-2.5 py-1 rounded-lg bg-purple-50 text-[#6D28D9] text-[10px] font-bold border border-purple-100 cursor-pointer disabled:opacity-40"
                        >
                          <ArrowDownRight className="w-3 h-3 inline mr-0.5" />Move Down
                        </button>
                      </div>
                    </div>
                  ))}
                  {p2pOffers.filter((o) => o.status === 'approved').length === 0 && (
                    <p className="text-center text-xs text-[#9CA3AF] py-4">No approved listings yet.</p>
                  )}
                </div>
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Merchant Verification</h3>
                <div className="divide-y divide-[#EDE9FE]">
                  {merchants.map((m) => (
                    <div key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-[#171717]">{m.name}</span>
                        <span className="block text-[10px] text-[#6B7280]">{m.owner} · {m.orders.toLocaleString()} orders · {m.rating}%</span>
                      </div>
                      <button
                        onClick={() => { setMerchants((prev) => prev.map((x) => x.id === m.id ? { ...x, verified: !x.verified } : x)); notify(`${m.name} ${m.verified ? 'unverified' : 'verified'}`); }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer shrink-0 ${m.verified ? 'bg-emerald-50 text-[#16A34A] border-emerald-100' : 'bg-[#F8F7FC] text-[#6B7280] border-[#EDE9FE]'}`}
                      >
                        {m.verified ? <><Check className="w-3 h-3 inline mr-1" />Verified</> : <><EyeOff className="w-3 h-3 inline mr-1" />Unverified</>}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Escrow Disputes</h3>
                <div className="divide-y divide-[#EDE9FE]">
                  {disputes.map((d) => (
                    <div key={d.id} className="py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#171717]">{d.offer} · {d.amount.toLocaleString()} XENA</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${d.status === 'Escalated' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{d.status}</span>
                      </div>
                      <span className="block text-[10px] text-[#6B7280] mt-0.5">Buyer {d.buyer} vs Seller {d.seller} — {d.reason}</span>
                      <div className="flex items-center gap-1.5 mt-2">
                        <button onClick={() => { setDisputes((prev) => prev.filter((x) => x.id !== d.id)); notify('Resolved in favor of buyer'); }} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[#16A34A] text-[10px] font-bold border border-emerald-100 cursor-pointer">For Buyer</button>
                        <button onClick={() => { setDisputes((prev) => prev.filter((x) => x.id !== d.id)); notify('Resolved in favor of seller'); }} className="px-2.5 py-1 rounded-lg bg-purple-50 text-[#6D28D9] text-[10px] font-bold border border-purple-100 cursor-pointer">For Seller</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============ INVESTMENTS ============ */}
          {section === 'investments' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { l: 'Total Staked', v: `${allInvestments.reduce((s, i) => s + Number(i.invested_xena || 0), 0).toLocaleString()} XENA` },
                  { l: 'Active Vaults', v: allInvestments.filter((i) => i.status === 'active').length.toLocaleString() },
                  { l: 'Matured', v: allInvestments.filter((i) => i.status === 'matured').length.toLocaleString() },
                  { l: 'Accrued Yield', v: `${allInvestments.reduce((s, i) => s + Number(i.earned_xena || 0), 0).toFixed(2)} XENA` },
                ].map((s) => (
                  <div key={s.l} className="bg-white border border-[#EDE9FE] rounded-2xl p-3.5 shadow-sm">
                    <span className="block text-lg font-extrabold text-[#171717] font-mono">{s.v}</span>
                    <span className="block text-[10px] text-[#6B7280] font-semibold mt-0.5">{s.l}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EDE9FE]">
                  <h3 className="text-sm font-bold text-[#171717]">Active Investments — User Control</h3>
                  <button
                    onClick={async () => {
                      if (!onPayoutAllVaults) return;
                      if (!window.confirm('Pay out all matured vaults now?')) return;
                      const res = await onPayoutAllVaults();
                      notify(res.ok ? `Payout run processed ${res.processed ?? 0} vaults` : (res.error || 'Payout failed'));
                    }}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white text-[10px] font-bold cursor-pointer"
                  >
                    Run Manual Payout (All Matured)
                  </button>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[760px]">
                    <thead>
                      <tr className="text-[10px] text-[#9CA3AF] uppercase tracking-wide font-bold border-b border-[#EDE9FE]">
                        <th className="py-2 pr-3">User</th>
                        <th className="py-2 pr-3">Vault</th>
                        <th className="py-2 pr-3 text-right">Invested</th>
                        <th className="py-2 pr-3 text-right">Earned</th>
                        <th className="py-2 pr-3">Progress</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDE9FE]">
                      {allInvestments.map((i) => (
                        <tr key={i.id} className="hover:bg-[#F8F7FC]">
                          <td className="py-2.5 pr-3">
                            <span className="block font-bold text-[#171717]">{i.user_name || i.email}</span>
                            <span className="block text-[10px] text-[#6B7280]">{i.email}</span>
                          </td>
                          <td className="py-2.5 pr-3 text-[#6B7280]">{i.plan_name}</td>
                          <td className="py-2.5 pr-3 text-right font-mono font-bold text-[#171717]">{Number(i.invested_xena || 0)}</td>
                          <td className="py-2.5 pr-3 text-right font-mono font-bold text-[#16A34A]">{Number(i.earned_xena || 0).toFixed(2)}</td>
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 bg-[#EDE9FE] rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-[#7C3AED] to-[#A855F7] rounded-full" style={{ width: `${Math.min(100, Number(i.progress_percent || 0))}%` }} />
                              </div>
                              <span className="text-[9px] text-[#6B7280]">{Number(i.progress_percent || 0)}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                              i.status === 'active' ? 'bg-emerald-50 text-[#16A34A] border-emerald-100'
                              : i.status === 'matured' ? 'bg-sky-50 text-sky-600 border-sky-100'
                              : 'bg-red-50 text-red-600 border-red-100'}`}>
                              {String(i.status).toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {i.status !== 'active' && i.status !== 'canceled' && (
                                <button onClick={async () => { if (onRestartInvestment) { const r = await onRestartInvestment(i.id); notify(r.ok ? 'Vault restarted (fresh term)' : (r.error || 'Failed')); } }} className="px-2 py-1 rounded-lg bg-purple-50 text-[#6D28D9] text-[10px] font-bold border border-purple-100 cursor-pointer"><PlayCircle className="w-3 h-3 inline mr-0.5" />Restart</button>
                              )}
                              {i.status === 'active' && (
                                <>
                                  <button onClick={async () => { if (!onCancelInvestment || !window.confirm('Cancel this vault? Principal returns, yield forfeits.')) return; const r = await onCancelInvestment(i.id); notify(r.ok ? 'Vault cancelled — principal refunded' : (r.error || 'Failed')); }} className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-bold border border-amber-100 cursor-pointer"><PauseCircle className="w-3 h-3 inline mr-0.5" />Cancel</button>
                                  <button onClick={async () => { if (!onPayoutInvestment || !window.confirm('Pay out this vault now (principal + yield)?')) return; const r = await onPayoutInvestment(i.id); notify(r.ok ? 'Vault paid out' : (r.error || 'Failed')); }} className="px-2 py-1 rounded-lg bg-emerald-50 text-[#16A34A] text-[10px] font-bold border border-emerald-100 cursor-pointer"><Banknote className="w-3 h-3 inline mr-0.5" />Payout</button>
                                </>
                              )}
                              {i.status === 'canceled' && <span className="text-[9px] text-[#9CA3AF]">Cancelled</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {allInvestments.length === 0 && <p className="text-center text-xs text-[#9CA3AF] py-6">No investments yet.</p>}
                </div>
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Vault Catalog (shapes staking page)</h3>
                <p className="text-[10px] text-[#6B7280] mt-2">minDeposit is staked as XENA. Changes go live on every user's staking page instantly.</p>
                <div className="divide-y divide-[#EDE9FE] mt-2">
                  {vaultCatalog.map((v) => (
                    <div key={v.id} className="py-2.5">
                      {vaultEditorId === v.id ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <input value={vaultDraft.name || ''} onChange={(e) => setVaultDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Name" className="px-2 py-1.5 bg-[#F8F7FC] border border-[#EDE9FE] rounded-lg text-[11px] font-semibold" />
                          <input value={vaultDraft.apy ?? ''} onChange={(e) => setVaultDraft((prev) => ({ ...prev, apy: e.target.value }))} type="number" step="any" placeholder="APY %" className="px-2 py-1.5 bg-[#F8F7FC] border border-[#EDE9FE] rounded-lg text-[11px] font-semibold" />
                          <input value={vaultDraft.minDeposit ?? ''} onChange={(e) => setVaultDraft((prev) => ({ ...prev, minDeposit: e.target.value }))} type="number" step="any" placeholder="minDeposit (XENA)" className="px-2 py-1.5 bg-[#F8F7FC] border border-[#EDE9FE] rounded-lg text-[11px] font-semibold" />
                          <input value={vaultDraft.days ?? ''} onChange={(e) => setVaultDraft((prev) => ({ ...prev, days: e.target.value }))} type="number" placeholder="Days" className="px-2 py-1.5 bg-[#F8F7FC] border border-[#EDE9FE] rounded-lg text-[11px] font-semibold" />
                          <div className="flex items-center gap-1.5 col-span-2 sm:col-span-4">
                            <button
                              onClick={async () => {
                                if (!onUpdateVault) return;
                                const res = await onUpdateVault(v.id, {
                                  name: vaultDraft.name,
                                  apy: parseFloat(vaultDraft.apy),
                                  minDeposit: parseFloat(vaultDraft.minDeposit),
                                  days: parseInt(vaultDraft.days, 10),
                                  active: v.active !== false,
                                });
                                notify(res.ok ? 'Vault updated — live now' : (res.error || 'Failed'));
                                setVaultEditorId(null);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-[#16A34A] text-[10px] font-bold border border-emerald-100 cursor-pointer"
                            >
                              Save
                            </button>
                            <button onClick={() => setVaultEditorId(null)} className="px-2.5 py-1.5 rounded-lg bg-[#F8F7FC] text-[#6B7280] text-[10px] font-bold border border-[#EDE9FE] cursor-pointer">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-[#171717]">{v.name} <span className="text-[9px] font-bold text-[#6D28D9] bg-purple-50 px-1.5 py-0.5 rounded-full">{v.apy}% APY</span> <span className="text-[9px] text-[#6B7280]">min {v.min_deposit ?? v.minDeposit} XENA · {v.days ?? 0}d</span></span>
                            <span className="block text-[10px] text-[#6B7280]">{v.category || 'Flexible'} · {v.risk || 'Low Risk'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={async () => {
                                if (!onUpdateVault) return;
                                const res = await onUpdateVault(v.id, { active: v.active !== false ? false : true });
                                notify(res.ok ? (v.active !== false ? 'Vault hidden' : 'Vault visible') : (res.error || 'Failed'));
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${v.active !== false ? 'bg-emerald-50 text-[#16A34A] border-emerald-100' : 'bg-[#F8F7FC] text-[#6B7280] border-[#EDE9FE]'}`}
                            >
                              {v.active !== false ? 'Active' : 'Hidden'}
                            </button>
                            <button onClick={() => { setVaultEditorId(v.id); setVaultDraft({ name: v.name, apy: v.apy, minDeposit: v.min_deposit ?? v.minDeposit, days: v.days ?? 0 }); }} className="px-2.5 py-1 rounded-lg bg-[#F8F7FC] text-[#6B7280] text-[10px] font-bold border border-[#EDE9FE] cursor-pointer">Edit</button>
                            <button
                              onClick={async () => {
                                if (!onDeleteVault || !window.confirm('Delete this vault package?')) return;
                                const res = await onDeleteVault(v.id);
                                notify(res.ok ? 'Vault deleted' : (res.error || 'Failed'));
                              }}
                              className="px-2 py-1 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold border border-red-100 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#EDE9FE]">
                  <button onClick={() => setShowAddVault(!showAddVault)} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"><Plus className="w-3 h-3" /> Add Vault</button>
                </div>
                {showAddVault && (
                  <div className="mt-3 p-3 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <input value={vaultDraft.name || ''} onChange={(e) => setVaultDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Name" className="w-full px-2 py-1.5 bg-white border border-[#EDE9FE] rounded-lg text-[11px] font-semibold" />
                    <input value={vaultDraft.category || ''} onChange={(e) => setVaultDraft((prev) => ({ ...prev, category: e.target.value }))} placeholder="Category (e.g. Fixed Term)" className="w-full px-2 py-1.5 bg-white border border-[#EDE9FE] rounded-lg text-[11px] font-semibold" />
                    <input value={vaultDraft.apy ?? ''} onChange={(e) => setVaultDraft((prev) => ({ ...prev, apy: e.target.value }))} type="number" step="any" placeholder="APY %" className="w-full px-2 py-1.5 bg-white border border-[#EDE9FE] rounded-lg text-[11px] font-semibold" />
                    <input value={vaultDraft.minDeposit ?? ''} onChange={(e) => setVaultDraft((prev) => ({ ...prev, minDeposit: e.target.value }))} type="number" step="any" placeholder="minDeposit XENA" className="w-full px-2 py-1.5 bg-white border border-[#EDE9FE] rounded-lg text-[11px] font-semibold" />
                    <input value={vaultDraft.days ?? ''} onChange={(e) => setVaultDraft((prev) => ({ ...prev, days: e.target.value }))} type="number" placeholder="Days" className="w-full px-2 py-1.5 bg-white border border-[#EDE9FE] rounded-lg text-[11px] font-semibold" />
                    <button
                      onClick={async () => {
                        if (!onAddVault || !vaultDraft.name) return;
                        const res = await onAddVault({
                          name: vaultDraft.name,
                          category: vaultDraft.category || 'Flexible',
                          apy: parseFloat(vaultDraft.apy || '0'),
                          minDeposit: parseFloat(vaultDraft.minDeposit || '1'),
                          days: parseInt(vaultDraft.days || '0', 10),
                          badge: vaultDraft.badge || '',
                          risk: 'Low Risk',
                          active: true,
                        });
                        notify(res.ok ? 'Vault added' : (res.error || 'Failed'));
                        if (res.ok) setShowAddVault(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-50 text-[#6D28D9] text-[10px] font-bold border border-purple-100 cursor-pointer"
                    >
                      Create
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ ANNOUNCEMENTS ============ */}
          {section === 'announcements' && (
            <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-[#EDE9FE]">
                <h3 className="text-sm font-bold text-[#171717]">Announcements &amp; News</h3>
                <button onClick={() => setShowNewAnn(!showNewAnn)} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"><Plus className="w-3 h-3" /> New</button>
              </div>

              {showNewAnn && (
                <div className="mt-3 p-3 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl space-y-2">
                  <input value={newAnnTitle} onChange={(e) => setNewAnnTitle(e.target.value)} placeholder="Announcement title" className="w-full px-3 py-2 bg-white border border-[#EDE9FE] rounded-lg text-xs font-semibold focus:outline-none focus:border-[#7C3AED]" />
                  <div className="flex gap-2">
                    <input value={newAnnTag} onChange={(e) => setNewAnnTag(e.target.value)} placeholder="Tag (e.g. Promotion)" className="w-1/3 px-3 py-2 bg-white border border-[#EDE9FE] rounded-lg text-xs font-semibold focus:outline-none focus:border-[#7C3AED]" />
                    <input value={newAnnSummary} onChange={(e) => setNewAnnSummary(e.target.value)} placeholder="Summary" className="flex-1 px-3 py-2 bg-white border border-[#EDE9FE] rounded-lg text-xs font-semibold focus:outline-none focus:border-[#7C3AED]" />
                  </div>
                  <button
                    onClick={() => {
                      if (!newAnnTitle.trim()) return;
                      const next = [{ id: `ann-${Date.now()}`, title: newAnnTitle, date: 'Just now', tag: newAnnTag || 'Update', tagColor: 'bg-purple-50 text-[#6D28D9] border-purple-100', summary: newAnnSummary || 'New announcement published.', actionText: 'Read More' }, ...announcements];
                      setAnnouncements(next);
                      replaceAnnouncements(next).catch(() => {});
                      setNewAnnTitle(''); setNewAnnTag(''); setNewAnnSummary(''); setShowNewAnn(false);
                      notify('Announcement published');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#6D28D9] text-white text-[10px] font-bold cursor-pointer"
                  >
                    Publish
                  </button>
                </div>
              )}

              <div className="divide-y divide-[#EDE9FE] mt-2">
                {announcements.map((ann) => (
                  <div key={ann.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${ann.tagColor || 'bg-purple-50 text-[#6D28D9] border-purple-100'}`}>{ann.tag || 'Update'}</span>
                        <span className="text-[9px] text-[#9CA3AF]">{ann.date}</span>
                      </div>
                      <span className="block text-xs font-bold text-[#171717] mt-1">{ann.title}</span>
                      <span className="block text-[10px] text-[#6B7280] mt-0.5 line-clamp-1">{ann.summary}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => { const next = announcements.map((x) => x.id === ann.id ? { ...x, publishedAt: Date.now(), tagColor: ann.tagColor || 'bg-purple-50 text-[#6D28D9] border-purple-100' } : x); setAnnouncements(next); replaceAnnouncements(next).catch(() => {}); notify('Updated'); }} className="px-2 py-1 rounded-lg bg-[#F8F7FC] text-[#6B7280] text-[10px] font-bold border border-[#EDE9FE] cursor-pointer">Edit</button>
                      <button onClick={() => { const next = announcements.filter((x) => x.id !== ann.id); setAnnouncements(next); replaceAnnouncements(next).catch(() => {}); notify('Announcement deleted'); }} className="px-2 py-1 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold border border-red-100 cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============ SUPPORT ============ */}
          {section === 'support' && (
            <div className="space-y-4">
              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EDE9FE]">
                  <div className="flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-[#7C3AED]" />
                    <h3 className="text-sm font-bold text-[#171717]">Support Conversations</h3>
                    <span className="text-[10px] font-bold text-[#6D28D9] bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">{conversations.filter((c) => c.status === 'open').length} open</span>
                  </div>
                  <button onClick={loadConversations} className="px-2.5 py-1.5 rounded-lg bg-[#F8F7FC] text-[#6D28D9] text-[10px] font-bold border border-[#EDE9FE] flex items-center gap-1 cursor-pointer"><RotateCcw className="w-3 h-3" /> Refresh</button>
                </div>
                {convNotice && <p className="text-[10px] font-bold text-[#6D28D9] bg-purple-50 border border-purple-100 rounded-lg px-2.5 py-1.5 mt-2">{convNotice}</p>}
                {conversations.length === 0 ? (
                  <p className="text-center text-xs text-[#9CA3AF] py-8">No support conversations yet. Messages users send from their dashboard appear here.</p>
                ) : (
                  <div className="divide-y divide-[#EDE9FE] mt-2">
                    {conversations.map((c) => {
                      const lastMsg = c.messages[c.messages.length - 1];
                      return (
                        <div key={c.id} className="py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-bold text-[#171717]">{c.userName || c.email.split('@')[0]}</span>
                              <span className="text-[10px] text-[#6B7280]">{c.email}</span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${c.status === 'resolved' ? 'bg-emerald-50 text-[#16A34A] border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{c.status === 'resolved' ? 'Resolved' : 'Open'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {c.status === 'resolved' ? (
                                <button onClick={() => handleResolveConversation(c.id, 'open')} className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-bold border border-amber-100 cursor-pointer">Reopen</button>
                              ) : (
                                <button onClick={() => handleResolveConversation(c.id, 'resolved')} className="px-2 py-1 rounded-lg bg-emerald-50 text-[#16A34A] text-[10px] font-bold border border-emerald-100 flex items-center gap-1 cursor-pointer"><Check className="w-3 h-3" /> Resolve</button>
                              )}
                            </div>
                          </div>
                          <div className="bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl p-2.5 mt-2 max-h-48 overflow-y-auto space-y-1.5">
                            {c.messages.length === 0 && <p className="text-[10px] text-[#9CA3AF]">No messages yet.</p>}
                            {c.messages.map((m, i) => (
                              <div key={i} className={`flex ${m.from === 'agent' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] px-2.5 py-1.5 rounded-xl text-[11px] ${m.from === 'agent' ? 'bg-[#7C3AED] text-white rounded-br-sm' : 'bg-white border border-[#EDE9FE] text-[#171717] rounded-bl-sm'}`}>
                                  {m.from === 'agent' && <span className="block text-[8px] font-bold uppercase tracking-wide opacity-70 mb-0.5">XENA Support</span>}
                                  <span className="block">{m.text}</span>
                                  <span className={`block text-[8px] mt-0.5 ${m.from === 'agent' ? 'text-white/70' : 'text-[#9CA3AF]'}`}>{m.time}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              value={convReplies[c.id] || ''}
                              onChange={(e) => setConvReplies((prev) => ({ ...prev, [c.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleReplyConversation(c.id, c.email); }}
                              placeholder="Type a reply for this user..."
                              className="flex-1 px-3 py-2 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7C3AED] transition-all"
                            />
                            <button onClick={() => handleReplyConversation(c.id, c.email)} disabled={convBusy} className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
                              <Send className="w-3.5 h-3.5" /> Reply
                            </button>
                          </div>
                          <p className="text-[9px] text-[#9CA3AF] mt-1">{lastMsg ? `Last message: ${lastMsg.from === 'agent' ? 'you' : 'user'} · ${lastMsg.time}` : 'Awaiting first message'}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EDE9FE]">
                  <h3 className="text-sm font-bold text-[#171717]">Support Tickets</h3>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={ticketQuery} onChange={(e) => setTicketQuery(e.target.value)} placeholder="Search tickets..." className="w-full sm:w-56 pl-9 pr-3 py-2 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7C3AED] transition-all" />
                  </div>
                </div>
                <div className="divide-y divide-[#EDE9FE] mt-2">
                  {filteredTickets.map((t) => (
                    <div key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#171717]">{t.subject}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${t.priority === 'High' ? 'bg-red-50 text-red-600 border-red-100' : t.priority === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>{t.priority}</span>
                        </div>
                        <span className="block text-[10px] text-[#6B7280] mt-0.5">{t.user} · {t.time}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${t.status === 'Resolved' ? 'bg-emerald-50 text-[#16A34A] border-emerald-100' : t.status === 'Open' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-sky-50 text-sky-600 border-sky-100'}`}>{t.status}</span>
                        <button onClick={() => { setTickets((prev) => prev.map((x) => x.id === t.id ? { ...x, status: 'Resolved' } : x)); notify('Ticket marked resolved'); }} className="px-2 py-1 rounded-lg bg-emerald-50 text-[#16A34A] text-[10px] font-bold border border-emerald-100 cursor-pointer"><Check className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============ PROMOS ============ */}
          {section === 'promos' && (
            <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Bonus &amp; Promo Codes</h3>
              <div className="divide-y divide-[#EDE9FE]">
                {promos.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="inline-block text-[11px] font-bold text-[#6D28D9] bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 font-mono">{p.code}</span>
                      <span className="block text-[10px] text-[#6B7280] mt-1">{p.value} {p.unit} · {p.used.toLocaleString()}/{p.cap.toLocaleString()} used</span>
                      <div className="h-1.5 bg-[#EDE9FE] rounded-full overflow-hidden mt-1 max-w-xs">
                        <div className="h-full bg-gradient-to-r from-[#7C3AED] to-[#A855F7] rounded-full" style={{ width: `${Math.min(100, (p.used / p.cap) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => { const next = promos.map((x) => x.id === p.id ? { ...x, active: !x.active } : x); setPromos(next); replacePromos(next).catch(() => {}); notify(`${p.code} ${p.active ? 'deactivated' : 'activated'}`); }} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${p.active ? 'bg-emerald-50 text-[#16A34A] border-emerald-100' : 'bg-[#F8F7FC] text-[#6B7280] border-[#EDE9FE]'}`}>{p.active ? 'Active' : 'Off'}</button>
                      <button onClick={() => { const next = promos.filter((x) => x.id !== p.id); setPromos(next); replacePromos(next).catch(() => {}); notify(`${p.code} deleted`); }} className="px-2 py-1 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold border border-red-100 cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => {
                const code = window.prompt('Enter the new promo code (e.g. SPRING100)');
                if (!code || !code.trim()) return;
                const reward = parseFloat(window.prompt('XENA reward amount for this code', '10') || '10');
                const next = [{ id: `pr-${Date.now()}`, code: code.trim().toUpperCase(), value: reward, unit: 'XENA', used: 0, cap: 0, active: true }, ...promos];
                setPromos(next);
                replacePromos(next).catch(() => {});
                notify('Promo code created');
              }} className="mt-3 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"><Plus className="w-3 h-3" /> Create Code</button>
            </div>
          )}

          {/* ============ SYSTEM ============ */}
          {section === 'system' && (
            <div className="space-y-4">
              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Market Price (XENA)</h3>
                <p className="text-[10px] text-[#6B7280] mt-2">Sets the live XENA/USD price and ₦/XENA rate shown on every user's dashboard, wallet, market charts, buy/sell, P2P ads and deposit/withdraw conversions. Saves instantly for all users.</p>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 mt-3 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-[#6B7280] mb-1">Price (USD)</label>
                    <input
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      type="number"
                      step="any"
                      min="0"
                      placeholder="2.85"
                      className="w-full px-3 py-2 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7C3AED] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#6B7280] mb-1">₦ per XENA</label>
                    <input
                      value={ngnRateInput}
                      onChange={(e) => setNgnRateInput(e.target.value)}
                      type="number"
                      step="any"
                      min="0"
                      placeholder="1500"
                      className="w-full px-3 py-2 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7C3AED] transition-all"
                    />
                  </div>
                  <button onClick={handleApplyPrice} disabled={priceBusy} className="px-3 py-2 sm:col-span-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60">
                    <TrendingUp className="w-3.5 h-3.5" /> {priceBusy ? 'Applying...' : 'Set Price & Rate for All Users'}
                  </button>
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] text-[#9CA3AF]">Now: <span className="font-mono font-bold text-[#6D28D9]">${xenaPrice.toFixed(4)} · ₦{Number(xenaNgnRate || 1500).toLocaleString()}</span></span>
                  </div>
                </div>
                {priceError && <p className="text-[10px] font-bold text-red-600 mt-2">{priceError}</p>}
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Platform Settings</h3>
                <div className="space-y-3 mt-3">
                  {[
                    { id: 'maintenance', label: 'Maintenance Mode', desc: 'Temporarily block logins & trading', value: maintenanceMode, toggle: (v: boolean) => updateSettings({ maintenanceMode: v }) },
                    { id: 'p2p', label: 'P2P 0% Fee Promotion', desc: 'Keep maker & taker fees at zero', value: p2pZeroFee, toggle: (v: boolean) => updateSettings({ p2pZeroFee: v }) },
                    { id: 'withdraw', label: 'Manual Withdrawal Approval', desc: 'Require admin approval for payouts', value: withdrawApproval, toggle: (v: boolean) => updateSettings({ withdrawApproval: v }) },
                  ].map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE]">
                      <div>
                        <span className="block text-xs font-bold text-[#171717]">{t.label}</span>
                        <span className="block text-[10px] text-[#6B7280]">{t.desc}</span>
                      </div>
                      <button
                        role="switch"
                        aria-checked={t.value}
                        onClick={() => { t.toggle(!t.value); notify(`${t.label} ${!t.value ? 'enabled' : 'disabled'}`); }}
                        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${t.value ? 'bg-[#7C3AED]' : 'bg-slate-200'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${t.value ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Payment Limits (NGN)</h3>
                <p className="text-[10px] text-[#6B7280] mt-2">Enforced on the client and inside Supabase RPCs — every deposit request and withdrawal request is blocked below these.</p>
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#6B7280] mb-1">Min Deposit</label>
                    <input type="number" min="0" value={minDepInput} onChange={(e) => setMinDepInput(e.target.value)} placeholder="3000" className="w-full px-3 py-2 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7C3AED]" />
                    <span className="text-[9px] text-[#9CA3AF]">Current: ₦{limits?.min_deposit_ngn?.toLocaleString() ?? 3000}</span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#6B7280] mb-1">Min Withdrawal</label>
                    <input type="number" min="0" value={minWdInput} onChange={(e) => setMinWdInput(e.target.value)} placeholder="3000" className="w-full px-3 py-2 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7C3AED]" />
                    <span className="text-[9px] text-[#9CA3AF]">Current: ₦{limits?.min_withdrawal_ngn?.toLocaleString() ?? 3000}</span>
                  </div>
                </div>
                <button onClick={handleApplyLimits} disabled={limitsBusy} className="mt-3 px-3 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white text-xs font-bold cursor-pointer disabled:opacity-60">
                  {limitsBusy ? 'Saving...' : 'Save Limits'}
                </button>
                {limitsError && <p className="text-[10px] font-bold text-red-600 mt-2">{limitsError}</p>}
              </div>

              <div className="bg-white border border-[#EDE9FE] rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#171717] pb-3 border-b border-[#EDE9FE]">Audit Log</h3>
                <div className="divide-y divide-[#EDE9FE]">
                  {audit.map((a) => (
                    <div key={a.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <ClipboardList className="w-4 h-4 text-[#7C3AED] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="font-bold text-[#171717] block">{a.action}</span>
                          <span className="text-[10px] text-[#6B7280] block">{a.detail}</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-[#9CA3AF] shrink-0">{a.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
