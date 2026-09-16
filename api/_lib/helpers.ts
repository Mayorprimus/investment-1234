import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = '/tmp/xena-data';
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DIR, { recursive: true });
  }
}

function loadDb(): any {
  ensureDataDir();
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch {}
  return getSeedDb();
}

function saveDb(db: any) {
  ensureDataDir();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

function getSeedDb() {
  return {
    users: [],
    accounts: [],
    tokens: {},
    pendingPayments: [],
    xenaSettings: {
      limits: { min_deposit_ngn: 3000, minDepositUsd: 10 },
      xena_ngn_rate: { ngnRate: 0.3333 },
      price: { price: 0.0002564 },
    },
  };
}

function getUserByToken(token: string): any | null {
  if (!token) return null;
  const db = loadDb();
  const email = db.tokens?.[token];
  if (!email) return null;
  return db.accounts?.find((a: any) => a.email === email) || null;
}

function getSetting(key: string): any {
  const db = loadDb();
  return db.xenaSettings?.[key]?.value || db.xenaSettings?.[key];
}

function getPendingPayments(): any[] {
  const db = loadDb();
  return db.pendingPayments || [];
}

function savePendingPayment(payment: any) {
  const db = loadDb();
  db.pendingPayments = db.pendingPayments || [];
  db.pendingPayments.unshift(payment);
  saveDb(db);
}

function findPendingPayment(provider: string, reference: string): any | null {
  const db = loadDb();
  return (db.pendingPayments || []).find(
    (p: any) => p.provider === provider && p.reference === reference
  );
}

function updatePendingPayment(reference: string, updates: any): any | null {
  const db = loadDb();
  const idx = (db.pendingPayments || []).findIndex((p: any) => p.reference === reference);
  if (idx === -1) return null;
  db.pendingPayments[idx] = { ...db.pendingPayments[idx], ...updates };
  saveDb(db);
  return db.pendingPayments[idx];
}

function creditUser(email: string, xenaAmount: number, txData: any) {
  const db = loadDb();
  const accIdx = (db.accounts || []).findIndex((a: any) => a.email === email);
  if (accIdx === -1) return false;
  const acc = db.accounts[accIdx];
  acc.balances = acc.balances || {};
  acc.balances.availableXena = (acc.balances.availableXena || 0) + xenaAmount;
  acc.balances.totalBalance = (acc.balances.totalBalance || 0) + xenaAmount;
  acc.transactions = acc.transactions || [];
  acc.transactions.unshift({
    id: `tx-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    ...txData,
    amount: xenaAmount,
    unit: 'XENA',
    status: 'Completed',
    timestamp: new Date().toLocaleString(),
    fee: 0,
  });
  acc.notifications = acc.notifications || [];
  acc.notifications.unshift({
    id: `notif-dep-${Date.now()}`,
    title: txData.notifTitle || 'Deposit Confirmed',
    message: txData.notifMessage || `${xenaAmount.toLocaleString()} XENA credited.`,
    timestamp: 'Just now',
    read: false,
    type: 'transaction',
  });
  saveDb(db);
  return true;
}

export function getAppUrl(): string {
  return (process.env.APP_URL || '').replace(/\/$/, '');
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function readJsonBody(req: VercelRequest): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c: Buffer) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

export async function readRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      try {
        resolve(JSON.stringify(req.body));
      } catch {
        reject(new Error('Invalid body.'));
      }
      return;
    }
    let data = '';
    req.on('data', (c: Buffer) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export function json(res: VercelResponse, data: unknown, status = 200): void {
  res.status(status).json(data);
}

export function handleError(e: unknown, res: VercelResponse): void {
  json(res, { ok: false, error: e instanceof Error ? e.message : 'Unexpected error.' }, 500);
}

export { loadDb, saveDb, getUserByToken, getSetting, getPendingPayments, savePendingPayment, findPendingPayment, updatePendingPayment, creditUser };