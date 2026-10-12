import { createHmac, timingSafeEqual } from 'crypto';

/** Paystack is switched on by setting PAYSTACK_SECRET_KEY. Dollar payments also need PAYSTACK_USD=1 (Paystack must approve USD first). */
export function paystackReady() {
  return !!process.env.PAYSTACK_SECRET_KEY;
}

export function paystackCurrencies(): ('NGN' | 'USD')[] {
  return process.env.PAYSTACK_USD === '1' ? ['NGN', 'USD'] : ['NGN'];
}

async function call(path: string, init?: RequestInit) {
  const r = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const d = (await r.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: Record<string, unknown> };
  if (!r.ok || !d.status) throw new Error(d.message || `Paystack returned HTTP ${r.status}`);
  return d.data || {};
}

/** Amount is in whole Naira or dollars; Paystack wants the smallest unit (kobo or cents). */
export async function initializePayment(opts: { email: string; amount: number; currency: 'NGN' | 'USD'; reference: string; callbackUrl: string; metadata: Record<string, unknown> }) {
  const data = await call('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({ email: opts.email, amount: Math.round(opts.amount * 100), currency: opts.currency, reference: opts.reference, callback_url: opts.callbackUrl, metadata: opts.metadata }),
  });
  return String(data.authorization_url || '');
}

export async function verifyPayment(reference: string) {
  const data = await call(`/transaction/verify/${encodeURIComponent(reference)}`);
  return { status: String(data.status || ''), amount: Number(data.amount || 0) / 100, currency: String(data.currency || '') };
}

/** Checks the x-paystack-signature header (HMAC SHA-512 of the raw body with the secret key). */
export function validWebhook(raw: string, signature: string | null) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !signature) return false;
  const want = createHmac('sha512', key).update(raw).digest('hex');
  const a = Buffer.from(want);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
