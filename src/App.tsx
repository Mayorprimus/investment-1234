import React, { useState, useEffect, useMemo, useRef } from 'react';
import { VaultPackage } from './types';
import {
  INITIAL_USER_PROFILE,
  INITIAL_BALANCES,
  INITIAL_MARKET_STATS,
  INITIAL_TRANSACTIONS,
  INITIAL_INVESTMENT_PLANS,
  INITIAL_P2P_OFFERS,
  INITIAL_NOTIFICATIONS,
  INITIAL_ANNOUNCEMENTS,
} from './data/initialData';
import {
  UserProfile,
  UserBalances,
  MarketStats,
  Transaction,
  InvestmentPlan,
  P2POffer,
  P2PTrade,
  NotificationItem,
  Account,
  RegisteredUserRecord,
} from './types';
import {
  SEED_USERS,
  SEED_TXS,
  SEED_MERCHANTS,
  SEED_DISPUTES,
  SEED_TICKETS,
  SEED_PROMOS,
  SEED_AUDIT,
  SEED_DEPOSITS,
  SEED_REFERRALS,
} from './pages/AdminPanel';
import { getState, saveState, registerAccount, loginAccount, saveAccount, changeAccountPassword, getAuthToken, adjustUserBalance, submitP2POffer, approveP2POffer, rejectP2POffer, submitP2PPayment, approveP2PPayment, rejectP2PPayment, setXenaPrice, deleteUserAccount, stakeVault, claimYield, getMyState, moveP2POffer, updateLimits, adminRestartInvestment, adminCancelInvestment, adminPayoutInvestment, adminPayoutAllVaults, adminUpdateVault, adminAddVault, adminDeleteVault, adminDecideWithdrawal, redeemPromoCode, logout } from './lib/api';
import { sb, mapProfileToAccount } from './lib/supabase';

// Layout Components
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';

// Individual Dedicated Pages
import { HomePage } from './pages/HomePage';
import { MarketPage } from './pages/MarketPage';
import { InvestmentsPage } from './pages/InvestmentsPage';
import { P2PPage } from './pages/P2PPage';
import { WalletPage } from './pages/WalletPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { SecurityPage } from './pages/SecurityPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { AdminPanel } from './pages/AdminPanel';

// Modals
import { DepositWithdrawModal } from './components/modals/DepositWithdrawModal';
import { BuySellModal } from './components/modals/BuySellModal';
import { SendReceiveModal } from './components/modals/SendReceiveModal';
import { P2PTradeModal } from './components/modals/P2PTradeModal';
import { InvestmentDetailModal } from './components/modals/InvestmentDetailModal';
import { SecurityModal } from './components/modals/SecurityModal';
import { SearchModal } from './components/SearchModal';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { WelcomeModal } from './components/modals/WelcomeModal';

