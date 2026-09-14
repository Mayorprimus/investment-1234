import {
  sb,
  callRpc,
  mapBalances,
  mapTransactions,
  mapNotifications,
  mapInvestment,
  mapVault,
  mapOffer,
  mapTrade,
  mapAnnouncement,
  mapPublicState,
  mapProfileToAccount,
  getSessionToken,
  describeAuthError,
} from './supabase';
import type { SupportConversation } from '../types';

export type ServerState = Record<string, any>;

// ---------- Auth token persistence (fallback for non-cookie environments) ----------
const TOKEN_KEY = 'xena_auth_token';

export function getAuthToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setAuthToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

export function clearAuthToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  country: string;
  phone: string;
  dob: string;
  referrer?: string;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  account?: any;
  role?: string;
  token?: string;
}

async function currentAccessToken(): Promise<string | null> {
  const t = await getSessionToken();
  return t || getAuthToken();
}

// ---------- Public + Admin bootstrap state ----------
export async function getState(): Promise<ServerState | null> {
  try {
    const publicData = await callRpc<any>('get_public_state');
    const pub = mapPublicState(publicData);

    const state: ServerState = {
      ...pub,
      p2pTrades: [] as any[],
      accounts: [] as any[],
      users: [] as any[],
      txs: [] as any[],
      deposits: [] as any[],
      referrals: [] as any[],
      bonusLog: [] as any[],
      merchants: [] as any[],
      disputes: [] as any[],
      tickets: [] as any[],
      promos: [] as any[],
      audit: [] as any[],
      price: pub.xenaPrice,
    };

    const isAdmin = await callRpc<any>('is_admin').then((d) => !!d, () => false);
    if (isAdmin) {
      const admin = await callRpc<any>('admin_get_state');
      if (admin) {
        const blob = admin.blob || {};
        Object.assign(state, {
          users: blob.users || [],
          txs: blob.txs || [],
          deposits: blob.deposits || [],
          referrals: blob.referrals || [],
          bonusLog: blob.bonusLog || [],
          merchants: blob.merchants || [],
          disputes: blob.disputes || [],
          tickets: blob.tickets || [],
          promos: blob.promos || [],
          audit: blob.audit || [],
          settings: admin.settings || state.settings,
        });
        const investmentMap = new Map<string, any[]>();
        (admin.investments || []).forEach((i: any) => {
          const key = String(i.user_id || '');
          if (!investmentMap.has(key)) investmentMap.set(key, []);
          investmentMap.get(key)!.push(mapInvestment(i));
        });
        state.investments = (admin.investments || []).map((i: any) => ({ ...mapInvestment(i), ...i }));
        state.accounts = (admin.profiles || []).map((p: any) =>
          mapProfileToAccount(p, investmentMap.get(String(p.id)) || [])
        );
        state.p2pOffers = (admin.p2pOffers || []).map(mapOffer);
        state.p2pTrades = (admin.p2pTrades || []).map(mapTrade);
        state.withdrawals = admin.withdrawals || [];
        state.payments = admin.payments || [];
        state.conversations = (admin.conversations || []).map(mapConversation);
      }
    }
    return state;
  } catch {
    return null;
  }
}

function mapConversation(c: any): SupportConversation {
  return {
    id: c.id,
    email: c.email,
    userName: c.user_name || c.userName || c.email,
    status: c.status === 'resolved' ? 'resolved' : 'open',
    createdAt: Number(c.created_at ?? c.createdAt ?? 0),
    updatedAt: c.updated_at ? Number(c.updated_at) : undefined,
    messages: Array.isArray(c.messages) ? c.messages : [],
  };
}

export async function saveState(payload: ServerState | string): Promise<boolean> {
  try {
    const isAdmin = await callRpc<any>('is_admin').then((d) => !!d, () => false);
    if (!isAdmin) return true;
    let blob: unknown = payload;
    if (typeof payload === 'string') {
      try {
        blob = JSON.parse(payload);
      } catch {
        return false;
      }
    }
    const res = await callRpc<any>('admin_save_state', { blob });
    return !!(res && res.ok);
  } catch {
    return false;
  }
}

// ---------- Auth ----------
export async function registerAccount(input: RegisterInput): Promise<AuthResult> {
  try {
    const { data, error } = await sb.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        data: {
          name: input.name,
          country: input.country,
          phone: input.phone,
          dob: input.dob,
          referrer: input.referrer,
        },
      },
    });
    if (error) return { ok: false, error: error.message };
    const userId = data.user?.id;
    if (!userId) return { ok: false, error: 'Unable to create account.' };

    await callRpc<any>('save_account_profile', {
      payload: { country: input.country, phone: input.phone, dob: input.dob, referrer: input.referrer },
    }).catch(() => {});

    const { data: profile } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
    const account = profile ? mapProfileToAccount(profile) : undefined;
    const token = data.session?.access_token || (await currentAccessToken()) || undefined;
    if (token) setAuthToken(token);
    return { ok: true, account, role: profile?.role || 'user', token };
  } catch (e: any) {
    return { ok: false, error: describeAuthError(e) };
  }
}

