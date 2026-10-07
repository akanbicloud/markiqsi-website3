import { currentUser } from '@/lib/users';
import { json } from '@/lib/http';

export async function GET() {
  const u = await currentUser().catch(() => null);
  return json({ ok: true, user: u ? { name: u.name, email: u.email, onboarded: u.onboarded, telegram: !!u.telegram_chat_id } : null });
}
