import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  UserRound,
  Mail,
  Phone,
  Lock,
  Bell,
  Globe2,
  Palette,
  ShieldCheck,
  Smartphone,
  KeyRound,
  Check,
  Eye,
  EyeOff,
  Save,
  AlertTriangle,
  Download,
  Compass,
  Moon,
  Monitor,
  Clock,
  Package,
  FileDown,
  Shield,
  Info,
  Languages,
  ChevronRight,
  LifeBuoy,
  MessageCircle,
  Send,
  Headphones,
  Clock3,
  Wallet,
  Landmark,
  Plus,
  Trash2,
  CreditCard,
} from 'lucide-react';
import { SavedBankDetail, SavedWalletAddress, UserProfile } from '../types';
import { getSupportConversations, sendSupportMessage, getAuthToken } from '../lib/api';

interface SettingsPageProps {
  user: UserProfile;
  onUpdateSecurity: (settings: { twoFactor: boolean; pinSet: boolean }) => void;
  onUpdateProfile?: (profile: Partial<UserProfile>) => void;
  onChangePassword?: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  onSelectTab: (tab: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ user, onUpdateSecurity, onUpdateProfile, onChangePassword, onSelectTab }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'account' | 'security' | 'affiliate' | 'notifications' | 'appearance' | 'support'>('overview');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

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

  // Account
  const [displayName, setDisplayName] = useState(user.name);
  const [emailAddr, setEmailAddr] = useState(user.email);
  const [phone, setPhone] = useState('+234 803 555 0198');
  const [country, setCountry] = useState('Nigeria');
  const [language, setLanguage] = useState('English (UK)');
  const [tz, setTz] = useState('(GMT+01:00) West Africa (Lagos)');

  // Withdrawal destination details (saved locally on the account).
  const BANKS = ['GTBank', 'Zenith Bank', 'Access Bank', 'UBA', 'First Bank', 'Providus Bank', 'Kuda', 'OPay', 'Moniepoint'];
  const WALLET_COINS = [
    { id: 'usdt', label: 'USDT', network: 'TRC20' },
    { id: 'btc', label: 'BTC', network: 'Bitcoin' },
    { id: 'sol', label: 'SOL', network: 'Solana' },
    { id: 'eth', label: 'ETH', network: 'Ethereum' },
  ];
  const [savedBank, setSavedBank] = useState<SavedBankDetail>(
    user.bankDetails?.[0] ?? { bankName: 'GTBank', accountNumber: '', accountName: '' }
  );
  const [savedWallets, setSavedWallets] = useState<SavedWalletAddress[]>(user.walletAddresses ?? []);
  const [walletCoin, setWalletCoin] = useState('usdt');
  const [walletAddr, setWalletAddr] = useState('');

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Security toggles
  const [twoFactor, setTwoFactor] = useState(user.twoFactorEnabled);
  const [pinSet, setPinSet] = useState(user.pinSet);
  const [withdrawalConfirmation, setWithdrawalConfirmation] = useState(true);
  const [sessionTracking, setSessionTracking] = useState(true);

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState({
    security: true,
    price: true,
    yields: true,
    trades: true,
    p2p: true,
    marketAnnouncements: false,
    promotions: false,
  });
  const notifChannels = ['Email', 'Push', 'SMS'];

  // Appearance
  const [currency, setCurrency] = useState<'NGN' | 'USD' | 'EUR' | 'GBP'>('NGN');
  const [accent, setAccent] = useState('purple');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');