export async function loginAccount(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) return { ok: false, error: error.message || 'Invalid email or password.' };
    const userId = data.user?.id;
    if (!userId) return { ok: false, error: 'Unable to sign in.' };

    const { data: profile } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
    const role: 'user' | 'admin' = profile?.role === 'admin' ? 'admin' : 'user';
    let account: any;
    if (profile) {
      const { data: my } = await callRpc<any>('get_my_state');
      const investments = (my?.investments || []).map(mapInvestment);
      account = mapProfileToAccount(profile, investments);
    }
    const token = data.session?.access_token || undefined;
    if (token) setAuthToken(token);
    return { ok: true, account, role, token };
  } catch (e: any) {
    return { ok: false, error: describeAuthError(e) };
  }
}

export async function saveAccount(updates: unknown): Promise<boolean> {
  try {
    const res = await callRpc<any>('save_account_profile', { payload: updates as Record<string, unknown> });
    return !!(res && res.ok);
  } catch {
    return false;
  }
}

export async function changeAccountPassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = (await sb.auth.getSession()).data?.session?.user;
    if (!user?.email) return { ok: false, error: 'You must be signed in to change your password.' };
    const verify = await sb.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verify.error) return { ok: false, error: 'Current password is incorrect.' };
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error. Please try again.' };
  }
}

export async function logout(): Promise<void> {
  await sb.auth.signOut();
  clearAuthToken();
}

// ---------- Session state ----------
export async function getMyState(): Promise<{ profile?: any; investments?: any[]; p2pTrades?: any[]; payments?: any[]; withdrawals?: any[] } | null> {
  try {
    const data = await callRpc<any>('get_my_state');
    if (!data) return null;
    return {
      profile: data.profile,
      investments: (data.investments || []).map(mapInvestment),
      p2pTrades: (data.p2pTrades || []).map(mapTrade),
      payments: data.payments || [],
      withdrawals: data.withdrawals || [],
    };
  } catch {
    return null;
  }
}

// ---------- P2P Listings & Payment Validation ----------
export async function submitP2POffer(offer: Record<string, unknown>): Promise<{ ok: boolean; error?: string; offer?: Record<string, unknown> }> {
  try {
    const res = await callRpc<any>('submit_p2p_offer', { offer });
    if (!res?.ok) return { ok: false, error: res?.error || 'Unable to submit ad.' };
    return { ok: true, offer: res.offer ? mapOffer(res.offer) : undefined };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error. Please try again.' };
  }
}

