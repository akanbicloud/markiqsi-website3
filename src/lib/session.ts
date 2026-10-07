import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'mq_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET must be set (at least 32 characters)');
  return new TextEncoder().encode(s);
}

export type Session = { uid: number; email: string };

export async function createSessionToken(s: Session) {
  return new SignJWT({ email: s.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(s.uid))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

export async function readSessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const uid = Number(payload.sub);
    if (!uid || typeof payload.email !== 'string') return null;
    return { uid, email: payload.email };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  if (!process.env.AUTH_SECRET) return null;
  return readSessionToken(c.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE,
};
