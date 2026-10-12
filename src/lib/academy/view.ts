import { COURSES, money, priceFor, validChoice, type Course, type Currency, type Format } from '../content/courses';

export function enrolOptions(c: Course) {
  const combos: [Format, Currency, string][] = [
    ['online', 'NGN', 'Online class (Naira)'],
    ['online', 'USD', 'Online class (US dollars)'],
    ['physical', 'NGN', 'Physical class in Abeokuta'],
  ];
  return combos
    .filter(([f, cur]) => validChoice(f, cur))
    .map(([format, currency, label]) => {
      const p = priceFor(c, format, currency);
      return { key: `${format}-${currency}`, format, currency, label, list: money(p.list, currency), now: money(p.now, currency), onOffer: p.onOffer };
    });
}

export const BUNDLES: Record<string, string[]> = Object.fromEntries(COURSES.filter((c) => c.bundle).map((c) => [c.slug, c.bundle!]));
