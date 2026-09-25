import React, { useState, useEffect } from 'react';
import {
  User,
  ShieldCheck,
  Wallet,
  Lock,
  Smartphone,
  Key,
  Globe,
  LogOut,
  Plus,
  Trash2,
  Check,
  Copy,
  QrCode,
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Shield,
  Bell,
  RefreshCw,
  Eye,
  EyeOff,
  Sliders,
  DollarSign,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowRightLeft,
  Share2,
  Users,
  Award,
  Download,
  FileText,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Edit3,
  BadgePercent,
  TrendingUp,
  CreditCard,
  KeyRound,
  Power,
  Wrench,
  Mail,
  LifeBuoy,
  Headphones,
  Send,
  MessageCircle,
  Clock3
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, UserBalances } from '../types';
import { getSupportConversations, sendSupportMessage, getAuthToken } from '../lib/api';
import { XenaTokenBadge } from '../components/XenaLogo';

interface ProfilePageProps {
  user: UserProfile;
  balances: UserBalances;
  onUpdateSecurity: (settings: { twoFactor: boolean; pinSet: boolean }) => void;
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onOpenSend: () => void;
  onOpenReceive: () => void;
  onSelectTab: (tab: string) => void;
}

type ProfileRowProps = {
  icon: React.ElementType;
  label: string;
  hint?: string;
  indicator?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  danger?: boolean;
  onClick?: () => void;
  iconTone?: string;
};

const ProfileRow: React.FC<ProfileRowProps> = ({
  icon: Icon,
  label,
  hint,
  indicator,
  trailing,
  chevron = true,
  danger,
  onClick,
  iconTone = 'bg-[#6D28D9]/10 text-[#6D28D9]',
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer group ${
      danger ? 'text-[#E11D48]' : 'text-[#171717]'
    }`}
  >
    <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${iconTone}`}>
      <Icon className="w-4 h-4" />
    </span>
    <span className="flex-1 min-w-0">
      <span className={`block text-[13px] font-bold leading-tight ${danger ? 'text-[#E11D48]' : 'text-[#171717]'}`}>{label}</span>
      {hint && <span className="block text-[11px] text-[#9CA3AF] mt-0.5 truncate">{hint}</span>}
    </span>
    {indicator && <span className="shrink-0">{indicator}</span>}
    {trailing}
    {chevron && !danger && !trailing && (
      <ChevronRight className="w-4 h-4 text-[#CBD5E1] shrink-0 group-hover:text-[#6D28D9] transition-colors" />
    )}
  </button>
);

const ProfileSection: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    {title && (
      <h3 className="px-1 mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#9CA3AF]">{title}</h3>
    )}
    <div className="bg-white border border-[#EDE9FE] rounded-[16px] shadow-sm divide-y divide-[#F1EDF9] overflow-hidden">
      {children}
    </div>
  </div>
);

