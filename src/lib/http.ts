import { NextResponse } from 'next/server';

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function fail(message: string, status = 400) {
  return json({ ok: false, error: message }, status);
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export function clientIp(req: Request) {
  const f = req.headers.get('x-forwarded-for');
  return (f ? f.split(',')[0] : req.headers.get('x-real-ip')) || 'unknown';
}

export function str(v: unknown, max = 500) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;
}

/** An error message that is safe to show: connection strings, keys and long tokens are hidden. */
export function safeError(e: unknown) {
  return String((e as Error)?.message ?? e)
    .replace(/postgres(ql)?:\/\/\S+/gi, 'postgres://***')
    .replace(/apikey=\S+/gi, 'apikey=***')
    .replace(/bot\d+:[\w-]+/g, 'bot***')
    .replace(/[A-Za-z0-9_-]{28,}/g, '***')
    .slice(0, 300);
}