  const notify = (msg: string, ms = 2600) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), ms);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateProfile) onUpdateProfile({ name: displayName, email: emailAddr });
    notify('Account information saved successfully.');
  };

  const handleAddWallet = () => {
    const addr = walletAddr.trim();
    if (!addr) { notify('Enter a wallet address first.'); return; }
    if (savedWallets.some((w) => w.coin === walletCoin)) {
      setSavedWallets((prev) => prev.map((w) => (w.coin === walletCoin ? { coin: walletCoin, address: addr } : w)));
    } else {
      setSavedWallets((prev) => [...prev, { coin: walletCoin, address: addr }]);
    }
    setWalletAddr('');
    notify(`${WALLET_COINS.find((c) => c.id === walletCoin)?.label} address saved.`);
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedBank.accountNumber || savedBank.accountNumber.replace(/\D/g, '').length < 10) {
      notify('Enter a valid 10-digit account number.');
      return;
    }
    if (!savedBank.accountName.trim()) { notify('Enter the account name.'); return; }
    if (onUpdateProfile) {
      onUpdateProfile({ bankDetails: [savedBank], walletAddresses: savedWallets });
    }
    notify('Withdrawal payment details saved.');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) {
      notify('New password must be at least 8 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      notify('New passwords do not match.');
      return;
    }
    if (onChangePassword) {
      setSavedNotice('Updating password…');
      const result = await onChangePassword(currentPw, newPw);
      if (!result.ok) {
        notify(result.error || 'Unable to change password.');
        return;
      }
    }
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    notify('Password changed successfully. All sessions will be refreshed.');
  };

  const handleToggle2FA = () => {
    const next = !twoFactor;
    setTwoFactor(next);
    onUpdateSecurity({ twoFactor: next, pinSet });
    notify(next ? 'Two-Factor Authentication enabled.' : 'Two-Factor Authentication disabled.');
  };

  const handleTogglePIN = () => {
    const next = !pinSet;
    setPinSet(next);
    onUpdateSecurity({ twoFactor, pinSet: next });
    notify(next ? '6-digit security PIN enabled.' : 'Security PIN removed.');
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'account', label: 'Account', icon: UserRound },
    { id: 'security', label: 'Security & Auth', icon: ShieldCheck },
    { id: 'affiliate', label: 'Affiliate & Referrals', icon: Compass },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'support', label: 'Customer Support', icon: LifeBuoy },
  ] as const;

  const card = 'bg-white border border-[#EDE9FE] rounded-[20px] p-5 sm:p-6 shadow-sm';

  const rowCard = (title: string, desc: string, checked: boolean, onChange: () => void) => (
    <div className="flex items-center justify-between p-3.5 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE]">
      <div>
        <h4 className="text-xs font-bold text-[#171717]">{title}</h4>
        <p className="text-[11px] text-[#6B7280] mt-0.5">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${checked ? 'bg-[#7C3AED]' : 'bg-slate-200'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
        />
      </button>
    </div>
  );

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
    <div className="space-y-6 animate-fade-in" id="settings-page-view">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#5B21B6] via-[#7C3AED] to-[#C026D3] rounded-[22px] p-5 sm:p-7 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/25 backdrop-blur flex items-center justify-center">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">Account Settings</h1>
              <p className="text-xs text-purple-100">Manage your account, notifications, appearance, and privacy.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="px-3 py-1.5 rounded-full bg-white/15 border border-white/25 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Security Score 98%
            </span>
            <span className="px-3 py-1.5 rounded-full bg-white/15 border border-white/25">{user.kycTier}</span>
          </div>
        </div>
      </div>

      {savedNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs font-bold text-[#16A34A] flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Settings Sidebar List + Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Left: Vertical List */}
        <div className="md:col-span-3 bg-white border border-[#EDE9FE] rounded-[20px] p-2 shadow-sm md:sticky md:top-20">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
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
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-[#4C1D95] via-[#7C3AED] to-[#DB2777] rounded-[22px] p-5 sm:p-6 text-white shadow-lg shadow-purple-200/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#F59E0B]/25 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-[#22D3EE]/20 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 backdrop-blur flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold tracking-tight">Account Overview</h2>
                    <p className="text-[11px] text-purple-100 mt-0.5">Everything you need to manage your XENA account from one place.</p>
                  </div>
                </div>
                <div className="relative z-10 mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Account Tier', value: user.kycTier },
                    { label: 'Security Score', value: '98%' },
                    { label: '2FA', value: twoFactor ? 'Enabled' : 'Off' },
                    { label: 'Referral Rewards', value: '₦0.00' },
                  ].map((s) => (
                    <div key={s.label} className="p-2.5 rounded-xl bg-white/10 border border-white/15 backdrop-blur text-center">
                      <div className="text-[9px] uppercase font-bold text-purple-200 tracking-wider">{s.label}</div>
                      <div className="text-sm font-extrabold text-white mt-0.5">{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${card} space-y-2`}>
                <h3 className="text-sm font-bold text-[#171717] flex items-center gap-2 pb-3 border-b border-[#EDE9FE]">
                  <Compass className="w-4 h-4 text-[#6D28D9]" /> Quick Settings
                </h3>
                {[
                  { icon: UserRound, title: 'Account Information', desc: 'Name, email, phone & region', tab: 'account' },
                  { icon: ShieldCheck, title: 'Security & Authentication', desc: '2FA, PIN, sessions & privacy', tab: 'security' },
                  { icon: Compass, title: 'Affiliate & Referrals', desc: 'Invite friends & earn rewards', tab: 'affiliate' },
                  { icon: Bell, title: 'Notifications & Alerts', desc: 'Choose what you hear about', tab: 'notifications' },
                  { icon: Palette, title: 'Appearance & Language', desc: 'Theme, currency & region', tab: 'appearance' },
                ].map(({ icon: Icon, title, desc, tab }) => (
                  <button
                    key={title}
                    onClick={() => setActiveTab(tab as typeof activeTab)}
                    className="w-full flex items-center gap-3 p-3 bg-[#F8F7FC] hover:bg-white border border-[#EDE9FE] hover:border-purple-200 rounded-xl transition-all text-left cursor-pointer group"
                  >
                    <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#DB2777] text-white flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
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

          {/* ============ ACCOUNT ============ */}
      {activeTab === 'account' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Information */}
          <form onSubmit={handleSaveAccount} className={`${card} space-y-4`}>
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE9FE]">
              <h3 className="text-sm font-bold text-[#171717] flex items-center gap-2">
                <UserRound className="w-4 h-4 text-[#6D28D9]" /> Personal Information
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1">Display Name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    value={emailAddr}
                    onChange={(e) => setEmailAddr(e.target.value)}
                    className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 pl-8 text-xs font-semibold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white"
                  />
                  <Mail className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1">Phone Number</label>
                <div className="relative">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 pl-8 text-xs font-semibold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white"
                  />
                  <Phone className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#16A34A] bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
                    VERIFIED
                  </span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1">Country / Region</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20"
                >
                  <option>Nigeria</option>
                  <option>Ghana</option>
                  <option>Kenya</option>
                  <option>South Africa</option>
                  <option>United States</option>
                  <option>United Kingdom</option>
                  <option>Germany</option>
                  <option>France</option>
                  <option>Singapore</option>
                  <option>United Arab Emirates</option>
                  <option>Canada</option>
                </select>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F8F7FC] border border-[#EDE9FE] text-[11px] text-[#6B7280] flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-[#6D28D9] shrink-0 mt-0.5" />
              <span>
                Your identity verification (KYC Level 2) locks your legal name and date of birth. Contact our
                <button onClick={() => onSelectTab('announcements')} className="text-[#6D28D9] font-bold mx-1 hover:underline cursor-pointer">support desk</button>
                to correct document-bound details.
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-bold text-xs hover:shadow-[0_4px_16px_rgba(109,40,217,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Changes
            </button>
          </form>

          {/* Change Password */}
          <form onSubmit={handleChangePassword} className={`${card} space-y-4`}>
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE9FE]">
              <h3 className="text-sm font-bold text-[#171717] flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#6D28D9]" /> Password & Sign-In
              </h3>
              <span className="text-[10px] font-bold text-[#16A34A] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                Last changed 38 days ago
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    required
                    className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 pr-9 text-xs font-semibold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6D28D9] cursor-pointer">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-[#171717] block mb-1">New Password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    required
                    className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#171717] block mb-1">Confirm New</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    required
                    className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]"
                  />
                </div>
              </div>
              <p className="text-[10px] text-[#6B7280]">
                Password requirements: minimum 8 characters, one uppercase letter, one number, and one symbol.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" /> Update Password
            </button>
          </form>
          </div>

          {/* Payment & Withdrawal Details */}
          <form onSubmit={handleSavePayment} className={`${card} space-y-4`}>
            <div className="pb-3 border-b border-[#EDE9FE]">
              <h3 className="text-sm font-bold text-[#171717] flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#6D28D9]" /> Payment & Withdrawal Details
              </h3>
              <p className="text-[11px] text-[#6B7280] mt-0.5">Saved destinations are pre-filled when you request a withdrawal.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1">Bank</label>
                <select
                  value={savedBank.bankName}
                  onChange={(e) => setSavedBank((prev) => ({ ...prev, bankName: e.target.value }))}
                  className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 cursor-pointer"
                >
                  {BANKS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1">Account Number</label>
                <input
                  value={savedBank.accountNumber}
                  onChange={(e) => setSavedBank((prev) => ({ ...prev, accountNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) }))}
                  placeholder="0123456789"
                  className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-mono font-semibold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#171717] block mb-1">Account Name</label>
              <input
                value={savedBank.accountName}
                onChange={(e) => setSavedBank((prev) => ({ ...prev, accountName: e.target.value }))}
                placeholder="Full Name on Account"
                className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]"
              />
            </div>

            <div className="pt-3 border-t border-[#EDE9FE]">
              <label className="text-[11px] font-bold text-[#171717] block mb-2">Crypto Wallet Addresses</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={walletCoin}
                  onChange={(e) => setWalletCoin(e.target.value)}
                  className="sm:w-36 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 cursor-pointer"
                >
                  {WALLET_COINS.map((c) => <option key={c.id} value={c.id}>{c.label} · {c.network}</option>)}
                </select>
                <input
                  value={walletAddr}
                  onChange={(e) => setWalletAddr(e.target.value)}
                  placeholder={`Paste ${WALLET_COINS.find((c) => c.id === walletCoin)?.label} address`}
                  className="flex-1 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl px-3 py-2 text-xs font-mono font-semibold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]"
                />
                <button
                  type="button"
                  onClick={handleAddWallet}
                  className="px-3 py-2 rounded-xl bg-purple-50 text-[#7C3AED] text-xs font-bold border border-purple-100 hover:bg-purple-100 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              {savedWallets.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {savedWallets.map((w) => (
                    <span key={w.coin} className="inline-flex items-center gap-1.5 bg-[#F8F7FC] border border-[#EDE9FE] rounded-lg px-2.5 py-1.5">
                      <CreditCard className="w-3 h-3 text-[#6D28D9]" />
                      <b className="text-[10px] text-[#171717]">{WALLET_COINS.find((c) => c.id === w.coin)?.label || String(w.coin).toUpperCase()}</b>
                      <span className="text-[10px] font-mono text-[#6B7280] max-w-[160px] truncate">{w.address}</span>
                      <button
                        type="button"
                        onClick={() => { setSavedWallets((prev) => prev.filter((x) => x.coin !== w.coin)); notify(`${String(w.coin).toUpperCase()} address removed.`); }}
                        className="text-red-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-bold text-xs hover:shadow-[0_4px_16px_rgba(109,40,217,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Payment Details
            </button>
          </form>
        </div>
      )}

      {/* ============ NOTIFICATIONS ============ */}
      {activeTab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          <div className={`${card} space-y-3`}>
            <div className="pb-3 border-b border-[#EDE9FE]">
              <h3 className="text-sm font-bold text-[#171717] flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#6D28D9]" /> Alert Categories
              </h3>
              <p className="text-[11px] text-[#6B7280] mt-0.5">Choose which events send you alerts</p>
            </div>
            {rowCard('Security Alerts', 'Login attempts, withdrawals, and 2FA changes', notifPrefs.security, () =>
              setNotifPrefs((p) => ({ ...p, security: !p.security }))
            )}
            {rowCard('Price Alerts', 'XENA market price movements & threshold triggers', notifPrefs.price, () =>
              setNotifPrefs((p) => ({ ...p, price: !p.price }))
            )}
            {rowCard('Yield & Staking Rewards', 'Daily yields, maturity notices, and claim reminders', notifPrefs.yields, () =>
              setNotifPrefs((p) => ({ ...p, yields: !p.yields }))
            )}
            {rowCard('Trade Executions', 'Filled spot orders and instant swap confirmations', notifPrefs.trades, () =>
              setNotifPrefs((p) => ({ ...p, trades: !p.trades }))
            )}
            {rowCard('P2P Orders & Chat', 'New P2P orders, releases, and merchant messages', notifPrefs.p2p, () =>
              setNotifPrefs((p) => ({ ...p, p2p: !p.p2p }))
            )}
            {rowCard('Market Announcements', 'New yield vaults and ecosystem updates', notifPrefs.marketAnnouncements, () =>
              setNotifPrefs((p) => ({ ...p, marketAnnouncements: !p.marketAnnouncements }))
            )}
            {rowCard('Promotions & Bonuses', 'Exclusive offers, fee discounts, and airdrops', notifPrefs.promotions, () =>
              setNotifPrefs((p) => ({ ...p, promotions: !p.promotions }))
            )}
            <button
              onClick={() => notify('Notification preferences saved.')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-bold text-xs hover:shadow-[0_4px_16px_rgba(109,40,217,0.3)] transition-all cursor-pointer"
            >
              Save Notification Preferences
            </button>
          </div>

          <div className="space-y-6">
            <div className={`${card} space-y-3`}>
              <div className="pb-3 border-b border-[#EDE9FE]">
                <h3 className="text-sm font-bold text-[#171717] flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#6D28D9]" /> Delivery Channels
                </h3>
                <p className="text-[11px] text-[#6B7280] mt-0.5">Where you receive your alerts</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {notifChannels.map((ch) => (
                  <div key={ch} className="p-3 bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl text-center">
                    <span className="text-lg font-extrabold text-[#6D28D9] block">{ch[0]}</span>
                    <span className="text-[11px] font-bold text-[#171717]">{ch}</span>
                    <span className="text-[9px] text-[#16A34A] font-bold block">Active</span>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 text-[11px] text-[#6B7280] flex items-start gap-2">
                <Bell className="w-4 h-4 text-[#6D28D9] shrink-0 mt-0.5" />
                <span>Push notifications sync with the XENA mobile app. SMS charges may apply based on your operator.</span>
              </div>
            </div>

            {rowCard(
              'Quiet Hours',
              'Pause non-security alerts between 10:00 PM – 8:00 AM (local time)',
              false,
              () => notify('Quiet hours will respect your device timezone.')
            )}
            <div className="flex items-center justify-between p-3.5 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE]">
              <div>
                <h4 className="text-xs font-bold text-[#171717]">Email Summary Digest</h4>
                <p className="text-[11px] text-[#6B7280] mt-0.5">Weekly recap of portfolio & yield performance</p>
              </div>
              <select className="bg-white border border-[#EDE9FE] rounded-lg px-2 py-1.5 text-[11px] font-bold text-[#171717] focus:outline-none cursor-pointer">
                <option>Weekly (Sunday)</option>
                <option>Daily</option>
                <option>Monthly</option>
                <option>Never</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ============ LANGUAGE & APPEARANCE ============ */}
      {activeTab === 'appearance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          <div className={`${card} space-y-4`}>
            <div className="pb-3 border-b border-[#EDE9FE]">
              <h3 className="text-sm font-bold text-[#171717] flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-[#6D28D9]" /> Language & Region
              </h3>
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#171717] block mb-1">Interface Language</label>
              <div className="relative">
                <Languages className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 cursor-pointer"
                >
                  <option>English (US)</option>
                  <option>English (UK)</option>
                  <option>Español</option>
                  <option>Deutsch</option>
                  <option>Français</option>
                  <option>日本語</option>
                  <option>한국어</option>
                  <option>中文 (简体)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#171717] block mb-1">Time Zone</label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={tz}
                  onChange={(e) => setTz(e.target.value)}
                  className="w-full bg-[#F8F7FC] border border-[#EDE9FE] rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 cursor-pointer"
                >
                  <option>(GMT+01:00) West Africa (Lagos)</option>
                  <option>(GMT+00:00) London</option>
                  <option>(GMT-08:00) Pacific Time</option>
                  <option>(GMT-05:00) Eastern Time</option>
                  <option>(GMT+01:00) Berlin</option>
                  <option>(GMT+09:00) Tokyo</option>
                  <option>(GMT+08:00) Singapore</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#171717] block mb-1">Display Currency</label>
              <div className="flex bg-[#F8F7FC] rounded-xl border border-[#EDE9FE] p-1">
                {(['NGN', 'USD', 'EUR', 'GBP'] as const).map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setCurrency(cur)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                      currency === cur ? 'bg-[#6D28D9] text-white' : 'text-[#6B7280] hover:text-[#171717]'
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between p-3.5 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE]">
              <div>
                <h4 className="text-xs font-bold text-[#171717]">24-Hour Time Format</h4>
                <p className="text-[11px] text-[#6B7280] mt-0.5">Display timestamps in 24h / military time</p>
              </div>
              <input type="checkbox" className="w-5 h-5 accent-[#6D28D9] cursor-pointer" />
            </div>
            <button
              onClick={() => notify('Regional preferences saved.')}
              className="w-full py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Save Regional Preferences
            </button>
          </div>

          <div className="space-y-6">
            <div className={`${card} space-y-4`}>
              <div className="pb-3 border-b border-[#EDE9FE]">
                <h3 className="text-sm font-bold text-[#171717] flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#6D28D9]" /> Appearance
                </h3>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1">Interface Density</label>
                <div className="flex gap-2">
                  {([
                    { id: 'comfortable', label: 'Comfortable', icon: Monitor },
                    { id: 'compact', label: 'Compact', icon: Compass },
                  ] as const).map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDensity(opt.id)}
                        className={`flex-1 p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          density === opt.id
                            ? 'border-[#7C3AED] bg-purple-50 text-[#6D28D9] ring-1 ring-[#7C3AED]'
                            : 'border-[#EDE9FE] bg-[#F8F7FC] text-[#6B7280] hover:border-purple-200'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1">Accent Color</label>
                <div className="flex gap-2">
                  {[
                    { id: 'purple', cls: 'from-[#7C3AED] to-[#A855F7]', label: 'XENA Purple' },
                    { id: 'blue', cls: 'from-blue-500 to-indigo-500', label: 'Ocean Blue' },
                    { id: 'emerald', cls: 'from-emerald-500 to-teal-500', label: 'Emerald' },
                    { id: 'dark', cls: 'from-slate-800 to-black', label: 'Onyx' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      title={opt.label}
                      onClick={() => setAccent(opt.id)}
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${opt.cls} cursor-pointer transition-transform ${
                        accent === opt.id ? 'ring-2 ring-[#171717] ring-offset-2 scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => notify('Theme set to Light mode.')}
                  className="flex-1 py-2.5 rounded-xl bg-[#F8F7FC] border border-[#EDE9FE] text-xs font-bold text-[#171717] hover:bg-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Moon className="w-3.5 h-3.5" /> Light
                </button>
                <button
                  onClick={() => notify('Dark mode is previewing in the XENA mobile beta.')}
                  className="flex-1 py-2.5 rounded-xl border border-[#EDE9FE] text-xs font-bold text-[#6B7280] hover:text-[#171717] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Monitor className="w-3.5 h-3.5" /> System (Beta)
                </button>
              </div>
            </div>

            <div className={`${card} space-y-3`}>
              <h3 className="text-sm font-bold text-[#171717] flex items-center gap-2 pb-3 border-b border-[#EDE9FE]">
                <Package className="w-4 h-4 text-[#6D28D9]" /> Data & Export
              </h3>
              <button
                onClick={() => notify('Preparing your account data export archive...')}
                className="w-full py-2.5 rounded-xl bg-[#F8F7FC] hover:bg-white border border-[#EDE9FE] text-xs font-bold text-[#171717] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#6D28D9]" /> Export Full Account Data
              </button>
              <button
                onClick={() => onSelectTab('profile')}
                className="w-full py-2.5 rounded-xl bg-[#F8F7FC] hover:bg-white border border-[#EDE9FE] text-xs font-bold text-[#171717] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-[#6D28D9]" /> Tax Statements & Reports
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ SECURITY & PRIVACY ============ */}
      {activeTab === 'security' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`${card} space-y-3`}>
              <div className="pb-3 border-b border-[#EDE9FE]">
                <h3 className="text-sm font-bold text-[#171717] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#6D28D9]" /> Authentication
                </h3>
                <p className="text-[11px] text-[#6B7280] mt-0.5">Core login & transaction protections</p>
              </div>
              {rowCard('Two-Factor Authentication (2FA)', 'Required for withdrawals & P2P releases', twoFactor, handleToggle2FA)}
              {rowCard('Transaction Security PIN', 'Instant biometric ring for fast trades', pinSet, handleTogglePIN)}
              {rowCard('Withdrawal Address Confirmation', 'Re-authenticate when a new address is used', withdrawalConfirmation, () => {
                setWithdrawalConfirmation(!withdrawalConfirmation);
                notify('Withdrawal confirmation setting updated.');
              })}
              {rowCard('Login Session Tracking', 'Monitor active devices & locations', sessionTracking, () => {
                setSessionTracking(!sessionTracking);
                notify('Session tracking preference updated.');
              })}

              <button
                onClick={() => onSelectTab('profile')}
                className="w-full py-2.5 rounded-xl bg-[#F8F7FC] hover:bg-white border border-[#EDE9FE] text-xs font-bold text-[#171717] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                Manage Devices, Whitelists & Anti-Phishing <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-br from-[#171717] via-[#2A1B4E] to-[#171717] rounded-[22px] p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">Account Security Score</span>
                    <div className="text-4xl font-black font-mono mt-1">
                      98<span className="text-lg text-purple-300">/100</span>
                    </div>
                    <p className="text-[11px] text-purple-200 mt-1">Top 1% secure accounts on XENA</p>
                  </div>
                  <div className="w-20 h-20 rounded-full bg-white/10 border-4 border-[#A855F7] flex items-center justify-center">
                    <Lock className="w-8 h-8 text-[#D8B4FE]" />
                  </div>
                </div>
                <div className="relative z-10 mt-4 grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div className="p-2 rounded-lg bg-white/10 border border-white/10">
                    <span className="block font-extrabold text-emerald-400">3 / 3</span>
                    <span className="text-purple-200">Auth Factors</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/10 border border-white/10">
                    <span className="block font-extrabold text-emerald-400">2</span>
                    <span className="text-purple-200">Active Sessions</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/10 border border-white/10">
                    <span className="block font-extrabold text-emerald-400">0</span>
                    <span className="text-purple-200">Risk Events</span>
                  </div>
                </div>
              </div>

              <div className={`${card} space-y-3`}>
                <h3 className="text-sm font-bold text-[#171717] flex items-center gap-2 pb-3 border-b border-[#EDE9FE]">
                  <Shield className="w-4 h-4 text-[#6D28D9]" /> Privacy Controls
                </h3>
                {rowCard('Share anonymous usage analytics', 'Helps improve XENA products', true, () => notify('Analytics preference updated.'))}
                {rowCard('Two-step delete protection', 'Require PIN + email OTP for account deletion', true, () => notify('Delete protection updated.'))}

                <div className="pt-2">
                  <button
                    onClick={() => notify('This demo account cannot be deleted. This is a simulated action.')}
                    className="w-full py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Deactivate / Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ AFFILIATE & REFERRALS ============ */}
      {activeTab === 'affiliate' && (
        <div className="space-y-5 animate-fade-in">
          <div className="bg-gradient-to-br from-[#7C3AED] via-[#DB2777] to-[#F59E0B] rounded-[22px] p-5 sm:p-6 text-white shadow-lg shadow-fuchsia-200/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#22D3EE]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 backdrop-blur flex items-center justify-center">
                <Compass className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold tracking-tight">Affiliate & Referrals</h2>
                <p className="text-[11px] text-purple-100 mt-0.5">Invite friends and earn lifetime rewards from their trading activity.</p>
              </div>
            </div>
            <div className="relative z-10 mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Total Referrals', value: '12' },
                { label: 'Active Friends', value: '8' },
                { label: 'Total Earned', value: '₦124,500' },
                { label: 'Pending Bonus', value: '₦8,250' },
              ].map((s) => (
                <div key={s.label} className="p-2.5 rounded-xl bg-white/10 border border-white/15 backdrop-blur text-center">
                  <div className="text-[9px] uppercase font-bold text-purple-200 tracking-wider">{s.label}</div>
                  <div className="text-sm font-extrabold text-white mt-0.5">{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${card} space-y-3`}>
            <div className="pb-3 border-b border-[#EDE9FE]">
              <h3 className="text-sm font-bold text-[#171717] flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#6D28D9]" /> Your Referral Link
              </h3>
              <p className="text-[11px] text-[#6B7280] mt-0.5">Share this link — earn 5% of your friends' trading fees forever</p>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#F8F7FC] border border-[#EDE9FE]">
              <code className="flex-1 text-xs font-mono font-bold text-[#6D28D9] break-all truncate">https://xena.exchange/r/blessed509</code>
              <button
                onClick={() => notify('Referral link copied to clipboard.')}
                className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white text-xs font-bold hover:opacity-95 transition-all shadow-sm shadow-fuchsia-200/50 cursor-pointer"
              >
                Copy Link
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <span className="block font-extrabold text-emerald-600 text-sm">5%</span>
                <span className="text-emerald-700">Friend Trading Fee Rebate</span>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                <span className="block font-extrabold text-[#6D28D9] text-sm">₦2,000</span>
                <span className="text-purple-700">One-time Signup Bonus</span>
              </div>
            </div>
          </div>

          <div className={`${card} space-y-2`}>
            <h3 className="text-sm font-bold text-[#171717] flex items-center gap-2 pb-3 border-b border-[#EDE9FE]">
              <UserRound className="w-4 h-4 text-[#6D28D9]" /> Referral History
            </h3>
            {[
              { name: 'Chinedu O.', date: 'Aug 26, 2026', reward: '+₦4,250' },
              { name: 'Fatima B.', date: 'Aug 22, 2026', reward: '+₦6,100' },
              { name: 'Tunde A.', date: 'Aug 18, 2026', reward: '+₦2,800' },
              { name: 'Amara N.', date: 'Aug 15, 2026', reward: '+₦9,900' },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-[#F8F7FC] rounded-xl border border-[#EDE9FE]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#DB2777] text-white font-bold text-xs flex items-center justify-center">
                    {r.name.charAt(0)}
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-[#171717]">{r.name}</span>
                    <span className="block text-[10px] text-[#6B7280]">{r.date}</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600">{r.reward}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ CUSTOMER SUPPORT ============ */}
      {activeTab === 'support' && (
        <div className="space-y-4">
          <div className={`${card} p-5`}>
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
                onClick={() => notify('Initiating a live call with a support agent...')}
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
                onClick={() => notify(`${title}: ${desc}. A specialist will reach out.`)}
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
        </div>
      </div>
    </div>
  );
};