export default function App() {
  // App Global State
  const [user, setUser] = useState<UserProfile>(INITIAL_USER_PROFILE);
  const [balances, setBalances] = useState<UserBalances>(INITIAL_BALANCES);
  const [marketStats, setMarketStats] = useState<MarketStats>(INITIAL_MARKET_STATS);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [investments, setInvestments] = useState<InvestmentPlan[]>(INITIAL_INVESTMENT_PLANS);
  const [p2pOffers, setP2POffers] = useState<P2POffer[]>(INITIAL_P2P_OFFERS);
  const [p2pTrades, setP2PTrades] = useState<P2PTrade[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [vaultCatalog, setVaultCatalog] = useState<VaultPackage[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [allInvestments, setAllInvestments] = useState<any[]>([]);
  const [limits, setLimits] = useState<{ min_deposit_ngn?: number; min_withdrawal_ngn?: number }>({ min_deposit_ngn: 5000, min_withdrawal_ngn: 5000 });

  // Active View / Page Routing
  const [activeTab, setActiveTab] = useState<string>('login');

  // Auth gate — no demo access: the app only shows real pages once a
  // Supabase session exists.
  const [authed, setAuthed] = useState(false);

  // Persisted accounts (registered users) + admin-managed data (server-backed)
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [users, setUsers] = useState(SEED_USERS);
  const [txs, setTxs] = useState(SEED_TXS);
  const [merchants, setMerchants] = useState(SEED_MERCHANTS);
  const [disputes, setDisputes] = useState(SEED_DISPUTES);
  const [tickets, setTickets] = useState(SEED_TICKETS);
  const [promos, setPromos] = useState(SEED_PROMOS);
  const [announcements, setAnnouncements] = useState(INITIAL_ANNOUNCEMENTS as any[]);
  const [audit, setAudit] = useState(SEED_AUDIT);
  const [deposits, setDeposits] = useState(SEED_DEPOSITS);
  const [referrals, setReferrals] = useState(SEED_REFERRALS);
  const [bonusLog, setBonusLog] = useState<{ id: string; code: string; name: string; xena: number; time: string }[]>([]);
  const [adminSettings, setAdminSettings] = useState({ maintenanceMode: false, p2pZeroFee: true, withdrawApproval: true });
  const [booted, setBooted] = useState(false);

  const registeredUsers = useMemo(
    () => accounts.map((a) => ({ name: a.name, email: a.email, country: a.country, phone: a.phone, dob: a.dob, referrer: a.referrer })),
    [accounts]
  );

  // Only approved listings appear in the public marketplace.
  const visibleP2POffers = useMemo(
    () => p2pOffers.filter((o) => o.status !== 'pending' && o.status !== 'rejected'),
    [p2pOffers]
  );

  // Modal States
  const [depositWithdrawOpen, setDepositWithdrawOpen] = useState(false);
  const [depositWithdrawTab, setDepositWithdrawTab] = useState<'deposit' | 'withdraw'>('deposit');

  const [buySellOpen, setBuySellOpen] = useState(false);
  const [buySellMode, setBuySellMode] = useState<'buy' | 'sell'>('buy');

  const [sendReceiveOpen, setSendReceiveOpen] = useState(false);
  const [sendReceiveMode, setSendReceiveMode] = useState<'send' | 'receive'>('send');

  const [selectedP2POffer, setSelectedP2POffer] = useState<P2POffer | null>(null);
  const [selectedP2PPaymentMethod, setSelectedP2PPaymentMethod] = useState<string | undefined>(undefined);
  const [p2pModalOpen, setP2PModalOpen] = useState(false);
  const [redeemedBonusCodes, setRedeemedBonusCodes] = useState<string[]>([]);

  const [selectedPlan, setSelectedPlan] = useState<InvestmentPlan | null>(null);
  const [investmentModalOpen, setInvestmentModalOpen] = useState(false);

  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Boot: load public state, restore any existing Supabase session, then pull
  // the signed-in account (if any). Realtime keeps everything live thereafter.
  useEffect(() => {
    (async () => {
      try {
        const state = await getState();
        if (state) {
          if (state.users) setUsers(state.users);
          if (state.txs) setTxs(state.txs);
          if (state.merchants) setMerchants(state.merchants);
          if (state.disputes) setDisputes(state.disputes);
          if (state.tickets) setTickets(state.tickets);
          if (state.promos) setPromos(state.promos);
          if (state.announcements) setAnnouncements(state.announcements);
          if (state.audit) setAudit(state.audit);
          if (state.deposits) setDeposits(state.deposits);
          if (state.referrals) setReferrals(state.referrals);
          if (state.bonusLog) setBonusLog(state.bonusLog);
          if (state.settings) setAdminSettings(state.settings);
          if (state.accounts) setAccounts(state.accounts);
          if (state.p2pOffers) setP2POffers(state.p2pOffers);
          if (state.p2pTrades) setP2PTrades(state.p2pTrades);
          if (state.vaultCatalog) setVaultCatalog(state.vaultCatalog);
          if (state.investments) setAllInvestments(state.investments);
          if (state.withdrawals) setWithdrawals(state.withdrawals);
          if (state.payments) setPayments(state.payments);
          if (state.limits) setLimits(state.limits);
          if (state.xenaPrice) applyGlobalPrice(Number(state.xenaPrice), state.xenaNgnRate != null ? Number(state.xenaNgnRate) : undefined);
        }
      } catch {
        // offline — keep seed defaults
      }
      // Restore a persisted session after refresh.
      try {
        const user = (await sb.auth.getSession()).data?.session?.user;
        if (user) {
          const me = await getMyState();
          if (me?.profile) {
            applyAccount(mapProfileToAccount(me.profile, me.investments || []));
            setAuthed(true);
            if (me.profile.role === 'admin') {
              setUser((prev) => ({ ...prev, role: 'admin' }));
              handleNavSelect('admin');
            } else {
              handleNavSelect('home');
            }
          } else {
            setAuthed(false);
            handleNavSelect('login');
          }
        } else {
          setAuthed(false);
          handleNavSelect('login');
        }
      } catch {
        // no session — require login
        setAuthed(false);
        handleNavSelect('login');
      }
      setBooted(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: any public/admin table change re-syncs shared + my state so every
  // admin action (price, approval, payout, withdrawal decision…) lands live.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      if (cancelled) return;
      try {
        const state = await getState();
        if (!state) return;
        setUsers(state.users || []);
        setTxs(state.txs || []);
        setMerchants(state.merchants || []);
        setDisputes(state.disputes || []);
        setTickets(state.tickets || []);
        setPromos(state.promos || []);
        setAnnouncements(state.announcements || []);
        setAudit(state.audit || []);
        setDeposits(state.deposits || []);
        setReferrals(state.referrals || []);
        setBonusLog(state.bonusLog || []);
        if (state.settings) setAdminSettings(state.settings);
        if (state.accounts) setAccounts(state.accounts);
        if (state.p2pOffers) setP2POffers(state.p2pOffers);
        if (state.p2pTrades) setP2PTrades(state.p2pTrades);
        if (state.vaultCatalog) setVaultCatalog(state.vaultCatalog);
        if (state.investments) setAllInvestments(state.investments);
        if (state.withdrawals) setWithdrawals(state.withdrawals);
        if (state.payments) setPayments(state.payments);
        if (state.limits) setLimits(state.limits);
        if (state.xenaPrice) applyGlobalPrice(Number(state.xenaPrice), state.xenaNgnRate != null ? Number(state.xenaNgnRate) : undefined);
        const user = (await sb.auth.getSession()).data?.session?.user;
        if (user) {
          const me = await getMyState();
          if (me?.profile) {
            applyAccount(mapProfileToAccount(me.profile, me.investments || []));
          }
        }
      } catch {
        // ignore transient failures
      }
    };
    const channel = sb
      .channel('xena-shared-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => refresh().catch(() => {}), 350);
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist: push the full shared admin state whenever it changes.
  // (Accounts are NOT included — they persist through the authenticated
  // account-save endpoint so hashes and balances stay server-protected.)
  const persistedSnapshot = useMemo(
    () =>
      JSON.stringify({
        users,
        txs,
        deposits,
        referrals,
        bonusLog,
        merchants,
        disputes,
        tickets,
        promos,
        announcements,
        audit,
        settings: adminSettings,
      }),
    [users, txs, deposits, referrals, bonusLog, merchants, disputes, tickets, promos, announcements, audit, adminSettings]
  );

  useEffect(() => {
    if (!booted) return;
    const t = setTimeout(() => {
      saveState(persistedSnapshot).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [persistedSnapshot, booted]);

  // Sync: keep the signed-in account's live session data persisted via the
  // authenticated account-save endpoint (only when a real account token exists).
  useEffect(() => {
    if (!getAuthToken()) return;
    const t = setTimeout(() => {
      saveAccount({
        // NOTE: `name` is intentionally excluded here. This effect fires on
        // boot while `user` still holds the INITIAL_USER_PROFILE placeholder
        // ("Alex Morgan"), which would clobber the real registered name in the
        // DB. Name is persisted only via the explicit handleUpdateProfile.
        email: user.email.toLowerCase(),
        kycTier: user.kycTier,
        twoFactorEnabled: user.twoFactorEnabled,
        pinSet: user.pinSet,
verifiedAccountsCount: user.verifiedAccountsCount,
      balances,
      transactions,
      investments,
      notifications,
      redeemedBonusCodes,
      bankDetails: user.bankDetails || [],
      walletAddresses: user.walletAddresses || [],
    }).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [user, balances, transactions, investments, notifications, redeemedBonusCodes]);

  // Handlers for state updates
  const handleBalanceChange = (amountDelta: number, newTx: Transaction) => {
    setBalances((prev) => {
      const newAvailable = Math.max(0, prev.availableXena + amountDelta);
      const newTotal = prev.investedXena + newAvailable;
      return {
        ...prev,
        availableXena: newAvailable,
        totalBalance: newTotal,
      };
    });
    setTransactions((prev) => [newTx, ...prev]);
  };

  const handleClaimYield = async (planId: string, _amount: number, _newTx: Transaction) => {
    // Yield is credited server-side (RPC) — Realtime re-syncs balance and tx list.
    try {
      await claimYield(planId);
    } catch {
      // ignore — Realtime will reconcile
    }
  };

  const handleP2PPaymentSubmitted = (trade: P2PTrade) => {
    const t = { ...trade, buyerEmail: user.email };
    setP2PTrades((prev) => [t, ...prev]);
    submitP2PPayment(t as unknown as Record<string, unknown>).catch(() => {});
    setNotifications((prev) => [
      {
        id: `notif-p2p-${Date.now()}`,
        title: 'P2P Payment Submitted for Review',
        message: `Admin is validating your ${t.method} payment. Once approved, ${t.xenaAmount} XENA will be released to your balance.`,
        timestamp: 'Just now',
        read: false,
        type: 'transaction',
      },
      ...prev,
    ]);
  };

  const handleAddP2POffer = (newOffer: P2POffer) => {
    const pendingOffer: P2POffer = {
      ...newOffer,
      status: 'pending',
      listedBy: user.email,
    };
    setP2POffers((prev) => [pendingOffer, ...prev]);
    submitP2POffer(pendingOffer as unknown as Record<string, unknown>).catch(() => {});
    setNotifications((prev) => [
      {
        id: `notif-ad-${Date.now()}`,
        title: 'P2P Ad Submitted for Approval',
        message: `Your ${pendingOffer.type || 'BUY'} ad (#${pendingOffer.id.slice(-5)}) is awaiting admin approval before it goes live.`,
        timestamp: 'Just now',
        read: false,
        type: 'system',
      },
      ...prev,
    ]);
  };

  const handleApproveP2POffer = async (offerId: string) => {
    setP2POffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: 'approved' } : o)));
    await approveP2POffer(offerId).catch(() => {});
  };

  const handleRejectP2POffer = async (offerId: string) => {
    setP2POffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: 'rejected' } : o)));
    await rejectP2POffer(offerId).catch(() => {});
  };

  const handleApproveP2PPayment = async (tradeId: string) => {
    const trade = p2pTrades.find((t) => t.id === tradeId);
    if (!trade) return;
    setP2PTrades((prev) => prev.map((t) => (t.id === tradeId ? { ...t, status: 'approved' } : t)));
    const amount = trade.xenaAmount;
    const newTx: Transaction = {
      id: `tx-p2p-${Date.now().toString().slice(-6)}`,
      title: `P2P Purchase (${trade.method})`,
      type: 'p2p_buy',
      amount,
      unit: 'XENA',
      status: 'Completed',
      timestamp: 'Just now',
      counterparty: `${trade.merchantName}`,
      paymentMethod: trade.method,
      fee: 0,
    };
    setAccounts((prev) =>
      prev.map((a) =>
        a.email.toLowerCase() === trade.buyerEmail.toLowerCase()
          ? {
              ...a,
              balances: {
                ...a.balances,
                availableXena: (a.balances?.availableXena || 0) + amount,
                totalBalance: (a.balances?.totalBalance || 0) + amount,
              },
              transactions: [newTx, ...(a.transactions || [])],
              notifications: [
                {
                  id: `notif-p2p-${Date.now()}`,
                  title: 'P2P Payment Approved',
                  message: `Admin validated your ${trade.method} payment. ${amount} XENA has been released to your balance.`,
                  timestamp: 'Just now',
                  read: false,
                  type: 'transaction',
                },
                ...(a.notifications || []),
              ],
            }
          : a
      )
    );
    if (user.email.toLowerCase() === trade.buyerEmail.toLowerCase()) {
      setBalances((prev) => ({
        ...prev,
        availableXena: prev.availableXena + amount,
        totalBalance: prev.totalBalance + amount,
      }));
      setTransactions((prev) => [newTx, ...prev]);
      setNotifications((prev) => [
        {
          id: `notif-p2p-${Date.now()}`,
          title: 'P2P Payment Approved',
          message: `Admin validated your ${trade.method} payment. ${amount} XENA has been released to your balance.`,
          timestamp: 'Just now',
          read: false,
          type: 'transaction',
        },
        ...prev,
      ]);
    }
    await approveP2PPayment(tradeId).catch(() => {});
    setNotifications((prev) => [
      {
        id: `notif-pa-${Date.now()}`,
        title: 'P2P Payment Validated',
        message: `Approved ${amount} XENA release for ${trade.buyerEmail} (${trade.method}).`,
        timestamp: 'Just now',
        read: false,
        type: 'transaction',
      },
      ...prev,
    ]);
  };

  const handleRejectP2PPayment = async (tradeId: string) => {
    const trade = p2pTrades.find((t) => t.id === tradeId);
    if (!trade) return;
    setP2PTrades((prev) => prev.map((t) => (t.id === tradeId ? { ...t, status: 'rejected' } : t)));
    await rejectP2PPayment(tradeId).catch(() => {});
  };

  const handleAdjustUserBalance = async (targetEmail: string, amount: number, memo?: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await adjustUserBalance(targetEmail, amount, memo);
    if (!res.ok) return { ok: false, error: res.error };
    const e = targetEmail.trim().toLowerCase();
    setAccounts((prev) =>
      prev.map((a) =>
        a.email.toLowerCase() === e
          ? {
              ...a,
              balances: {
                ...a.balances,
                availableXena: Math.max(0, (a.balances?.availableXena || 0) + amount),
                totalBalance: Math.max(0, (a.balances?.totalBalance || 0) + amount),
              },
            }
          : a
      )
    );
    return { ok: true };
  };

  const handleDeleteUserAccount = async (targetEmail: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await deleteUserAccount(targetEmail);
    if (!res.ok) return { ok: false, error: res.error };
    const e = targetEmail.trim().toLowerCase();
    setAccounts((prev) => prev.filter((a) => a.email.toLowerCase() !== e));
    return { ok: true };
  };

  const handleMoveP2POffer = async (offerId: string, direction: 'up' | 'down'): Promise<{ ok: boolean; error?: string }> => {
    const res = await moveP2POffer(offerId, direction);
    if (!res.ok) return res;
    setP2POffers((prev) =>
      (() => {
        const approved = prev.filter((o) => o.status === 'approved');
        const rest = prev.filter((o) => o.status !== 'approved');
        const idx = approved.findIndex((o) => o.id === offerId);
        if (idx === -1) return prev;
        const moved = approved.splice(idx, 1)[0];
        if (direction === 'up') approved.unshift(moved);
        else approved.push(moved);
        const reindexed = approved.map((o, i) => ({ ...o, sortOrder: i + 1 }));
        return [...reindexed, ...rest];
      })()
    );
    return { ok: true };
  };

  const handleDecideWithdrawal = async (requestId: string, decision: 'approved' | 'rejected', note?: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await adminDecideWithdrawal(requestId, decision, note);
    if (!res.ok) return res;
    setWithdrawals((prev) =>
      prev.map((w) =>
        w.id === requestId
          ? { ...w, status: decision, admin_note: note || w.admin_note, decided_at: new Date().toISOString() }
          : w
      )
    );
    return { ok: true };
  };

  const handleRestartInvestment = async (id: string, note?: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await adminRestartInvestment(id, note);
    if (!res.ok) return res;
    setAllInvestments((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'active', progress_percent: 0, earned_xena: 0 } : i))
    );
    return { ok: true };
  };

  const handleCancelInvestment = async (id: string, note?: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await adminCancelInvestment(id, note);
    if (!res.ok) return res;
    setAllInvestments((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'canceled' } : i))
    );
    return { ok: true };
  };

  const handlePayoutInvestment = async (id: string, note?: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await adminPayoutInvestment(id, note);
    if (!res.ok) return res;
    setAllInvestments((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'matured', progress_percent: 100 } : i))
    );
    return { ok: true };
  };

  const handlePayoutAllVaults = async (): Promise<{ ok: boolean; error?: string; processed?: number }> => {
    const res = await adminPayoutAllVaults();
    if (!res.ok) return res;
    setAllInvestments((prev) =>
      prev.map((i) => (i.status === 'matured' ? { ...i, status: 'active', progress_percent: 0 } : i))
    );
    return res;
  };

  const handleUpdateVault = async (vaultId: string, updates: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
    const res = await adminUpdateVault(vaultId, updates);
    if (!res.ok) return res;
    if (res.vault) {
      setVaultCatalog((prev) => prev.map((v) => (v.id === vaultId ? { ...v, ...res.vault } : v)));
    }
    return { ok: true };
  };

  const handleAddVault = async (payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string; id?: string }> => {
    const res = await adminAddVault(payload);
    if (!res.ok) return res;
    return { ok: true, id: res.id };
  };

  const handleDeleteVault = async (vaultId: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await adminDeleteVault(vaultId);
    if (!res.ok) return res;
    setVaultCatalog((prev) => prev.filter((v) => v.id !== vaultId));
    return { ok: true };
  };

  const handleUpdateLimits = async (minDeposit: number, minWithdrawal: number): Promise<{ ok: boolean; error?: string }> => {
    const res = await updateLimits(minDeposit, minWithdrawal);
    if (!res.ok) return res;
    setLimits({ min_deposit_ngn: minDeposit, min_withdrawal_ngn: minWithdrawal });
    return { ok: true };
  };

  const stakingInFlight = useRef<Set<string>>(new Set());

  const handleStakeNewPlan = async (plan: InvestmentPlan): Promise<boolean> => {
    // Block a second concurrent purchase of the same plan (double-tap race)
    // before the server/realtime round-trip marks it as held.
    if (stakingInFlight.current.has(plan.id)) return false;
    if (balances.availableXena < plan.investedAmount) {
      alert(`Insufficient available XENA to stake this plan. Minimum required: ${plan.investedAmount.toFixed(2)} XENA`);
      return false;
    }
    const session = (await sb.auth.getSession()).data?.session?.user;
    if (!session) {
      alert('You must be signed in to stake a vault.');
      handleNavSelect('login');
      return false;
    }
    stakingInFlight.current.add(plan.id);
    const res = await stakeVault(plan.id);
    stakingInFlight.current.delete(plan.id);
    if (!res.ok) {
      alert(res.error || 'Unable to stake this vault.');
      return false;
    }
    // Optimistically mark the plan as held so the buy button stays disabled
    // until the realtime sync confirms it from the server.
    if (res.investment) {
      setInvestments((prev) => (prev.some((p) => p.name === plan.name) ? prev : [res.investment, ...prev]));
    }
    return true;
  };

  const handleInternalTransfer = (amount: number, from: string, to: string) => {
    const newTx: Transaction = {
      id: `TX-${Date.now().toString().slice(-6)}`,
      type: 'send',
      title: `Internal Transfer: ${from} → ${to}`,
      amount: amount,
      unit: 'XENA',
      timestamp: 'Just now',
      status: 'completed',
    };
    setTransactions((prev) => [newTx, ...prev]);
  };

  const handleQuickAction = (action: 'buy' | 'sell' | 'send' | 'receive' | 'p2p' | 'invest') => {
    switch (action) {
      case 'buy':
        setBuySellMode('buy');
        setBuySellOpen(true);
        break;
      case 'sell':
        setBuySellMode('sell');
        setBuySellOpen(true);
        break;
      case 'send':
        setSendReceiveMode('send');
        setSendReceiveOpen(true);
        break;
      case 'receive':
        setSendReceiveMode('receive');
        setSendReceiveOpen(true);
        break;
      case 'p2p':
        handleNavSelect('p2p');
        break;
      case 'invest':
        handleNavSelect('investments');
        break;
    }
  };

  const handleOpenDeposit = () => {
    setDepositWithdrawTab('deposit');
    setDepositWithdrawOpen(true);
  };

  const handleOpenWithdraw = () => {
    setDepositWithdrawTab('withdraw');
    setDepositWithdrawOpen(true);
  };

  const handleSelectP2POffer = (offer: P2POffer, initialPaymentMethod?: string) => {
    setSelectedP2POffer(offer);
    setSelectedP2PPaymentMethod(initialPaymentMethod);
    setP2PModalOpen(true);
  };

  const handleRedeemBonus = async (code: string): Promise<{ ok: boolean; error?: string; amount?: number; title?: string }> => {
    const result = await redeemPromoCode(code);
    if (!result.ok) {
      return { ok: false, error: result.error || 'Unable to redeem code. Please try again.' };
    }
    const amount = result.amount || 0;
    const title = result.title || `Bonus Code Claimed (${code})`;

    setBalances((prev) => {
      const newAvailable = prev.availableXena + amount;
      const newTotal = (prev.totalBalance || prev.totalXena) + amount;
      return {
        ...prev,
        availableXena: newAvailable,
        totalBalance: newTotal,
        totalXena: prev.totalXena + amount,
      };
    });

    const newTx: Transaction = {
      id: `TX-BONUS-${Date.now().toString().slice(-4)}`,
      title,
      type: 'yield',
      amount,
      unit: 'XENA',
      timestamp: 'Just now',
      status: 'Completed',
      counterparty: 'XENA Community Reward Desk',
      fee: 0,
    };
    setTransactions((prev) => [newTx, ...prev]);

    const newNotification: NotificationItem = {
      id: `notif-bonus-${Date.now()}`,
      title: '🎁 Bonus Voucher Claimed!',
      message: `+${amount.toFixed(2)} XENA has been credited to your available balance via promo code ${code}.`,
      timestamp: 'Just now',
      read: false,
      type: 'transaction',
    };
    setNotifications((prev) => [newNotification, ...prev]);

    setRedeemedBonusCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));

    return { ok: true, amount, title };
  };

  const handleSelectPlan = (plan: InvestmentPlan) => {
    setSelectedPlan(plan);
    setInvestmentModalOpen(true);
  };

  const handleUpdateSecurity = (settings: { twoFactor: boolean; pinSet: boolean }) => {
    setUser((prev) => ({
      ...prev,
      twoFactorEnabled: settings.twoFactor,
      pinSet: settings.pinSet,
    }));
  };

  const handleUpdateProfile = (profile: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...profile }));
    // Persist explicit profile edits (e.g. display name) — the auto write-through
    // no longer sends `name`, so this is the only path that saves it.
    if (getAuthToken()) {
      saveAccount(profile).catch(() => {});
    }
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> => {
    return changeAccountPassword(currentPassword, newPassword);
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  const handleNavSelect = (tab: string) => {
    const protectedTabs = ['home', 'market', 'investments', 'p2p', 'wallet', 'profile', 'transactions', 'announcements', 'security', 'settings', 'admin'];
    if (!authed && protectedTabs.includes(tab)) {
      setActiveTab('login');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = async () => {
    await logout();
    setAuthed(false);
    setUser(INITIAL_USER_PROFILE);
    setBalances(INITIAL_BALANCES);
    setTransactions(INITIAL_TRANSACTIONS);
    setInvestments([]);
    setNotifications([]);
    setRedeemedBonusCodes([]);
    handleNavSelect('login');
  };

  const applyGlobalPrice = (price: number, ngnRate?: number) => {
    const p = Math.round(price * 10000) / 10000;
    setMarketStats((prev) => ({
      ...prev,
      price: p,
      high24h: Math.max(prev.high24h, p),
      low24h: Math.min(prev.low24h, p),
    }));
    setBalances((prev) => ({
      ...prev,
      currentPrice: p,
      // `usdRate` (USD value of 1 XENA) must follow the global price too —
      // the wallet/profile pages use it for fiat conversion, and a stale
      // per-profile value made their totals disagree with the home page.
      usdRate: p,
      ...(ngnRate != null ? { xenaNgnRate: Number(ngnRate) } : {}),
    }));
    if (ngnRate != null) {
      setP2POffers((prev) => prev.map((o) => ({ ...o, pricePerXena: p })));
    }
  };

  const handleSetXenaPrice = async (price: number, ngnRate?: number): Promise<{ ok: boolean; error?: string }> => {
    const res = await setXenaPrice(price, ngnRate);
    if (!res.ok) return { ok: false, error: res.error };
    if (res.price) {
      applyGlobalPrice(res.price, res.xenaNgnRate ?? ngnRate);
      setAccounts((prev) =>
        prev.map((a) => ({
          ...a,
          balances: {
            ...a.balances,
            currentPrice: res.price as number,
            ...(res.xenaNgnRate != null ? { xenaNgnRate: Number(res.xenaNgnRate) } : {}),
          },
        }))
      );
    }
    return { ok: true };
  };

  const applyAccount = (acc: Account) => {
    setUser({
      name: acc.name,
      email: acc.email,
      kycTier: acc.kycTier,
      xenaId: acc.xenaId,
      xenaCode: acc.xenaCode,
      twoFactorEnabled: acc.twoFactorEnabled,
      pinSet: acc.pinSet,
      verifiedAccountsCount: acc.verifiedAccountsCount,
      role: 'user',
      bankDetails: acc.bankDetails || [],
      walletAddresses: acc.walletAddresses || [],
    });
setBalances((prev) => ({
      ...INITIAL_BALANCES,
      ...acc.balances,
      // Global price/NGN-rate are authoritative — always use the synced global
      // price so wallet/profile fiat totals match the home page.
      // Do NOT inherit stale per-profile prices from the DB.
      currentPrice: marketStats.price,
      usdRate: marketStats.price,
      xenaNgnRate: prev.xenaNgnRate || acc.balances.xenaNgnRate || 0.266,
    }));
    setTransactions(acc.transactions || []);
    setInvestments(acc.investments || []);
    setNotifications(acc.notifications || []);
    setRedeemedBonusCodes(acc.redeemedBonusCodes || []);
  };

  const handleLogin = async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const result = await loginAccount(email, password);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    setAuthed(true);
    if (result.role === 'admin') {
      if (result.account) {
        setUser((prev) => ({
          ...prev,
          role: 'admin',
          name: result.account.name || 'Administrator',
          email: result.account.email || 'admin12345@gmail.com',
          kycTier: result.account.kycTier || 'Staff',
          xenaId: result.account.xenaId || 'XN-ADMIN-01',
          xenaCode: result.account.xenaCode || 'xena-admin',
        }));
      } else {
        setUser((prev) => ({ ...prev, role: 'admin', name: 'Administrator', email: 'admin12345@gmail.com' }));
      }
      handleNavSelect('admin');
      return { ok: true };
    }
    if (result.account) {
      applyAccount(result.account);
      handleNavSelect('home');
      return { ok: true };
    }
    return { ok: false, error: 'Unable to sign in. Please try again.' };
  };

  const handleRegister = async (data: RegisteredUserRecord): Promise<{ ok: boolean; error?: string }> => {
    const result = await registerAccount(data);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    if (result.account) {
      applyAccount(result.account);
      setAuthed(true);
      setWelcomeOpen(true);
    }
    return { ok: true };
  };

  // Render the current active dedicated page
  const renderCurrentPage = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomePage
            user={user}
            balances={balances}
            marketStats={marketStats}
            transactions={transactions}
            investments={investments}
            p2pOffers={visibleP2POffers}
            redeemedBonusCodes={redeemedBonusCodes}
            onRedeemBonus={handleRedeemBonus}
            onOpenDeposit={handleOpenDeposit}
            onOpenWithdraw={handleOpenWithdraw}
            onQuickAction={handleQuickAction}
            onNavigateTab={handleNavSelect}
            onSelectPlan={handleSelectPlan}
            onSelectP2POffer={handleSelectP2POffer}
            onOpenSecurity={() => handleNavSelect('security')}
            announcements={announcements}
          />
        );

      case 'market':
        return (
          <MarketPage
            marketStats={marketStats}
            balances={balances}
            onBuyXena={() => {
              setBuySellMode('buy');
              setBuySellOpen(true);
            }}
            onSellXena={() => {
              setBuySellMode('sell');
              setBuySellOpen(true);
            }}
            onTradeSuccess={(amount, type) => {
              const delta = type === 'buy' ? amount : -amount;
              const tx: Transaction = {
                id: `TX-${Date.now().toString().slice(-4)}`,
                title: type === 'buy' ? `Purchased XENA` : `Sold XENA`,
                type: type === 'buy' ? 'deposit' : 'withdraw',
                amount,
                unit: 'XENA',
                timestamp: 'Just now',
                status: 'Completed',
                counterparty: 'Decentralized Spot Liquidity Pool',
                fee: +(amount * 0.001).toFixed(4),
              };
              handleBalanceChange(delta, tx);
            }}
          />
        );

      case 'investments':
        return (
          <InvestmentsPage
            plans={investments}
            balances={balances}
            catalog={vaultCatalog}
            onSelectPlan={handleSelectPlan}
            onStakeNewPlan={handleStakeNewPlan}
            user={user}
            xenaUsdPrice={marketStats.price}
          />
        );

      case 'p2p':
        return (
          <P2PPage
            offers={visibleP2POffers}
            onSelectOffer={handleSelectP2POffer}
            onAddOffer={handleAddP2POffer}
            defaultPrice={marketStats.price}
          />
        );

      case 'wallet':
        return (
          <WalletPage
            balances={balances}
            onOpenDeposit={handleOpenDeposit}
            onOpenWithdraw={handleOpenWithdraw}
            onOpenSend={() => {
              setSendReceiveMode('send');
              setSendReceiveOpen(true);
            }}
            onOpenReceive={() => {
              setSendReceiveMode('receive');
              setSendReceiveOpen(true);
            }}
            onTrade={() => handleNavSelect('market')}
            onInternalTransfer={handleInternalTransfer}
          />
        );

      case 'profile':
        return (
          <ProfilePage
            user={user}
            balances={balances}
            onUpdateSecurity={handleUpdateSecurity}
            onOpenDeposit={handleOpenDeposit}
            onOpenWithdraw={handleOpenWithdraw}
            onOpenSend={() => {
              setSendReceiveMode('send');
              setSendReceiveOpen(true);
            }}
            onOpenReceive={() => {
              setSendReceiveMode('receive');
              setSendReceiveOpen(true);
            }}
            onSelectTab={handleNavSelect}
          />
        );

      case 'transactions':
        return (
          <TransactionsPage
            transactions={transactions}
          />
        );

      case 'security':
        return (
          <ProfilePage
            user={user}
            balances={balances}
            onUpdateSecurity={handleUpdateSecurity}
            onOpenDeposit={handleOpenDeposit}
            onOpenWithdraw={handleOpenWithdraw}
            onOpenSend={() => {
              setSendReceiveMode('send');
              setSendReceiveOpen(true);
            }}
            onOpenReceive={() => {
              setSendReceiveMode('receive');
              setSendReceiveOpen(true);
            }}
            onSelectTab={handleNavSelect}
          />
        );

      case 'announcements':
        return (
          <AnnouncementsPage
            announcements={announcements}
            onExploreP2P={() => handleNavSelect('p2p')}
            onExploreStaking={() => handleNavSelect('investments')}
          />
        );

      case 'settings':
        return (
          <SettingsPage
            user={user}
            onUpdateSecurity={handleUpdateSecurity}
            onUpdateProfile={handleUpdateProfile}
            onChangePassword={handleChangePassword}
            onSelectTab={handleNavSelect}
          />
        );

      case 'login':
        return (
          <LoginPage
            onNavigateTab={handleNavSelect}
            onLogin={handleLogin}
            onLoginSuccess={() => handleNavSelect('home')}
            onAdminLogin={() => {
              setUser((prev) => ({ ...prev, role: 'admin', name: 'Administrator', email: 'admin@xena.fi' }));
              handleNavSelect('admin');
            }}
          />
        );

      case 'signup':
        return (
          <SignupPage
            onNavigateTab={handleNavSelect}
            onSignupSuccess={() => handleNavSelect('home')}
            onRegister={handleRegister}
          />
        );

      case 'admin':
        return (
          <AdminPanel
            onNavigateTab={handleNavSelect}
            registeredUsers={registeredUsers}
            users={users}
            setUsers={setUsers}
            txs={txs}
            setTxs={setTxs}
            merchants={merchants}
            setMerchants={setMerchants}
            p2pOffers={p2pOffers}
            onApproveP2POffer={handleApproveP2POffer}
            onRejectP2POffer={handleRejectP2POffer}
            p2pTrades={p2pTrades}
            onApproveP2PPayment={handleApproveP2PPayment}
            onRejectP2PPayment={handleRejectP2PPayment}
            accounts={accounts}
            onAdjustBalance={handleAdjustUserBalance}
            onDeleteAccount={handleDeleteUserAccount}
            xenaPrice={marketStats.price}
            onSetXenaPrice={handleSetXenaPrice}
            xenaNgnRate={balances.xenaNgnRate}
            disputes={disputes}
            setDisputes={setDisputes}
            tickets={tickets}
            setTickets={setTickets}
            promos={promos}
            setPromos={setPromos}
            announcements={announcements}
            setAnnouncements={setAnnouncements}
            audit={audit}
            setAudit={setAudit}
            deposits={deposits}
            setDeposits={setDeposits}
            referrals={referrals}
            setReferrals={setReferrals}
            bonusLog={bonusLog}
            setBonusLog={setBonusLog}
            settings={adminSettings}
            setSettings={setAdminSettings}
            withdrawals={withdrawals}
            onDecideWithdrawal={handleDecideWithdrawal}
            payments={payments}
            onMoveP2POffer={handleMoveP2POffer}
            allInvestments={allInvestments}
            onRestartInvestment={handleRestartInvestment}
            onCancelInvestment={handleCancelInvestment}
            onPayoutInvestment={handlePayoutInvestment}
            onPayoutAllVaults={handlePayoutAllVaults}
            vaultCatalog={vaultCatalog}
            onUpdateVault={handleUpdateVault}
            onAddVault={handleAddVault}
            onDeleteVault={handleDeleteVault}
            limits={limits}
            onUpdateLimits={handleUpdateLimits}
          />
        );

      default:
        return (
          <HomePage
            user={user}
            balances={balances}
            marketStats={marketStats}
            transactions={transactions}
            investments={investments}
            p2pOffers={visibleP2POffers}
            onOpenDeposit={handleOpenDeposit}
            onOpenWithdraw={handleOpenWithdraw}
            onQuickAction={handleQuickAction}
            onNavigateTab={handleNavSelect}
            onSelectP2POffer={handleSelectP2POffer}
            onSelectPlan={handleSelectPlan}
            onOpenSecuritySettings={() => handleNavSelect('security')}
            onBuyXena={() => {
              setBuySellMode('buy');
              setBuySellOpen(true);
            }}
            onSellXena={() => {
              setBuySellMode('sell');
              setBuySellOpen(true);
            }}
            referralCode={`XENA-${user.name.split(' ')[0].toUpperCase()}`}
            referralCount={registeredUsers.filter((ru) => ru.referrer && ru.referrer.toUpperCase() === `XENA-${user.name.split(' ')[0].toUpperCase()}`).length}
            announcements={announcements}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-[#FAF7FF] to-[#F3EFFF] text-[#171717] flex flex-col font-['Plus_Jakarta_Sans',sans-serif] pb-20 md:pb-0">
      {/* Top Header Navigation */}
      <Header
        activeTab={activeTab}
        onSelectTab={handleNavSelect}
        user={user}
        notifications={notifications}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onOpenSearch={() => setSearchModalOpen(true)}
        onOpenSecurity={() => handleNavSelect('security')}
        onSignOut={handleSignOut}
        signedIn={authed}
      />

      {/* Main Page Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
        {renderCurrentPage()}
      </main>

      {/* Mobile-Optimized Fixed Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={handleNavSelect}
      />

      {/* Interactive Global Modals */}
      <DepositWithdrawModal
        isOpen={depositWithdrawOpen}
        onClose={() => setDepositWithdrawOpen(false)}
        initialTab={depositWithdrawTab}
        availableXena={balances.availableXena}
        nairaBalance={balances.nairaBalance}
        xenaNgnRate={balances.xenaNgnRate}
        xenaUsdPrice={marketStats.price}
        limits={limits}
        email={user.email}
        country={user.country}
        savedBankDetails={user.bankDetails || []}
        savedWallets={user.walletAddresses || []}
        onSuccess={handleBalanceChange}
      />

      <BuySellModal
        isOpen={buySellOpen}
        onClose={() => setBuySellOpen(false)}
        initialMode={buySellMode}
        currentPrice={marketStats.price}
        availableXena={balances.availableXena}
        onSuccess={handleBalanceChange}
      />

      <SendReceiveModal
        isOpen={sendReceiveOpen}
        onClose={() => setSendReceiveOpen(false)}
        initialMode={sendReceiveMode}
        availableXena={balances.availableXena}
        myXenaCode={user.xenaCode}
        onSuccess={handleBalanceChange}
      />

      <P2PTradeModal
        isOpen={p2pModalOpen}
        onClose={() => setP2PModalOpen(false)}
        offer={selectedP2POffer}
        initialPaymentMethod={selectedP2PPaymentMethod}
        onPaymentSubmitted={handleP2PPaymentSubmitted}
      />

      <InvestmentDetailModal
        isOpen={investmentModalOpen}
        onClose={() => setInvestmentModalOpen(false)}
        plan={selectedPlan}
        availableXena={balances.availableXena}
        onClaimYield={handleClaimYield}
      />

      <SecurityModal
        isOpen={securityModalOpen}
        onClose={() => setSecurityModalOpen(false)}
        twoFactorEnabled={user.twoFactorEnabled}
        pinSet={user.pinSet}
        onUpdateSecurity={handleUpdateSecurity}
      />

      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onNavigate={handleNavSelect}
        onActionClick={(action) => {
          setSearchModalOpen(false);
          if (action === 'buy' || action === 'sell') {
            setBuySellMode(action);
            setBuySellOpen(true);
          } else if (action === 'deposit' || action === 'withdraw') {
            setDepositWithdrawTab(action);
            setDepositWithdrawOpen(true);
          } else if (action === 'security') {
            handleNavSelect('security');
          }
        }}
      />

      <NotificationsDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onClearAll={handleClearAllNotifications}
      />

      <WelcomeModal
        isOpen={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
        firstName={user.name.split(' ')[0] || 'onboard'}
        onDeposit={() => {
          setWelcomeOpen(false);
          setDepositWithdrawTab('deposit');
          setDepositWithdrawOpen(true);
        }}
      />
    </div>
  );
}
