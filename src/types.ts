export interface SavedBankDetail {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface SavedWalletAddress {
  coin: 'usdt' | 'btc' | 'sol' | 'eth' | string;
  address: string;
}

export interface UserProfile {
  name: string;
  email: string;
  kycTier: string;
  avatarUrl?: string;
  xenaId: string;
  xenaCode: string;
  twoFactorEnabled: boolean;
  pinSet: boolean;
  verifiedAccountsCount: number;
  role?: 'user' | 'admin';
  bankDetails?: SavedBankDetail[];
  walletAddresses?: SavedWalletAddress[];
}

export interface UserBalances {
  totalXena: number;
  totalBalance?: number;
  usdRate: number;
  change24hAmount: number;
  change24hPercent: number;
  availableXena: number;
  investedXena: number;
  averageBuyPrice: number;
  currentPrice: number;
  stakedXena: number;
  lockedInOrders: number;
  nairaBalance: number;
  xenaNgnRate: number;
}

export interface MarketStats {
  pair: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24hXena: number;
  volume24hUsdt: number;
}

export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'investment'
  | 'p2p_buy'
  | 'p2p_sell'
  | 'buy'
  | 'sell'
  | 'staking_reward'
  | 'yield'
  | 'send'
  | 'receive'
  | 'p2p'
  | string;

export type TransactionStatus =
  | 'Completed'
  | 'Pending'
  | 'Failed'
  | 'Processing'
  | 'completed'
  | 'pending'
  | 'processing'
  | string;

export interface Transaction {
  id: string;
  title: string;
  type: TransactionType;
  amount: number;
  unit: string;
  status: TransactionStatus;
  timestamp: string;
  txHash?: string;
  counterparty?: string;
  fee?: number;
  paymentMethod?: string;
}

export interface InvestmentPlan {
  id: string;
  name: string;
  category: 'Growth' | 'Staking' | 'Flexible' | 'Fixed Term' | string;
  investedAmount: number;
  projectedReturnPercent: number;
  earnedAmount: number;
  progressPercent: number;
  daysRemaining: number;
  totalDays?: number;
  startDate?: string;
  endDate?: string;
  status?: 'Active' | 'Matured' | 'Pending' | string;
  dailyYieldXena?: number;
}

export interface P2POffer {
  id: string;
  merchantName: string;
  merchantTier?: 'Pro Merchant' | 'Verified Trader' | 'VIP Merchant' | string;
  completionRate: number;
  completedOrders?: number;
  ordersCount?: number;
  type?: 'BUY' | 'SELL';
  pricePerXena: number;
  currency?: string;
  minLimit: number;
  maxLimit: number;
  availableXena: number;
  paymentMethods?: string[];
  paymentMethod?: string;
  responseTimeMinutes?: number;
  isOnline?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  listedBy?: string;
}

export interface P2PTrade {
  id: string;
  offerId: string;
  merchantName: string;
  type: 'BUY' | 'SELL';
  method: string;
  fiatAmount: number;
  currency: string;
  xenaAmount: number;
  pricePerXena: number;
  buyerEmail: string;
  status: 'awaiting_validation' | 'approved' | 'rejected';
  reference: string;
  time: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'security' | 'transaction' | 'system' | 'market';
}

export interface MarketNewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  timestamp: string;
  category: 'Ecosystem' | 'Market' | 'DeFi' | 'Technology' | 'Regulation';
  sentiment: 'Bullish' | 'Neutral' | 'Bearish';
  readTime: string;
  url?: string;
  isHot?: boolean;
}

export interface VaultPackage {
  id: string;
  name: string;
  category: string;
  apy: number;
  duration: string;
  days: number;
  minDeposit: number;
  badge: string;
  risk: string;
  description: string;
}

export interface StoreUserBalances {
  availableXena: number;
  nairaBalance: number;
  investedXena: number;
}

export interface StoreUser {
  id: string;
  name: string;
  email: string;
  xenaId: string;
  xenaCode: string;
  kycTier: string;
  joined: string;
  status: 'active' | 'frozen';
  twoFactorEnabled: boolean;
  pinSet: boolean;
  balances: StoreUserBalances;
}

export interface EscrowCredit {
  id: string;
  reference: string;
  bank: string;
  accountNumber: string;
  nairaAmount: number;
  xenaAmount: number;
  status: 'pending' | 'confirmed' | 'dismissed';
  createdAt: string;
  email: string;
}

export interface PromoCode {
  code: string;
  rewardXena: number;
  label: string;
  description: string;
  active: boolean;
  redeemedCount: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  target: string;
  detail: string;
  timestamp: string;
}

export interface Announcement {
  id: string;
  title: string;
  date: string;
  tag: string;
  tagColor: string;
  summary: string;
  actionText?: string;
  actionId?: 'p2p' | 'staking';
  publishedBy?: string;
}

export interface RegisteredUserRecord {
  name: string;
  email: string;
  password: string;
  country: string;
  phone: string;
  dob: string;
  referrer: string;
}

export interface SupportMessage {
  from: 'user' | 'agent';
  text: string;
  time: string;
}

export interface SupportConversation {
  id: string;
  email: string;
  userName: string;
  status: 'open' | 'resolved';
  createdAt: number;
  updatedAt?: number;
  messages: SupportMessage[];
}

export interface Account extends RegisteredUserRecord {
  id: string;
  xenaId: string;
  xenaCode: string;
  kycTier: string;
  status: string;
  joined: string;
  twoFactorEnabled: boolean;
  pinSet: boolean;
  verifiedAccountsCount: number;
  balances: UserBalances;
  transactions: Transaction[];
  investments: InvestmentPlan[];
  notifications: NotificationItem[];
  redeemedBonusCodes: string[];
  bankDetails?: SavedBankDetail[];
  walletAddresses?: SavedWalletAddress[];
}
