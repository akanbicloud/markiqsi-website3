import { Resend } from 'resend';
import { SITE } from './site';

export async function sendLoginEmail(to: string, link: string, purpose: 'signup' | 'login', name?: string | null) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const resend = new Resend(key);
  const from = process.env.EMAIL_FROM || 'MarkIQ SI <onboarding@resend.dev>';
  const hello = name ? `Hi ${escapeHtml(name.split(' ')[0])},` : 'Hi,';
  const action = purpose === 'signup' ? 'confirm your email and finish creating your account' : 'log in to MarkIQ SI';
  const button = purpose === 'signup' ? 'Confirm my email' : 'Log me in';
  const html = `<!doctype html><html><body style="margin:0;background:#F6F1E9;font-family:Arial,Helvetica,sans-serif;color:#0B1A36">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<div style="height:6px;background:#FFB547;border-radius:6px"></div>
<div style="background:#FFFFFF;border-radius:20px;padding:32px;margin-top:16px">
<p style="font-size:22px;font-weight:bold;margin:0 0 16px">MarkIQ SI</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 12px">${hello}</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 24px">Press the button below to ${action}. This link works once and expires in 15 minutes.</p>
<a href="${link}" style="display:inline-block;background:#0B1A36;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:16px;padding:16px 28px;border-radius:999px">${button}</a>
<p style="font-size:13px;line-height:1.6;color:#5A6780;margin:24px 0 0">If the button does not work, copy this link into your browser:<br><span style="word-break:break-all">${link}</span></p>
<p style="font-size:13px;line-height:1.6;color:#5A6780;margin:16px 0 0">Did not ask for this? You can ignore this email. We will never ask for your trading password.</p>
</div>
<p style="font-size:12px;color:#5A6780;text-align:center;margin-top:16px">${SITE.name} · ${SITE.tagline}</p>
</div></body></html>`;
  const text = `${hello}\n\nOpen this link to ${action} (works once, expires in 15 minutes):\n${link}\n\nDid not ask for this? Ignore this email.`;
  const { error } = await resend.emails.send({
    from,
    to,
    subject: purpose === 'signup' ? 'Confirm your MarkIQ SI account' : 'Your MarkIQ SI login link',
    html,
    text,
  });
  if (error) throw new Error(error.message);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