export async function approveP2POffer(offerId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await callRpc<any>('approve_p2p_offer', { p_offer_id: offerId });
    return res?.ok ? { ok: true } : { ok: false, error: res?.error || 'Unable to approve.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function rejectP2POffer(offerId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await callRpc<any>('reject_p2p_offer', { p_offer_id: offerId });
    return res?.ok ? { ok: true } : { ok: false, error: res?.error || 'Unable to reject.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function moveP2POffer(offerId: string, direction: 'up' | 'down'): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await callRpc<any>('admin_p2p_move', { p_offer_id: offerId, p_direction: direction });
    return res?.ok ? { ok: true } : { ok: false, error: res?.error || 'Unable to move listing.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function submitP2PPayment(trade: Record<string, unknown>): Promise<{ ok: boolean; error?: string; trade?: Record<string, unknown> }> {
  try {
    const res = await callRpc<any>('submit_p2p_payment', { trade });
    if (!res?.ok) return { ok: false, error: res?.error || 'Unable to submit payment.' };
    return { ok: true, trade: res.trade ? mapTrade(res.trade) : undefined };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error. Please try again.' };
  }
}

export async function approveP2PPayment(tradeId: string): Promise<{ ok: boolean; error?: string; credited?: boolean }> {
  try {
    const res = await callRpc<any>('approve_p2p_payment', { p_trade_id: tradeId });
    return res?.ok ? { ok: true, credited: !!res.credited } : { ok: false, error: res?.error || 'Unable to approve payment.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function rejectP2PPayment(tradeId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await callRpc<any>('reject_p2p_payment', { p_trade_id: tradeId });
    return res?.ok ? { ok: true } : { ok: false, error: res?.error || 'Unable to reject payment.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

// ---------- Admin: Set XENA Price ----------
export async function setXenaPrice(price: number, ngnRate?: number): Promise<{ ok: boolean; error?: string; price?: number; xenaNgnRate?: number }> {
  try {
    const res = await callRpc<any>('admin_set_price', { p_price: price, ...(ngnRate != null ? { p_ngn_rate: ngnRate } : {}) });
    if (!res?.ok) return { ok: false, error: res?.error || 'Unable to update price.' };
    return { ok: true, price: Number(res.price ?? price), xenaNgnRate: res.xenaNgnRate != null ? Number(res.xenaNgnRate) : undefined };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function updateLimits(minDeposit: number, minWithdrawal: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await callRpc<any>('admin_update_limits', { p_min_deposit: minDeposit, p_min_withdrawal: minWithdrawal });
    return res?.ok ? { ok: true } : { ok: false, error: res?.error || 'Unable to update limits.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function updateAdminSettings(flags: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await callRpc<any>('admin_update_settings', { p_flags: flags });
    return res?.ok ? { ok: true } : { ok: false, error: res?.error || 'Unable to update settings.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function replaceAnnouncements(items: any[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await callRpc<any>('admin_replace_announcements', { items });
    return res?.ok ? { ok: true } : { ok: false, error: res?.error || 'Unable to update announcements.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function replacePromos(items: any[]): Promise<{ ok: boolean; error?: string; promos?: any[] }> {
  try {
    const res = await callRpc<any>('admin_replace_promos', { items });
    return res?.ok ? { ok: true, promos: res.promos } : { ok: false, error: res?.error || 'Unable to update promo codes.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

// ---------- Admin: Delete User Account ----------
export async function deleteUserAccount(targetEmail: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await currentAccessToken();
    if (!token) return { ok: false, error: 'You must be signed in.' };
    const res = await fetch('/api/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email: targetEmail }),
    });
    const data = await res.json();
    return data?.ok ? { ok: true } : { ok: false, error: data?.error || 'Unable to delete account.' };
  } catch {
    return { ok: false, error: 'Network error.' };
  }
}

export async function resetUserPassword(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await currentAccessToken();
    if (!token) return { ok: false, error: 'You must be signed in.' };
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email, password }),
    });
    const data = await res.json();
    return data?.ok ? { ok: true } : { ok: false, error: data?.error || 'Unable to reset password.' };
  } catch {
    return { ok: false, error: 'Network error.' };
  }
}

// ---------- Admin: Adjust User Balance ----------
export async function adjustUserBalance(targetEmail: string, amount: number, memo?: string): Promise<{ ok: boolean; error?: string; newBalance?: number }> {
  try {
    const res = await callRpc<any>('admin_adjust_balance', { p_target_email: targetEmail, p_amount: amount, p_memo: memo || null });
    if (!res?.ok) return { ok: false, error: res?.error || 'Unable to adjust balance.' };
    return { ok: true, newBalance: res.newBalance != null ? Number(res.newBalance) : undefined };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

// ---------- Support Conversations ----------
export async function getSupportConversations(): Promise<{ ok: boolean; error?: string; conversations?: SupportConversation[] }> {
  try {
    const res = await callRpc<any>('get_support_conversations');
    if (!res) return { ok: false, error: 'Unable to load conversations.' };
    return { ok: true, conversations: (res || []).map(mapConversation) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function sendSupportMessage(text: string): Promise<{ ok: boolean; error?: string; conversation?: SupportConversation }> {
  try {
    const res = await callRpc<any>('send_support_message', { p_text: text });
    if (!res?.ok) return { ok: false, error: res?.error || 'Unable to send message.' };
    return { ok: true, conversation: res.conversation ? mapConversation(res.conversation) : undefined };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function replySupportConversation(email: string, text: string): Promise<{ ok: boolean; error?: string; conversation?: SupportConversation }> {
  try {
    const res = await callRpc<any>('reply_support_conversation', { p_email: email, p_text: text });
    if (!res?.ok) return { ok: false, error: res?.error || 'Unable to send reply.' };
    return { ok: true, conversation: res.conversation ? mapConversation(res.conversation) : undefined };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function resolveSupportConversation(conversationId: string, status: 'open' | 'resolved'): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await callRpc<any>('resolve_support_conversation', { p_conversation_id: conversationId, p_status: status });
    return res?.ok ? { ok: true } : { ok: false, error: res?.error || 'Unable to update conversation.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

// ---------- Investments ----------
export async function stakeVault(vaultId: string): Promise<{ ok: boolean; error?: string; investment?: any }> {
  try {
    const res = await callRpc<any>('user_stake_vault', { p_vault_id: vaultId });
    if (!res?.ok) return { ok: false, error: res?.error || 'Unable to stake.' };
    return { ok: true, investment: res.investment ? mapInvestment(res.investment) : undefined };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function claimYield(investmentId: string): Promise<{ ok: boolean; error?: string; amount?: number }> {
  try {
    const res = await callRpc<any>('user_claim_yield', { p_investment_id: investmentId });
    if (!res?.ok) return { ok: false, error: res?.error || 'Unable to claim yield.' };
    return { ok: true, amount: res.amount != null ? Number(res.amount) : undefined };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function redeemPromoCode(code: string): Promise<{ ok: boolean; error?: string; amount?: number; code?: string; title?: string; label?: string }> {
  try {
    const res = await callRpc<any>('redeem_promo_code', { p_code: code });
    if (!res?.ok) return { ok: false, error: res?.error || 'Unable to redeem code.' };
    return { ok: true, amount: Number(res.amount || 0), code: res.code, title: res.title, label: res.label };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function adminRestartInvestment(investmentId: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  return adminInvestmentAction('admin_restart_investment', investmentId, note);
}
export async function adminCancelInvestment(investmentId: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  return adminInvestmentAction('admin_cancel_investment', investmentId, note);
}
export async function adminPayoutInvestment(investmentId: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  return adminInvestmentAction('admin_payout_investment', investmentId, note);
}
async function adminInvestmentAction(name: string, investmentId: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await callRpc<any>(name, { p_investment_id: investmentId, p_note: note || null });
    return res?.ok ? { ok: true } : { ok: false, error: res?.error || 'Action failed.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function adminPayoutAllVaults(): Promise<{ ok: boolean; error?: string; processed?: number }> {
  try {
    const res = await callRpc<any>('admin_payout_all_vaults');
    return res?.ok ? { ok: true, processed: Number(res.processed || 0) } : { ok: false, error: res?.error || 'Payout failed.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

// ---------- Vault Catalog (admin) ----------
export async function adminUpdateVault(vaultId: string, updates: Record<string, unknown>): Promise<{ ok: boolean; error?: string; vault?: any }> {
  try {
    const res = await callRpc<any>('admin_update_vault', { p_vault_id: vaultId, updates });
    if (!res?.ok) return { ok: false, error: res?.error || 'Unable to update vault.' };
    return { ok: true, vault: res.vault ? mapVault(res.vault) : undefined };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function adminAddVault(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const res = await callRpc<any>('admin_add_vault', { payload });
    return res?.ok ? { ok: true, id: res.id } : { ok: false, error: res?.error || 'Unable to add vault.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function adminDeleteVault(vaultId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await callRpc<any>('admin_delete_vault', { p_vault_id: vaultId });
    return res?.ok ? { ok: true } : { ok: false, error: res?.error || 'Unable to delete vault.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

// ---------- Withdrawals ----------
export async function createWithdrawalRequest(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string; request?: any }> {
  try {
    const res = await callRpc<any>('create_withdrawal_request', { payload });
    if (!res?.ok) return { ok: false, error: res?.error || 'Unable to submit withdrawal.' };
    return { ok: true, request: res.request };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

export async function adminDecideWithdrawal(requestId: string, decision: 'approved' | 'rejected', note?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await callRpc<any>('admin_decide_withdrawal', { p_request_id: requestId, p_decision: decision, p_note: note || null });
    return res?.ok ? { ok: true } : { ok: false, error: res?.error || 'Unable to update request.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

// ---------- Payments (serverless) ----------
async function postServerless(path: string, body: unknown): Promise<any | null> {
  try {
    const token = await currentAccessToken();
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...(body as object) }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function flutterwaveInitialize(amountNgn: number): Promise<{ ok: boolean; error?: string; reference?: string; txRef?: string; paymentLink?: string; publicKey?: string }> {
  const data = await postServerless('/api/flutterwave/initialize', { amountNgn });
  if (!data) return { ok: false, error: 'Network error.' };
  return data?.ok
    ? { ok: true, reference: data.reference, txRef: data.tx_ref, paymentLink: data.payment_link, publicKey: data.public_key }
    : { ok: false, error: data?.error || 'Unable to initialize payment.' };
}

export async function flutterwaveVerify(txRef: string): Promise<{ ok: boolean; error?: string; xena?: number }> {
  const data = await postServerless('/api/flutterwave/verify', { tx_ref: txRef });
  if (!data) return { ok: false, error: 'Network error.' };
  return data?.ok ? { ok: true, xena: Number(data.xena || 0) } : { ok: false, error: data?.error || 'Payment not confirmed.' };
}

// Legacy aliases for compatibility
export const paystackInitialize = flutterwaveInitialize;
export const paystackVerify = flutterwaveVerify;

export async function cryptoCreateInvoice(coin: string, amountUsd: number): Promise<{ ok: boolean; error?: string; invoice?: any }> {
  const data = await postServerless('/api/crypto/create', { coin, amountUsd });
  if (!data) return { ok: false, error: 'Network error.' };
  return data?.ok ? { ok: true, invoice: data } : { ok: false, error: data?.error || 'Unable to create invoice.' };
}

export { mapVault };
