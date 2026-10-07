export const ZONES: { key: string; label: string; tz: string; short: string }[] = [
  { key: 'WAT', label: 'Lagos (WAT)', tz: 'Africa/Lagos', short: 'WAT' },
  { key: 'GMT', label: 'GMT', tz: 'UTC', short: 'GMT' },
  { key: 'London', label: 'London', tz: 'Europe/London', short: 'London' },
  { key: 'New York', label: 'New York', tz: 'America/New_York', short: 'New York' },
  { key: 'Johannesburg', label: 'Johannesburg', tz: 'Africa/Johannesburg', short: 'Joburg' },
  { key: 'Dubai', label: 'Dubai', tz: 'Asia/Dubai', short: 'Dubai' },
];

export function fmtTime(isoStr: string, tz: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(isoStr));
}

export function dayKey(isoStr: string | number | Date, tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(isoStr));
}

export function dayLabel(key: string, tz: string, now = Date.now()) {
  const today = dayKey(now, tz);
  const tomorrow = dayKey(now + 86400000, tz);
  if (key === today) return 'Today';
  if (key === tomorrow) return 'Tomorrow';
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function fmtDate(isoStr: string, tz: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(isoStr));
}

export function fmtDay(isoStr: string | null) {
  if (!isoStr) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(isoStr));
}

export function countdown(isoStr: string, now: number) {
  const diff = new Date(isoStr).getTime() - now;
  if (diff < -60_000) return 'Released';
  if (diff < 60_000) return 'Now';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `In ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `In ${h} hr ${mins % 60} min`;
  return `In ${Math.floor(h / 24)} days`;
}

function localHour(tz: string, now: number) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date(now));
  const g = (t: string) => p.find((x) => x.type === t)?.value || '0';
  return { h: Number(g('hour')) + Number(g('minute')) / 60, wd: g('weekday') };
}

const SESSIONS = [
  { city: 'Sydney', tz: 'Australia/Sydney', open: 7, close: 16 },
  { city: 'Tokyo', tz: 'Asia/Tokyo', open: 9, close: 18 },
  { city: 'London', tz: 'Europe/London', open: 8, close: 17 },
  { city: 'New York', tz: 'America/New_York', open: 8, close: 17 },
];

export function openSessions(now: number) {
  return SESSIONS.filter((s) => {
    const { h, wd } = localHour(s.tz, now);
    if (wd === 'Sat' || wd === 'Sun') return false;
    return h >= s.open && h < s.close;
  }).map((s) => s.city);
}