const PrefToggle: React.FC<{ label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  label,
  hint,
  checked,
  onChange,
}) => (
  <div className="px-4 py-3 flex items-center gap-3">
    <span className="w-9 h-9 shrink-0 rounded-xl bg-[#6D28D9]/10 text-[#6D28D9] flex items-center justify-center">
      <Bell className="w-4 h-4" />
    </span>
    <div className="flex-1 min-w-0">
      <span className="block text-[13px] font-bold text-[#171717]">{label}</span>
      {hint && <span className="block text-[11px] text-[#9CA3AF] truncate">{hint}</span>}
    </div>
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className={`w-11 h-6 rounded-full transition-colors ${checked ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7]' : 'bg-[#E5E0EE]'}`}>
        <span className={`block w-5 h-5 bg-white rounded-full shadow transform transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
    </label>
  </div>
);

const StatusChip: React.FC<{ tone: 'green' | 'red' | 'amber' | 'purple' | 'slate'; children: React.ReactNode }> = ({
  tone,
  children,
}) => {
  const tones: Record<string, string> = {
    green: 'bg-emerald-50 text-[#16A34A] border-emerald-100',
    red: 'bg-rose-50 text-[#E11D48] border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    purple: 'bg-[#7C3AED]/10 text-[#6D28D9] border-[#7C3AED]/15',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${tones[tone]}`}>{children}</span>
  );
};

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  balances,
  onUpdateSecurity,
  onOpenDeposit,
  onOpenWithdraw,
  onOpenSend,
  onOpenReceive,
  onSelectTab,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'overview' | 'security' | 'api' | 'wallet' | 'kyc' | 'referrals' | 'statements' | 'preferences' | 'support'
  >('overview');

  // Profile Edit State
  const [userName, setUserName] = useState(user.name);
  const [userEmail, setUserEmail] = useState(user.email);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [avatarGradient, setAvatarGradient] = useState<string>('from-[#5B21B6] via-[#7C3AED] to-[#A855F7]');

  // Security Sub-states
  const [twoFactor, setTwoFactor] = useState(user.twoFactorEnabled);
  const [pinSet, setPinSet] = useState(user.pinSet);
  const [antiPhishingCode, setAntiPhishingCode] = useState('XENA-SECURE-99');
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [strictWhitelistOnly, setStrictWhitelistOnly] = useState(true);
  const [isEmergencyLocked, setIsEmergencyLocked] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Active Sessions
  const [sessions, setSessions] = useState([
    { id: '1', device: 'Chrome on macOS (Current Device)', ip: '192.168.1.42', location: 'San Francisco, US', current: true },
    { id: '2', device: 'XENA Mobile App on iPhone 15 Pro', ip: '172.56.21.9', location: 'San Francisco, US', current: false },
    { id: '3', device: 'Firefox on Linux', ip: '104.28.19.88', location: 'London, UK', current: false },
  ]);

  // Wallet Sub-states & Address Book
  const [whitelistAddresses, setWhitelistAddresses] = useState([
    { id: '1', label: 'Hardware Ledger Nano X', address: '0x8A79c45b736b47D93bC8419D7bF892', network: 'XENA Network' },
    { id: '2', label: 'Cold Storage Vault (Trezor)', address: '0x4F129aE785C04921F38491c6eA31d4', network: 'Ethereum (ERC-20)' },
    { id: '3', label: 'Phantom Solana Vault', address: '8xK19yM...qP9L', network: 'Solana Native' },
  ]);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNetwork, setNewNetwork] = useState('XENA Network');
  const [copiedAddressId, setCopiedAddressId] = useState<string | null>(null);

  // Connected Web3 Wallets
  const [connectedWallets, setConnectedWallets] = useState([
    { id: 'metamask', name: 'MetaMask', address: '0x71c8...c741', status: 'Connected', icon: '🦊' },
    { id: 'phantom', name: 'Phantom', address: '4jK9...88aQ', status: 'Connected', icon: '👻' },
    { id: 'ledger', name: 'Ledger Hardware', address: '0x39a1...10eB', status: 'Standby', icon: '🛡️' },
  ]);

  // API Keys & Trading Bots
  const [apiKeys, setApiKeys] = useState([
    {
      id: 'api-1',
      name: 'Spot Trading Bot',
      accessKey: 'XN-8F2K9Q1Z',
      secret: 'xn9fK2qZ8vB4rT7wL1pM6cD3sH5',
      permissions: ['Read', 'Spot Trade'],
      ipWhitelist: '192.168.1.0/24',
      enabled: true,
      createdAt: 'Jan 12, 2026',
      lastUsed: '2 min ago',
    },
    {
      id: 'api-2',
      name: 'Yield Monitor (Read-Only)',
      accessKey: 'XN-1A7M3BS9',
      secret: 'xn1a7m3bS9kR4tQ2wZ6eF8gH0j',
      permissions: ['Read'],
      ipWhitelist: 'All IPs',
      enabled: true,
      createdAt: 'Mar 3, 2026',
      lastUsed: '1 hour ago',
    },
  ]);
  const [showCreateApiModal, setShowCreateApiModal] = useState(false);
  const [apiName, setApiName] = useState('');
  const [apiPermissions, setApiPermissions] = useState<Record<string, boolean>>({
    Read: true,
    'Spot Trade': false,
    P2P: false,
    Withdrawals: false,
  });
  const [apiIpWhitelist, setApiIpWhitelist] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{ name: string; accessKey: string; secret: string } | null>(null);
  const [revealedSecretId, setRevealedSecretId] = useState<string | null>(null);

  // Selected Network for Deposit QR
  const [selectedDepositNetwork, setSelectedDepositNetwork] = useState<'XENA' | 'USDT' | 'BTC' | 'ETH' | 'SOL'>('XENA');
  const [showDepositQrModal, setShowDepositQrModal] = useState(false);

  // KYC Tier Upgrade State
  const [currentKycTier, setCurrentKycTier] = useState<'Tier 1' | 'Tier 2' | 'Tier 3 (Institutional)'>(
    user.kycTier === 'Tier 2' ? 'Tier 2' : 'Tier 1'
  );
  const [kycUpgradePending, setKycUpgradePending] = useState(false);
  const [showKycUpgradeModal, setShowKycUpgradeModal] = useState(false);

  // Referral State
  const referralCode = user.referral_code || user.xena_code || 'XENA-REF';
  const referralLink = `https://www.xenaventureshq.online/signup?ref=${referralCode}`;
  const [referralStats, setReferralStats] = useState({
    totalInvited: 18,
    activeStakers: 12,
    totalEarnedXena: 145.8,
    unclaimedXena: 34.2,
    tier: 'Gold Ambassador (20% Commission)',
  });
  const [referralsList] = useState([
    { id: '1', user: 'CryptoK***@gmail.com', joined: '2 days ago', staked: '$2,400 USD', reward: '+18.4 XENA', status: 'Active' },
    { id: '2', user: 'Alex.T***@outlook.com', joined: '5 days ago', staked: '$5,000 USD', reward: '+38.5 XENA', status: 'Active' },
    { id: '3', user: '0x8892...f7a1', joined: '1 week ago', staked: '$1,200 USD', reward: '+9.2 XENA', status: 'Active' },
    { id: '4', user: 'Elena_V***@proton.me', joined: '2 weeks ago', staked: '$800 USD', reward: '+6.1 XENA', status: 'Active' },
  ]);

  // Tax & Statement Exporter State
  const [statementYear, setStatementYear] = useState('2026');
  const [statementMonth, setStatementMonth] = useState('All Year');
  const [statementFormat, setStatementFormat] = useState<'CSV' | 'PDF'>('PDF');
  const [statementDownloaded, setStatementDownloaded] = useState(false);

  // Preferences
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [tradeNotifications, setTradeNotifications] = useState(true);
  const [marketingUpdates, setMarketingUpdates] = useState(false);

  // Customer Support
  const [supportInput, setSupportInput] = useState<string>('');
  const [supportMessages, setSupportMessages] = useState<{ from: 'user' | 'agent'; text: string; time: string }[]>([
    { from: 'agent', text: 'Hi! Welcome to XENA Customer Support. How can we help you today?', time: 'Just now' },
  ]);
  const [supportBusy, setSupportBusy] = useState(false);

  useEffect(() => {
    if (!getAuthToken()) return;
    getSupportConversations().then((res) => {
      if (res.ok && res.conversations && res.conversations.length > 0) {
        const conv = res.conversations[res.conversations.length - 1];
        if (conv.messages && conv.messages.length > 0) {
          setSupportMessages(conv.messages.map((m) => ({ from: m.from, text: m.text, time: m.time })));
        }
      }
    });
  }, []);

  const spotFiat = balances.availableXena * balances.usdRate;
  const investedFiat = balances.investedXena * balances.usdRate;

  // Account Completion Checklist
  const completionItems = [
    { label: 'Email address verified', done: true, tab: 'security' as const, icon: Mail },
    { label: 'Phone number verified', done: true, tab: 'security' as const, icon: Smartphone },
    { label: 'Two-Factor Authentication enabled', done: twoFactor, tab: 'security' as const, icon: ShieldCheck },
    { label: 'Security PIN configured', done: pinSet, tab: 'security' as const, icon: Lock },
    { label: 'Withdrawal address whitelisted', done: whitelistAddresses.length > 0, tab: 'wallet' as const, icon: Wallet },
    { label: 'Identity verified (KYC Level 2+)', done: currentKycTier !== 'Tier 1', tab: 'kyc' as const, icon: Shield },
    { label: 'API key created for automation', done: apiKeys.length > 0, tab: 'api' as const, icon: KeyRound },
  ];
  const completionPct = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100);

  const cryptoAssets = [
    {
      symbol: 'XENA',
      name: 'Xena Token',
      network: 'XENA Network',
      balance: balances.availableXena,
      price: balances.currentPrice,
      value: spotFiat,
      depositAddress: '0x71c89f92d7a224a51e6074de30e0ef18d9b1c741',
      change: '+12.4%',
      isNative: true,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      network: 'TRC-20 / ERC-20',
      balance: 1450.00,
      price: 1.00,
      value: 1450.00,
      depositAddress: 'TXn87wK9...3bL20',
      change: '+0.01%',
      isNative: false,
    },
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      network: 'Native SegWit',
      balance: 0.1245,
      price: 94800.00,
      value: 11802.60,
      depositAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      change: '+3.2%',
      isNative: false,
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      network: 'ERC-20',
      balance: 1.45,
      price: 3450.00,
      value: 5002.50,
      depositAddress: '0x8A79c45b736b47D93bC8419D7bF892A847',
      change: '+4.8%',
      isNative: false,
    },
    {
      symbol: 'SOL',
      name: 'Solana',
      network: 'Solana Native',
      balance: 14.8,
      price: 188.40,
      value: 2788.32,
      depositAddress: '8xK19yMQp9L...zR38w',
      change: '+8.1%',
      isNative: false,
    },
  ];

  const handleToggle2FA = () => {
    const next = !twoFactor;
    setTwoFactor(next);
    onUpdateSecurity({ twoFactor: next, pinSet });
    setSavedNotice(next ? 'Two-Factor Authentication (2FA) is now enabled.' : '2FA has been disabled.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleTogglePIN = () => {
    const next = !pinSet;
    setPinSet(next);
    onUpdateSecurity({ twoFactor, pinSet: next });
    setSavedNotice(next ? '6-Digit Security PIN protection enabled.' : 'Security PIN removed.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleSaveAntiPhishing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode) return;
    setAntiPhishingCode(newCode);
    setIsEditingCode(false);
    setNewCode('');
    setSavedNotice('Anti-phishing security phrase updated.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleRevokeSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setSavedNotice('Session revoked and logged out successfully.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleAddWhitelist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel || !newAddress) return;
    setWhitelistAddresses((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        label: newLabel,
        address: newAddress,
        network: newNetwork,
      },
    ]);
    setNewLabel('');
    setNewAddress('');
    setShowAddAddress(false);
    setSavedNotice('New withdrawal whitelist destination saved securely.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleDeleteWhitelist = (id: string) => {
    setWhitelistAddresses((prev) => prev.filter((a) => a.id !== id));
    setSavedNotice('Whitelist entry deleted.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddressId(id);
    setTimeout(() => setCopiedAddressId(null), 2000);
  };

  const handleToggleWalletConnect = (id: string) => {
    setConnectedWallets((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, status: w.status === 'Connected' ? 'Disconnected' : 'Connected' }
          : w
      )
    );
    setSavedNotice('Web3 wallet connection status updated.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleCreateApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiName.trim()) return;
    const perms = Object.keys(apiPermissions).filter((p) => apiPermissions[p]);
    if (perms.length === 0) {
      setSavedNotice('Select at least one permission for your API key.');
      setTimeout(() => setSavedNotice(null), 3000);
      return;
    }
    const accessKey = `XN-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const secret = `xn${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 8)}`;
    const newKey = {
      id: `api-${Date.now()}`,
      name: apiName.trim(),
      accessKey,
      secret,
      permissions: perms,
      ipWhitelist: apiIpWhitelist.trim() || 'All IPs',
      enabled: true,
      createdAt: 'Just now',
      lastUsed: 'Never',
    };
    setApiKeys((prev) => [newKey, ...prev]);
    setShowCreateApiModal(false);
    setApiName('');
    setApiPermissions({ Read: true, 'Spot Trade': false, P2P: false, Withdrawals: false });
    setApiIpWhitelist('');
    setNewlyCreatedKey({ name: newKey.name, accessKey: newKey.accessKey, secret: newKey.secret });
  };

  const handleToggleApiKey = (id: string) => {
    setApiKeys((prev) =>
      prev.map((k) =>
        k.id === id ? { ...k, enabled: !k.enabled, lastUsed: !k.enabled ? 'Just now' : k.lastUsed } : k
      )
    );
    setSavedNotice('API key status updated.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleDeleteApiKey = (id: string) => {
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
    setSavedNotice('API key revoked and deleted permanently.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleClaimReferralRewards = () => {
    if (referralStats.unclaimedXena <= 0) return;
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#7C3AED', '#A855F7', '#10B981'],
      });
    } catch {}
    setReferralStats((prev) => ({
      ...prev,
      totalEarnedXena: +(prev.totalEarnedXena + prev.unclaimedXena).toFixed(2),
      unclaimedXena: 0,
    }));
    setSavedNotice('Successfully claimed affiliate commissions directly to spot balance!');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleDownloadStatement = () => {
    setStatementDownloaded(true);
    setSavedNotice(`Generating and downloading ${statementFormat} official account statement for ${statementMonth} ${statementYear}...`);
    setTimeout(() => {
      setStatementDownloaded(false);
      setSavedNotice(null);
    }, 4000);
  };

  const handleSimulateKycUpgrade = () => {
    setKycUpgradePending(true);
    setTimeout(() => {
      setKycUpgradePending(false);
      setCurrentKycTier('Tier 3 (Institutional)');
      setShowKycUpgradeModal(false);
      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#7C3AED', '#10B981', '#3B82F6'],
        });
      } catch {}
      setSavedNotice('Congratulations! Your Tier 3 Institutional Verification is now active with unlimited withdrawal limits.');
      setTimeout(() => setSavedNotice(null), 4000);
    }, 2000);
  };

  const handleEmergencyLockdown = () => {
    setIsEmergencyLocked(true);
    setShowFreezeModal(false);
    setSavedNotice('EMERGENCY LOCKDOWN ACTIVATED: All withdrawals and API keys are frozen until identity re-verification.');
    setTimeout(() => setSavedNotice(null), 5000);
  };

  const handleUnlockAccount = () => {
    setIsEmergencyLocked(false);
    setSavedNotice('Security lockdown lifted. Account restored to normal operation.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleSendSupport = async () => {
    const text = supportInput.trim();
    if (!text) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSupportMessages((prev) => [...prev, { from: 'user', text, time: now }]);
    setSupportInput('');
    if (!getAuthToken()) {
      setTimeout(() => {
        setSupportMessages((prev) => [
          ...prev,
          { from: 'agent', text: 'Thanks for your message! A support specialist will review this and reply shortly. For urgent issues, please call our 24/7 line.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        ]);
      }, 1000);
      return;
    }
    setSupportBusy(true);
    const res = await sendSupportMessage(text);
    setSupportBusy(false);
    if (res.ok && res.conversation) {
      setSupportMessages(res.conversation.messages.map((m) => ({ from: m.from, text: m.text, time: m.time })));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-8 animate-fade-in" id="profile-page-view">
      {/* Emergency Freeze Banner if Active */}
      {isEmergencyLocked && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-red-950">Account Emergency Lockdown Active</h4>
              <p className="text-xs text-red-700">Withdrawals, transfers, and API keys are temporarily suspended for protection.</p>
            </div>
          </div>
          <button
            onClick={handleUnlockAccount}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
          >
            Unlock with 2FA Passcode
          </button>
        </div>
      )}

      {/* 1. Profile Header Hero Card */}
      <div className="bg-gradient-to-br from-[#1E1B4B] via-[#6D28D9] to-[#DB2777] rounded-[24px] p-6 sm:p-8 text-white shadow-lg shadow-purple-200/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#F59E0B]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-56 h-56 bg-[#22D3EE]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 left-10 w-40 h-40 bg-[#F0ABFC]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* User Identity Info */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="relative group">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br ${avatarGradient} ring-4 ring-white/30 text-white flex items-center justify-center font-extrabold text-2xl shadow-lg transition-transform group-hover:scale-105`}>
                {userName.split(' ').map((n) => n[0]).join('')}
              </div>
              <button
                onClick={() => setIsEditingProfile(true)}
                className="absolute -bottom-1 -right-1 p-1.5 bg-white text-[#6D28D9] rounded-full ring-4 ring-[#6D28D9] shadow-xs hover:bg-purple-50 transition-colors cursor-pointer"
                title="Edit Profile & Avatar"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                  {userName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-white text-xs font-bold border border-white/25 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {currentKycTier}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold border border-amber-300/40 flex items-center gap-1 shadow-sm">
                  <Award className="w-3 h-3" />
                  Gold Partner
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-purple-200">
                <span>Email: <strong className="text-white">{userEmail}</strong></span>
                <span>•</span>
                <span>User ID: <strong className="text-amber-300 font-mono">{user.xenaId}</strong></span>
                <span>•</span>
                <span>Affiliate Ref: <strong className="text-white font-mono">{referralCode}</strong></span>
              </div>
            </div>
          </div>

            <button
              onClick={() => setShowFreezeModal(true)}
              className="px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-red-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer backdrop-blur shrink-0 self-start sm:self-center"
              title="Emergency 1-Click Lockdown"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Emergency Freeze</span>
            </button>
        </div>

        {savedNotice && (
          <div className="relative z-10 mt-4 p-3 rounded-xl bg-white/15 border border-white/25 text-white text-xs font-bold flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 stroke-[3] text-emerald-300" />
            <span>{savedNotice}</span>
          </div>
        )}
      </div>

      {/* 2. Navigation List + Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Left: Vertical List */}
        <div className="md:col-span-3 bg-white border border-[#EDE9FE] rounded-[20px] p-2 shadow-sm md:sticky md:top-20">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible scrollbar-none md:p-1">
            {[
              { id: 'overview', label: 'Overview', icon: User },
              { id: 'security', label: 'Security & Auth', icon: ShieldCheck },
              { id: 'api', label: 'API Keys', icon: KeyRound },
              { id: 'wallet', label: 'Wallet & Addresses', icon: Wallet },
              { id: 'kyc', label: 'KYC & Limits', icon: Shield },
              { id: 'referrals', label: 'Affiliate & Referrals', icon: Users },
              { id: 'statements', label: 'Tax & Statements', icon: FileText },
              { id: 'preferences', label: 'Preferences', icon: Sliders },
              { id: 'support', label: 'Customer Support', icon: Headphones },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex-1 md:flex-none ${
                    isActive
                      ? 'bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white shadow-md shadow-fuchsia-200/50'
                      : 'text-[#6B7280] hover:text-[#171717] hover:bg-[#F8F7FC]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                  {isActive && <span className="ml-auto hidden md:block w-1.5 h-1.5 rounded-full bg-white" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Content */}
        <div className="md:col-span-9 space-y-5">

      {/* 3. Tab Contents */}

      {/* TAB A: OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div className="space-y-4 animate-fade-in">
          <ProfileSection title="Identity & KYC Level">
            <ProfileRow
              icon={ShieldCheck}
              label="Account Status"
              trailing={
                <StatusChip
                  tone={
                    user.status === 'Frozen' ? 'red' :
                    user.status === 'Banned' ? 'red' :
                    user.status === 'Pending KYC' ? 'amber' : 'green'
                  }
                >
                  {user.status}
                </StatusChip>
              }
              chevron={false}
            />
            <ProfileRow
              icon={ShieldCheck}
              label="Daily Withdrawal Limit"
              trailing={
                <span className="font-mono text-xs font-bold text-[#171717]">
                  {currentKycTier === 'Tier 3 (Institutional)' ? 'Unlimited / 24h' : '$100,000 / 24h'}
                </span>
              }
              chevron={false}
              onClick={() => setActiveSubTab('kyc')}
            />
            <ProfileRow
              icon={Shield}
              label="Crypto Deposit Limits"
              trailing={<StatusChip tone="green">Unlimited</StatusChip>}
              chevron={false}
            />
            <ProfileRow
              icon={ArrowRightLeft}
              label="P2P Trading Access"
              trailing={<StatusChip tone="green">Active & Verified</StatusChip>}
              chevron={false}
            />
            <ProfileRow
              icon={CheckCircle2}
              label="Government ID Status"
              trailing={<StatusChip tone="green">Approved</StatusChip>}
              chevron={false}
            />
          </ProfileSection>

          <ProfileSection title="Balance & Funds">
            <ProfileRow
              icon={Wallet}
              label="Spot Liquid Funds"
              trailing={<span className="font-mono text-xs font-bold text-[#171717]">${spotFiat.toFixed(2)}</span>}
              chevron={false}
            />
            <ProfileRow
              icon={TrendingUp}
              label="Staked In Yield Vaults"
              trailing={<span className="font-mono text-xs font-bold text-[#6D28D9]">${investedFiat.toFixed(2)}</span>}
              chevron={false}
            />
            <ProfileRow
              icon={Layers}
              label="Active Staking Plans"
              trailing={<StatusChip tone="green">4 Plans</StatusChip>}
              chevron={false}
            />
            <ProfileRow
              icon={DollarSign}
              label="XENA Unit Price"
              trailing={<span className="font-mono text-xs font-bold text-[#171717]">${balances.currentPrice.toFixed(4)}</span>}
              chevron={false}
            />
          </ProfileSection>

          <ProfileSection title="Quick Shortcuts">
            <ProfileRow icon={ArrowDownRight} label="Deposit Funds" hint="Top up your spot balance" onClick={onOpenDeposit} />
            <ProfileRow icon={ArrowUpRight} label="Withdraw Funds" hint="Send to external wallet" onClick={onOpenWithdraw} />
            <ProfileRow icon={Share2} label="Invite Friends & Earn 20%" hint="Grow your network" onClick={() => setActiveSubTab('referrals')} iconTone="bg-fuchsia-50 text-[#DB2777]" />
          </ProfileSection>

          <ProfileSection title={`Account Completion · ${completionPct}%`}>
            {completionItems.map((item) => {
              const Icon = item.icon;
              return (
                <ProfileRow
                  key={item.label}
                  icon={item.done ? Check : Icon}
                  label={item.label}
                  iconTone={item.done ? 'bg-emerald-50 text-[#16A34A]' : 'bg-amber-50 text-amber-500'}
                  chevron={false}
                  trailing={
                    item.done ? (
                      <StatusChip tone="green">Done</StatusChip>
                    ) : (
                      <StatusChip tone="amber">Pending</StatusChip>
                    )
                  }
                  onClick={() => setActiveSubTab(item.tab)}
                />
              );
            })}
          </ProfileSection>
        </div>
      )}

      {/* TAB B: SECURITY MENU */}
      {activeSubTab === 'security' && (
        <div className="space-y-4 animate-fade-in">
          <ProfileSection title="Authentication">
            <ProfileRow
              icon={Smartphone}
              label="Two-Factor Authentication (2FA)"
              hint="Google Authenticator / Authy / TOTP App"
              chevron={false}
              indicator={
                twoFactor ? <StatusChip tone="green">Enforced</StatusChip> : <StatusChip tone="red">Off</StatusChip>
              }
              trailing={
                <button
                  onClick={handleToggle2FA}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer ${
                    twoFactor
                      ? 'bg-rose-50 text-[#E11D48] border border-rose-100 hover:bg-rose-100'
                      : 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-xs hover:opacity-90'
                  }`}
                >
                  {twoFactor ? 'Disable' : 'Enable'}
                </button>
              }
            />
            <ProfileRow
              icon={Lock}
              label="Quick Trading & Withdrawal PIN"
              hint="Biometric & 6-digit cryptographic passcode"
              chevron={false}
              indicator={
                pinSet ? <StatusChip tone="green">Configured</StatusChip> : <StatusChip tone="amber">Not Set</StatusChip>
              }
              trailing={
                <button
                  onClick={handleTogglePIN}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-[#F8F7FC] text-[#171717] border border-[#EDE9FE] hover:bg-[#EDE9FE] transition-colors cursor-pointer"
                >
                  {pinSet ? 'Change PIN' : 'Setup PIN'}
                </button>
              }
            />
            <ProfileRow
              icon={Key}
              label="Anti-Phishing Anti-Spoof Code"
              hint={`Current code: ${antiPhishingCode}`}
              chevron={false}
              trailing={
                isEditingCode ? (
                  <form onSubmit={handleSaveAntiPhishing} className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="text"
                      placeholder="New code..."
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      className="w-28 bg-[#F8F7FC] border border-[#EDE9FE] rounded-lg px-2 py-1.5 text-[11px] text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
                    />
                    <button type="submit" className="px-2.5 py-1.5 rounded-lg bg-[#6D28D9] text-white text-[11px] font-bold cursor-pointer">Save</button>
                    <button type="button" onClick={() => setIsEditingCode(false)} className="px-2 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold cursor-pointer">X</button>
                  </form>
                ) : (
                  <button
                    onClick={() => setIsEditingCode(true)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-[#F8F7FC] text-[#171717] border border-[#EDE9FE] hover:bg-[#EDE9FE] transition-colors cursor-pointer"
                  >
                    Update
                  </button>
                )
              }
            />
            <ProfileRow
              icon={Shield}
              label="Strict Address Whitelist Mode"
              hint="Block withdrawals to unregistered addresses"
              chevron={false}
              trailing={
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={strictWhitelistOnly}
                    onChange={(e) => setStrictWhitelistOnly(e.target.checked)}
                    className="sr-only"
                  />
                  <span className={`w-11 h-6 rounded-full transition-colors ${strictWhitelistOnly ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7]' : 'bg-[#E5E0EE]'}`}>
                    <span className={`block w-5 h-5 bg-white rounded-full shadow transform transition-transform ${strictWhitelistOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </span>
                </label>
              }
            />
          </ProfileSection>

          <ProfileSection title={`Active Login Sessions · ${sessions.length}`}>
            {sessions.map((session) => (
              <ProfileRow
                key={session.id}
                icon={Globe}
                label={session.device}
                hint={`IP: ${session.ip} · ${session.location}`}
                chevron={false}
                indicator={
                  session.current ? <StatusChip tone="green">Current</StatusChip> : undefined
                }
                trailing={
                  !session.current ? (
                    <button
                      onClick={() => handleRevokeSession(session.id)}
                      className="shrink-0 px-3 py-1 rounded-lg text-[11px] font-bold text-[#E11D48] border border-rose-100 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      Revoke
                    </button>
                  ) : undefined
                }
              />
            ))}
            <button
              onClick={() => {
                setSessions((prev) => prev.filter((s) => s.current));
                setSavedNotice('All other background sessions have been logged out.');
                setTimeout(() => setSavedNotice(null), 3000);
              }}
              className="w-full py-3 text-[11px] font-extrabold text-[#E11D48] hover:bg-rose-50 transition-colors cursor-pointer"
            >
              Revoke All Other Sessions
            </button>
          </ProfileSection>
        </div>
      )}

      {/* TAB C: API KEYS & TRADING BOTS */}
      {activeSubTab === 'api' && (
        <div className="space-y-4 animate-fade-in">
          <button
            onClick={() => setShowCreateApiModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            <span className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </span>
            <span className="flex-1 text-left">
              <span className="block text-[13px] font-extrabold">Create API Key</span>
              <span className="block text-[11px] opacity-80">Connect trading bots & institutional systems</span>
            </span>
            <ChevronRight className="w-4 h-4 opacity-80" />
          </button>

          <ProfileSection title={`Your API Keys · ${apiKeys.length}`}>
            {apiKeys.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-[#9CA3AF]">
                <KeyRound className="w-8 h-8 text-[#D1C9E3] mx-auto mb-2" />
                No API keys yet. Create your first key to automate trading.
              </div>
            )}
            {apiKeys.map((key) => {
              const revealed = revealedSecretId === key.id;
              return (
                <div key={key.id} className="px-4 py-3 divide-y divide-[#F1EDF9]">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center border ${key.enabled ? 'bg-purple-50 text-[#6D28D9] border-purple-100' : 'bg-slate-100 text-slate-400 border-[#EDE9FE]'}`}>
                      <Wrench className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-[#171717]">{key.name}</span>
                        {key.enabled ? <StatusChip tone="green">Enabled</StatusChip> : <StatusChip tone="slate">Disabled</StatusChip>}
                      </div>
                      <span className="text-[11px] text-[#6B7280] font-mono">Access Key: <strong className="text-[#171717]">{key.accessKey}</strong></span>
                    </div>
                  </div>

                  {revealed && (
                    <div className="py-2.5 mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-amber-50/70 border border-amber-200 px-2.5 animate-fade-in">
                      <code className="font-mono text-[11px] font-bold text-amber-800 truncate">{key.secret}</code>
                      <button onClick={() => handleCopyText(key.secret, `secret-${key.id}`)} className="p-1.5 rounded-lg bg-white text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer shrink-0">
                        {copiedAddressId === `secret-${key.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}

                  <div className="py-2.5 mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[#6B7280]">
                    {key.permissions.map((perm) => (
                      <span key={perm} className={`px-2 py-0.5 rounded-full font-bold border ${
                        perm === 'Withdrawals' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-purple-50 text-[#6D28D9] border-purple-100'
                      }`}>
                        {perm}
                      </span>
                    ))}
                  </div>

                  <div className="pt-2.5 mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-[#6B7280]">IP <strong className="text-[#171717] font-mono">{key.ipWhitelist}</strong></span>
                    <span className="text-[10px] text-[#6B7280]">Created <strong className="text-[#171717]">{key.createdAt}</strong></span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          if (revealed) { setRevealedSecretId(null); }
                          else { setRevealedSecretId(key.id); setSavedNotice('API secret revealed. Never share this value.'); setTimeout(() => setSavedNotice(null), 3000); }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${revealed ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-white text-[#6B7280] border border-[#EDE9FE] hover:text-[#171717]'}`}
                      >
                        {revealed ? 'Hide Secret' : 'Secret'}
                      </button>
                      <button
                        onClick={() => handleCopyText(key.accessKey, `key-${key.id}`)}
                        className="p-1.5 rounded-lg bg-white text-[#6D28D9] border border-[#EDE9FE] hover:bg-purple-50 cursor-pointer"
                        title="Copy Access Key"
                      >
                        {copiedAddressId === `key-${key.id}` ? <Check className="w-3 h-3 text-[#16A34A]" /> : <Copy className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => handleToggleApiKey(key.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer flex items-center gap-1 ${key.enabled ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' : 'bg-emerald-50 text-[#16A34A] border border-emerald-100 hover:bg-emerald-100'}`}
                      >
                        <Power className="w-3 h-3" /> {key.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleDeleteApiKey(key.id)}
                        className="p-1.5 rounded-lg bg-white text-red-600 border border-red-100 hover:bg-red-50 cursor-pointer"
                        title="Delete API Key"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </ProfileSection>

          <ProfileRow
            icon={AlertTriangle}
            label="API Security Notice"
            hint="Secrets are shown once and can never be recovered. Withdrawals require separate 2FA."
            chevron={false}
            iconTone="bg-amber-50 text-amber-600"
          />
        </div>
      )}

      {/* TAB D: WALLET & ADDRESSES */}
      {activeSubTab === 'wallet' && (
        <div className="space-y-4 animate-fade-in">
          <button
            onClick={() => setShowDepositQrModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            <span className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </span>
            <span className="flex-1 text-left">
              <span className="block text-[13px] font-extrabold">Receive Address QR</span>
              <span className="block text-[11px] opacity-80">Scan to deposit across supported chains</span>
            </span>
            <ChevronRight className="w-4 h-4 opacity-80" />
          </button>

          <ProfileSection title="Multi-Chain Crypto Assets">
            {cryptoAssets.map((asset) => (
              <div key={asset.symbol} className="px-4 py-3 flex items-center gap-3">
                <span className="w-9 h-9 shrink-0 rounded-xl bg-[#F8F7FC] border border-[#EDE9FE] flex items-center justify-center font-extrabold text-xs text-[#6D28D9]">
                  {asset.symbol[0]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-[#171717]">{asset.symbol}</span>
                    <span className="text-[10px] text-[#6B7280] truncate">{asset.name} · {asset.network}</span>
                  </div>
                  <div className="text-[11px] text-[#6B7280]">
                    <span className="font-mono font-bold text-[#171717]">{asset.balance.toLocaleString()} {asset.symbol}</span>
                    {' '}· ≈ ${asset.value.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#16A34A] shrink-0">{asset.change}</span>
                <button
                  onClick={() => { setSelectedDepositNetwork(asset.symbol as any); setShowDepositQrModal(true); }}
                  className="shrink-0 p-1.5 rounded-lg bg-white text-[#6D28D9] border border-[#EDE9FE] hover:bg-purple-50 cursor-pointer"
                  title="QR Code"
                >
                  <QrCode className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleCopyText(asset.depositAddress, asset.symbol)}
                  className="shrink-0 p-1.5 rounded-lg bg-white text-[#6D28D9] border border-[#EDE9FE] hover:bg-purple-50 cursor-pointer"
                  title="Copy Address"
                >
                  {copiedAddressId === asset.symbol ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </ProfileSection>

          <ProfileSection title="Connected Web3 Wallets">
            {connectedWallets.map((wallet) => (
              <ProfileRow
                key={wallet.id}
                icon={Wallet}
                label={wallet.name}
                hint={wallet.address}
                chevron={false}
                iconTone="bg-[#F8F7FC] text-[#6D28D9]"
                indicator={
                  wallet.status === 'Connected' ? <StatusChip tone="green">Connected</StatusChip> : <StatusChip tone="slate">Standby</StatusChip>
                }
                trailing={
                  <button
                    onClick={() => handleToggleWalletConnect(wallet.id)}
                    className={`shrink-0 px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      wallet.status === 'Connected'
                        ? 'bg-white text-[#6B7280] border border-[#EDE9FE] hover:text-[#E11D48] hover:border-rose-100'
                        : 'bg-white text-[#6B7280] border border-[#EDE9FE] hover:text-[#171717]'
                    }`}
                  >
                    {wallet.status === 'Connected' ? 'Disconnect' : 'Connect'}
                  </button>
                }
              />
            ))}
          </ProfileSection>

          <ProfileSection title="Saved Withdrawal Whitelist">
            <button
              onClick={() => setShowAddAddress(!showAddAddress)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#FAF8FF] transition-colors cursor-pointer"
            >
              <span className="w-9 h-9 shrink-0 rounded-xl bg-[#6D28D9]/10 text-[#6D28D9] flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </span>
              <span className="flex-1">
                <span className="block text-[13px] font-bold text-[#6D28D9]">Add Whitelist Address</span>
                <span className="block text-[11px] text-[#9CA3AF]">Save an approved destination for fast transfers</span>
              </span>
              <ChevronRight className="w-4 h-4 text-[#CBD5E1]" />
            </button>

            {showAddAddress && (
              <form onSubmit={handleAddWhitelist} className="px-4 py-3 space-y-3 animate-fade-in border-t border-[#F1EDF9]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input type="text" placeholder="Label / Device Name" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} required
                    className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]" />
                  <select value={newNetwork} onChange={(e) => setNewNetwork(e.target.value)}
                    className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]">
                    <option value="XENA Network">XENA Network (Native)</option>
                    <option value="Ethereum (ERC-20)">Ethereum (ERC-20)</option>
                    <option value="TRC-20 (Tron)">TRC-20 (Tron)</option>
                    <option value="Solana Native">Solana Native</option>
                    <option value="Bitcoin Native">Bitcoin Native</option>
                  </select>
                  <input type="text" placeholder="0x... or bc1..." value={newAddress} onChange={(e) => setNewAddress(e.target.value)} required
                    className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-mono text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]" />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowAddAddress(false)} className="px-4 py-1.5 rounded-xl bg-white border border-[#EDE9FE] text-xs font-bold text-[#6B7280] cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-1.5 rounded-xl bg-[#6D28D9] text-white text-xs font-bold cursor-pointer">Save to Whitelist</button>
                </div>
              </form>
            )}

            {whitelistAddresses.map((addr) => (
              <ProfileRow
                key={addr.id}
                icon={Wallet}
                label={addr.label}
                hint={addr.address}
                chevron={false}
                iconTone="bg-[#F8F7FC] text-[#6D28D9]"
                indicator={<span className="text-[10px] font-bold text-[#6D28D9] bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">{addr.network}</span>}
                trailing={
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => handleCopyText(addr.address, addr.id)} className="p-1.5 rounded-lg bg-white text-[#6D28D9] border border-[#EDE9FE] hover:bg-purple-50 cursor-pointer" title="Copy">
                      {copiedAddressId === addr.id ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => handleDeleteWhitelist(addr.id)} className="p-1.5 rounded-lg bg-white text-red-600 border border-red-100 hover:bg-red-50 cursor-pointer" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                }
              />
            ))}
          </ProfileSection>
        </div>
      )}

      {/* TAB D: KYC & LIMITS HUB */}
      {activeSubTab === 'kyc' && (
        <div className="space-y-4 animate-fade-in">
          <ProfileRow
            icon={Shield}
            label={`Current Tier · ${currentKycTier}`}
            hint="ID & Biometrics Verified · Unlock higher limits, OTC access & priority settlement"
            chevron={false}
            indicator={<StatusChip tone="green">Verified</StatusChip>}
          />
          {currentKycTier !== 'Tier 3 (Institutional)' && (
            <button
              onClick={() => setShowKycUpgradeModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <span className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="flex-1 text-left">
                <span className="block text-[13px] font-extrabold">Upgrade to Tier 3 (Institutional)</span>
                <span className="block text-[11px] opacity-80">Unlimited daily withdrawals & OTC concierge</span>
              </span>
              <ChevronRight className="w-4 h-4 opacity-80" />
            </button>
          )}

          <ProfileSection title="Tier 1 (Basic)">
            <ProfileRow icon={CheckCircle2} label="Email & Phone verification" chevron={false} iconTone="bg-emerald-50 text-[#16A34A]" indicator={<StatusChip tone="green">Done</StatusChip>} />
            <ProfileRow icon={DollarSign} label="Daily limit" trailing={<span className="text-xs font-bold text-[#171717]">$2,000 USD</span>} chevron={false} />
            <ProfileRow icon={ArrowRightLeft} label="P2P Trading Access" chevron={false} indicator={<StatusChip tone="green">Done</StatusChip>} />
          </ProfileSection>

          <ProfileSection title="Tier 2 (Verified Standard)">
            <ProfileRow icon={Shield} label="Government Photo ID + Facial Liveness" chevron={false} iconTone="bg-emerald-50 text-[#16A34A]" indicator={<StatusChip tone="green">Done</StatusChip>} />
            <ProfileRow icon={DollarSign} label="Daily limit" trailing={<span className="text-xs font-bold text-[#171717]">$100,000 USD / 24h</span>} chevron={false} />
            <ProfileRow icon={Layers} label="Staking & Yield Vaults unlocked" chevron={false} iconTone="bg-emerald-50 text-[#16A34A]" indicator={<StatusChip tone="green">Done</StatusChip>} />
            <ProfileRow icon={Users} label="Full P2P Merchant privileges" chevron={false} iconTone="bg-emerald-50 text-[#16A34A]" indicator={currentKycTier === 'Tier 1' ? <StatusChip tone="amber">Pending</StatusChip> : <StatusChip tone="green">Done</StatusChip>} />
          </ProfileSection>

          <ProfileSection title="Tier 3 (Institutional)">
            <ProfileRow icon={FileText} label="Proof of Address & Source of Funds" chevron={false} indicator={currentKycTier === 'Tier 3 (Institutional)' ? <StatusChip tone="green">Done</StatusChip> : <StatusChip tone="amber">Pending</StatusChip>} />
            <ProfileRow icon={DollarSign} label="Daily withdrawals" trailing={<span className="text-xs font-bold text-[#6D28D9]">Unlimited</span>} chevron={false} />
            <ProfileRow icon={Award} label="Dedicated OTC Institutional Concierge" chevron={false} indicator={<StatusChip tone="purple">Premium</StatusChip>} />
          </ProfileSection>
        </div>
      )}

      {/* TAB E: AFFILIATE & REFERRALS HUB */}
      {activeSubTab === 'referrals' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-gradient-to-r from-[#5B21B6] via-[#7C3AED] to-[#A855F7] text-white rounded-[16px] p-5 text-white relative overflow-hidden">
            <div className="relative z-10">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-extrabold">{referralStats.tier}</span>
              <h2 className="text-lg font-extrabold mt-2">Earn 20% Lifetime Staking & Trade Commissions</h2>
              <p className="text-[11px] text-purple-100 mt-1">Share your link — friends stake in vaults or trade on P2P, you earn XENA instantly.</p>
              <div className="mt-3 flex items-center gap-2 justify-between">
                <div>
                  <span className="text-[10px] text-purple-200 block">Unclaimed Commission</span>
                  <span className="text-xl font-black font-mono">{referralStats.unclaimedXena} XENA</span>
                </div>
                <button
                  onClick={handleClaimReferralRewards}
                  disabled={referralStats.unclaimedXena <= 0}
                  className="px-4 py-2 rounded-lg bg-white text-[#6D28D9] font-extrabold text-[11px] hover:bg-purple-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                >
                  Claim to Wallet
                </button>
              </div>
            </div>
          </div>

          <ProfileSection title="Share & Earn">
            <div className="p-4 bg-white/50 rounded-xl border border-[#EDE9FE] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE]">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white flex items-center justify-center shrink-0">
                  <Share2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#6B7280] tracking-wide uppercase">Your Referral Link</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="font-mono text-sm font-bold text-[#171717] truncate">{referralLink}</span>
                    <button onClick={() => handleCopyText(referralLink, 'ref-link')} className="shrink-0 px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white rounded-lg hover:opacity-90 transition-all cursor-pointer">
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy Link
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE]">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white flex items-center justify-center shrink-0">
                  <BadgePercent className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#6B7280] tracking-wide uppercase">Your Referral Code</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="font-mono text-sm font-bold text-[#171717] tracking-widest bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">{referralCode}</span>
                    <button onClick={() => handleCopyText(referralCode, 'ref-code')} className="shrink-0 px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white rounded-lg hover:opacity-90 transition-all cursor-pointer">
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy Code
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </ProfileSection>

          <ProfileSection title="Commission Stats">
            <ProfileRow icon={Users} label="Invited Friends" trailing={<span className="text-xs font-extrabold text-[#171717]">{referralStats.totalInvited} Traders</span>} chevron={false} />
            <ProfileRow icon={Flame} label="Active Stakers" trailing={<span className="text-xs font-extrabold text-[#16A34A]">{referralStats.activeStakers} Active</span>} chevron={false} />
            <ProfileRow icon={TrendingUp} label="Total Commission Earned" trailing={<span className="text-xs font-extrabold font-mono text-[#6D28D9]">{referralStats.totalEarnedXena} XENA</span>} chevron={false} />
            <ProfileRow icon={BadgePercent} label="Commission Rate" trailing={<span className="text-xs font-extrabold text-[#171717]">20% Tier</span>} chevron={false} />
          </ProfileSection>

          <ProfileSection title="Recent Friend Activity & Payouts">
            {referralsList.map((ref) => (
              <ProfileRow
                key={ref.id}
                icon={Users}
                label={ref.user}
                hint={`Joined ${ref.joined} · Staked: ${ref.staked}`}
                chevron={false}
                trailing={<span className="text-right"><span className="block text-xs font-bold text-[#16A34A]">{ref.reward}</span><span className="block text-[10px] text-[#6D28D9] font-semibold">{ref.status}</span></span>}
              />
            ))}
          </ProfileSection>
        </div>
      )}

      {/* TAB F: TAX & ACCOUNT STATEMENTS */}
      {activeSubTab === 'statements' && (
        <div className="space-y-4 animate-fade-in">
          <ProfileRow
            icon={FileText}
            label="Financial & Tax Statements Exporter"
            hint="Generate official stamped trade history, yield records & audit proofs"
            chevron={false}
            iconTone="bg-purple-50 text-[#6D28D9]"
          />

          <ProfileSection title="Statement Options">
            <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#6B7280] w-32 shrink-0">Fiscal Year</span>
              <select value={statementYear} onChange={(e) => setStatementYear(e.target.value)}
                className="flex-1 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-bold text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] cursor-pointer">
                <option value="2026">2026 (Current Fiscal Year)</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>
            <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#6B7280] w-32 shrink-0">Period Range</span>
              <select value={statementMonth} onChange={(e) => setStatementMonth(e.target.value)}
                className="flex-1 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-bold text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#6D28D9] cursor-pointer">
                <option value="All Year">Entire Fiscal Year (12 Months)</option>
                <option value="Q1">Q1 (Jan - Mar)</option>
                <option value="Q2">Q2 (Apr - Jun)</option>
                <option value="Q3">Q3 (Jul - Sep)</option>
                <option value="Q4">Q4 (Oct - Dec)</option>
                <option value="Last 30 Days">Last 30 Days</option>
              </select>
            </div>
            <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#6B7280] w-32 shrink-0">Document Format</span>
              <div className="flex bg-[#F8F7FC] rounded-xl border border-[#EDE9FE] p-1">
                {(['PDF', 'CSV'] as const).map((fmt) => (
                  <button key={fmt} onClick={() => setStatementFormat(fmt)}
                    className={`px-4 py-1 text-xs font-bold rounded-lg cursor-pointer transition-colors ${statementFormat === fmt ? 'bg-[#6D28D9] text-white' : 'text-[#6B7280] hover:text-[#171717]'}`}>
                    {fmt}
                  </button>
                ))}
              </div>
            </div>
            <ProfileRow
              icon={CheckCircle2}
              label="Includes Staking Yields, P2P Invoices, Spot Swaps, Deposit/Withdrawal Hashes"
              chevron={false}
              iconTone="bg-emerald-50 text-[#16A34A]"
            />
          </ProfileSection>

          <button
            onClick={handleDownloadStatement}
            disabled={statementDownloaded}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-[16px] bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-bold text-[13px] hover:opacity-95 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{statementDownloaded ? 'Downloading...' : `Download ${statementFormat} Statement`}</span>
          </button>
        </div>
      )}

      {/* TAB G: PREFERENCES */}
      {activeSubTab === 'preferences' && (
        <div className="space-y-4 animate-fade-in">
          <ProfileSection title="Account Settings & Preferences">
            <div className="px-4 py-3 flex items-center gap-3">
              <span className="w-9 h-9 shrink-0 rounded-xl bg-[#6D28D9]/10 text-[#6D28D9] flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <span className="block text-[13px] font-bold text-[#171717]">Display Currency</span>
                <span className="block text-[11px] text-[#9CA3AF]">All fiat approximations and portfolio values</span>
              </div>
              <div className="flex bg-[#F8F7FC] rounded-xl border border-[#EDE9FE] p-1 shrink-0">
                {(['USD', 'EUR', 'GBP'] as const).map((cur) => (
                  <button
                    key={cur}
                    onClick={() => { setCurrency(cur); setSavedNotice(`Currency set to ${cur}`); setTimeout(() => setSavedNotice(null), 2000); }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-colors ${currency === cur ? 'bg-[#6D28D9] text-white' : 'text-[#6B7280] hover:text-[#171717]'}`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>

            <PrefToggle label="Email Security Alerts" hint="Instant email notices on login or password change" checked={emailAlerts} onChange={setEmailAlerts} />
            <PrefToggle label="Trade & Staking Yield Notifications" hint="Daily summary of staking yields earned from vaults" checked={tradeNotifications} onChange={setTradeNotifications} />
            <PrefToggle label="Marketing & Ecosystem Announcements" hint="New yield vault releases and market insights" checked={marketingUpdates} onChange={setMarketingUpdates} />
          </ProfileSection>
        </div>
      )}

      {/* ============ CUSTOMER SUPPORT ============ */}
      {activeSubTab === 'support' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white border border-[#EDE9FE] rounded-[20px] p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-3 pb-4 border-b border-[#EDE9FE]">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#DB2777] text-white flex items-center justify-center shrink-0">
                <LifeBuoy className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-extrabold text-[#171717]">Message Customer Care</h2>
                <p className="text-[11px] text-[#6B7280]">24/7 live human assistance · Avg. reply <span className="font-bold text-[#6D28D9]">~30 seconds</span></p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100 flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
              </span>
            </div>

            <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {supportMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      msg.from === 'user'
                        ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white rounded-br-sm'
                        : 'bg-[#F8F7FC] border border-[#EDE9FE] text-[#171717] rounded-bl-sm'
                    }`}
                  >
                    <span className="block">{msg.text}</span>
                    <span className={`block mt-1 text-[9px] ${msg.from === 'user' ? 'text-purple-100' : 'text-[#9CA3AF]'}`}>{msg.time}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => setSavedNotice('Initiating a live call with a support agent...')}
                className="shrink-0 w-10 h-10 rounded-xl bg-[#F8F7FC] hover:bg-purple-50 border border-[#EDE9FE] text-[#6D28D9] flex items-center justify-center transition-colors cursor-pointer"
                title="Call support"
              >
                <Headphones className="w-4 h-4" />
              </button>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={supportInput}
                  onChange={(e) => setSupportInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendSupport(); }}
                  placeholder="Type a message to customer care..."
                  className="w-full px-4 py-2.5 text-xs text-[#171717] bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl focus:outline-none focus:border-[#7C3AED] focus:bg-white transition-all pr-11"
                />
              </div>
              <button
                onClick={handleSendSupport}
                disabled={!supportInput.trim()}
                className="shrink-0 h-10 px-4 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white text-xs font-bold flex items-center gap-1.5 transition-all hover:opacity-95 disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Send
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: MessageCircle, title: 'Live Chat', desc: 'Real-time human replies, 24/7', accent: 'bg-purple-50 text-[#7C3AED]' },
              { icon: Mail, title: 'Support Email', desc: 'support@xena.exchange', accent: 'bg-blue-50 text-blue-600' },
              { icon: Clock3, title: 'Ticket Response', desc: 'Typical resolution under 1 hour', accent: 'bg-amber-50 text-amber-600' },
              { icon: ShieldCheck, title: 'Dispute Center', desc: 'Open a mediation ticket for any trade', accent: 'bg-emerald-50 text-emerald-600' },
            ].map(({ icon: Icon, title, desc, accent }) => (
              <button
                key={title}
                onClick={() => setSavedNotice(`${title}: ${desc}. A specialist will reach out.`)}
                className="flex items-center gap-3 p-4 bg-white border border-[#EDE9FE] hover:border-purple-200 rounded-2xl text-left transition-all cursor-pointer group"
              >
                <span className={`w-10 h-10 rounded-xl ${accent} flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-[#171717]">{title}</span>
                  <span className="block text-[10px] text-[#6B7280] truncate">{desc}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-[#6B7280] group-hover:text-[#6D28D9] group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[24px] max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#EDE9FE] animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE9FE]">
              <h3 className="text-sm font-bold text-[#171717]">Edit Profile & Avatar</h3>
              <button
                onClick={() => setIsEditingProfile(false)}
                className="w-7 h-7 rounded-full bg-[#F8F7FC] hover:bg-[#EDE9FE] text-[#6B7280] font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#6B7280] block mb-1">Display Name</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-bold text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#6B7280] block mb-1">Contact Email</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-bold text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#6B7280] block mb-1.5">Avatar Style / Gradient</label>
                <div className="flex gap-2">
                  {[
                    'from-[#5B21B6] via-[#7C3AED] to-[#A855F7]',
                    'from-blue-600 via-indigo-600 to-purple-600',
                    'from-emerald-600 via-teal-600 to-cyan-600',
                    'from-amber-500 via-orange-600 to-rose-600',
                  ].map((grad) => (
                    <button
                      key={grad}
                      type="button"
                      onClick={() => setAvatarGradient(grad)}
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} cursor-pointer transition-transform ${
                        avatarGradient === grad ? 'ring-2 ring-[#6D28D9] scale-110' : 'opacity-70'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#EDE9FE]">
              <button
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsEditingProfile(false);
                  setSavedNotice('Profile updated successfully.');
                  setTimeout(() => setSavedNotice(null), 3000);
                }}
                className="px-5 py-2 rounded-xl bg-[#6D28D9] text-white font-bold text-xs hover:bg-[#5B21B6] transition-colors cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KYC Tier Upgrade Simulation Modal */}
      {showKycUpgradeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[24px] max-w-lg w-full p-6 space-y-4 shadow-2xl border border-[#EDE9FE] animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE9FE]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#6D28D9]" />
                <h3 className="text-sm font-bold text-[#171717]">Upgrade to Tier 3 (Institutional)</h3>
              </div>
              <button
                onClick={() => setShowKycUpgradeModal(false)}
                className="w-7 h-7 rounded-full bg-[#F8F7FC] hover:bg-[#EDE9FE] text-[#6B7280] font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#6B7280]">
              Institutional Tier provides unlimited 24h withdrawals, OTC block trading access, and personalized account management.
            </p>

            <div className="space-y-2.5 p-3.5 bg-[#F8F7FC] rounded-2xl border border-[#EDE9FE] text-xs">
              <div className="flex items-center justify-between">
                <span>Proof of Residential Address:</span>
                <span className="text-[#16A34A] font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Ready for Upload
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Source of Wealth Declaration:</span>
                <span className="text-[#16A34A] font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Auto-Verified
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Corporate/Entity Registration (Optional):</span>
                <span className="text-slate-500 font-semibold">Individual Track</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleSimulateKycUpgrade}
                disabled={kycUpgradePending}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-extrabold text-xs hover:opacity-95 transition-all shadow-xs cursor-pointer"
              >
                {kycUpgradePending ? 'Verifying Documents on Ledger...' : 'Submit & Activate Tier 3 Instantly'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Freeze Confirmation Modal */}
      {showFreezeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[24px] max-w-md w-full p-6 space-y-4 shadow-2xl border border-red-200 animate-scale-up">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-red-950">Confirm Emergency Lockdown?</h3>
                <p className="text-xs text-red-700">Immediate security containment</p>
              </div>
            </div>

            <p className="text-xs text-[#4B5563] leading-relaxed">
              If your device or email is compromised, activating Emergency Lockdown will immediately invalidate all active sessions, block pending crypto withdrawals, and freeze trading until you verify your credentials with 2FA.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#EDE9FE]">
              <button
                onClick={() => setShowFreezeModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleEmergencyLockdown}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
              >
                Lock Down Account Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit QR Modal */}
      {showDepositQrModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[24px] max-w-md w-full p-6 space-y-5 shadow-2xl border border-[#EDE9FE] animate-scale-up text-center">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE9FE]">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#6D28D9]" />
                <h3 className="text-sm font-bold text-[#171717]">Deposit {selectedDepositNetwork}</h3>
              </div>
              <button
                onClick={() => setShowDepositQrModal(false)}
                className="w-7 h-7 rounded-full bg-[#F8F7FC] hover:bg-[#EDE9FE] text-[#6B7280] font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Network Selector Buttons */}
            <div className="flex justify-center gap-1.5">
              {(['XENA', 'USDT', 'BTC', 'ETH', 'SOL'] as const).map((net) => (
                <button
                  key={net}
                  onClick={() => setSelectedDepositNetwork(net)}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    selectedDepositNetwork === net
                      ? 'bg-[#6D28D9] text-white shadow-xs'
                      : 'bg-[#F8F7FC] text-[#6B7280] border border-[#EDE9FE]'
                  }`}
                >
                  {net}
                </button>
              ))}
            </div>

            {/* Mock QR SVG Display */}
            <div className="p-4 bg-[#F8F7FC] rounded-2xl border border-[#EDE9FE] inline-block mx-auto">
              <div className="w-44 h-44 bg-white rounded-xl p-3 border border-[#EDE9FE] flex flex-col items-center justify-center shadow-inner">
                <QrCode className="w-36 h-36 text-[#171717]" />
              </div>
              <p className="text-[11px] text-[#6B7280] mt-2 font-medium">Scan with your mobile crypto wallet</p>
            </div>

            {/* Deposit Address Box */}
            <div className="text-left space-y-1.5">
              <span className="text-[10px] font-bold text-[#6B7280] uppercase">Deposit Address ({selectedDepositNetwork})</span>
              <div className="p-2.5 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE] flex items-center justify-between text-xs font-mono">
                <span className="truncate max-w-[280px] text-[#171717]">
                  {cryptoAssets.find((a) => a.symbol === selectedDepositNetwork)?.depositAddress || '0x71c8...c741'}
                </span>
                <button
                  onClick={() =>
                    handleCopyText(
                      cryptoAssets.find((a) => a.symbol === selectedDepositNetwork)?.depositAddress || '',
                      'modal-copy'
                    )
                  }
                  className="text-[#6D28D9] font-bold p-1 cursor-pointer"
                >
                  {copiedAddressId === 'modal-copy' ? <Check className="w-4 h-4 text-[#16A34A]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowDepositQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#6D28D9] text-white font-bold text-xs hover:bg-[#5B21B6] transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Create API Key Modal */}
      {showCreateApiModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[24px] max-w-lg w-full p-6 space-y-4 shadow-2xl border border-[#EDE9FE] animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE9FE]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#6D28D9]" />
                <h3 className="text-sm font-bold text-[#171717]">Create New API Key</h3>
              </div>
              <button
                onClick={() => setShowCreateApiModal(false)}
                className="w-7 h-7 rounded-full bg-[#F8F7FC] hover:bg-[#EDE9FE] text-[#6B7280] font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateApiKey} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1">Key Name</label>
                <input
                  type="text"
                  value={apiName}
                  onChange={(e) => setApiName(e.target.value)}
                  placeholder="e.g. Grid Trading Bot"
                  required
                  className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1.5">Permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'Read', desc: 'View balances & orders' },
                    { id: 'Spot Trade', desc: 'Place market/limit orders' },
                    { id: 'P2P', desc: 'Automate P2P order flow' },
                    { id: 'Withdrawals', desc: 'Authorize withdrawals (risky)' },
                  ] as const).map((perm) => (
                    <button
                      key={perm.id}
                      type="button"
                      onClick={() =>
                        setApiPermissions((prev) => ({
                          ...prev,
                          [perm.id]: !prev[perm.id],
                        }))
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        apiPermissions[perm.id]
                          ? perm.id === 'Withdrawals'
                            ? 'border-red-300 bg-red-50/60'
                            : 'border-[#7C3AED] bg-purple-50/60 ring-1 ring-[#7C3AED]'
                          : 'border-[#EDE9FE] bg-[#F8F7FC]'
                      }`}
                    >
                      <span className={`text-xs font-bold block ${apiPermissions[perm.id] ? 'text-[#171717]' : 'text-[#6B7280]'}`}>
                        {perm.id}
                      </span>
                      <span className="text-[10px] text-[#6B7280]">{perm.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1">
                  IP Whitelist <span className="text-[9px] font-semibold text-[#9CA3AF]">(recommended)</span>
                </label>
                <input
                  type="text"
                  value={apiIpWhitelist}
                  onChange={(e) => setApiIpWhitelist(e.target.value)}
                  placeholder="e.g. 203.0.113.10 (leave empty for All IPs)"
                  className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-mono text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>The secret will be shown once after creation. Store it in a password manager immediately.</span>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateApiModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#6D28D9] text-white font-bold text-xs hover:bg-[#5B21B6] transition-colors cursor-pointer"
                >
                  Create API Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Newly Created API Key (Secret Shown Once) Modal */}
      {newlyCreatedKey && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[24px] max-w-lg w-full p-6 space-y-4 shadow-2xl border border-emerald-200 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16A34A] flex items-center justify-center border border-emerald-200">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#171717]">API Key Created Successfully</h3>
                <p className="text-xs text-[#6B7280]">{newlyCreatedKey.name}</p>
              </div>
            </div>

            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Copy your secret now. It will not be shown again and cannot be recovered.
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between bg-[#F8F7FC] rounded-xl border border-[#EDE9FE] p-2.5 pl-3">
                <div>
                  <span className="text-[9px] font-bold text-[#6B7280] uppercase block">Access Key</span>
                  <code className="text-xs font-mono font-bold text-[#171717]">{newlyCreatedKey.accessKey}</code>
                </div>
                <button
                  onClick={() => handleCopyText(newlyCreatedKey.accessKey, 'new-access')}
                  className="p-2 rounded-lg bg-white border border-[#EDE9FE] text-[#6D28D9] hover:bg-purple-50 transition-colors cursor-pointer"
                >
                  {copiedAddressId === 'new-access' ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center justify-between bg-[#F8F7FC] rounded-xl border border-[#EDE9FE] p-2.5 pl-3">
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-amber-700 uppercase block">Secret Key</span>
                  <code className="text-xs font-mono font-bold text-[#171717] break-all">{newlyCreatedKey.secret}</code>
                </div>
                <button
                  onClick={() => handleCopyText(newlyCreatedKey.secret, 'new-secret')}
                  className="ml-2 p-2 rounded-lg bg-white border border-[#EDE9FE] text-[#6D28D9] hover:bg-purple-50 transition-colors cursor-pointer shrink-0"
                >
                  {copiedAddressId === 'new-secret' ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => setNewlyCreatedKey(null)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-bold text-xs hover:shadow-[0_4px_16px_rgba(109,40,217,0.3)] transition-all cursor-pointer"
            >
              I've Securely Stored My Secret
            </button>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
