import { hasDb } from '@/lib/db';
import { safeError } from '@/lib/http';
import { validWebhook, verifyPayment } from '@/lib/academy/paystack';
import { activateByReference } from '@/lib/academy/enrol';

/** Paystack calls this after a payment. Set the webhook URL in Paystack to https://www.markiqsi.com/api/paystack/webhook */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!validWebhook(raw, req.headers.get('x-paystack-signature'))) return new Response('bad signature', { status: 401 });
  if (!hasDb()) return new Response('ok');
  try {
    const evt = JSON.parse(raw) as { event?: string; data?: { reference?: string } };
    const ref = evt.data?.reference;
    if (evt.event === 'charge.success' && ref) {
      // Never trust the webhook body for the amount: ask Paystack directly.
      const v = await verifyPayment(ref);
      if (v.status === 'success') await activateByReference(ref, v);
    }
  } catch (e) {
    console.error('paystack webhook', safeError(e));
  }
  return new Response('ok');
}
