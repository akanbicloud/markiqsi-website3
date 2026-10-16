import { test } from 'node:test';
import assert from 'node:assert/strict';

test('academy: discount maths never goes below the floor', async () => {
  const { discounted, normalizeCode, validCodeShape } = await import('../src/lib/academy/codes');
  assert.deepEqual(discounted(50000, 'NGN', { percent: 10, amount_ngn: null, amount_usd: null }), { now: 45000, off: 5000 });
  assert.deepEqual(discounted(70000, 'NGN', { percent: 15, amount_ngn: null, amount_usd: null }), { now: 59500, off: 10500 });
  assert.deepEqual(discounted(35, 'USD', { percent: 10, amount_ngn: null, amount_usd: null }), { now: 31, off: 4 });
  assert.deepEqual(discounted(50000, 'NGN', { percent: null, amount_ngn: 70000, amount_usd: null }), { now: 1000, off: 49000 });
  assert.deepEqual(discounted(35, 'USD', { percent: null, amount_ngn: 5000, amount_usd: null }), { now: 35, off: 0 });
  assert.equal(normalizeCode(' launch 10 '), 'LAUNCH10');
  assert.ok(validCodeShape('LAUNCH10'));
  assert.ok(!validCodeShape('X'));
  assert.ok(!validCodeShape('BAD CODE!'));
});

test('academy: lesson keys and certificate ids', async () => {
  const { lessonKeys, newCertificateId } = await import('../src/lib/academy/progress');
  const { COURSES } = await import('../src/lib/content/courses');
  const c = COURSES[0];
  const keys = lessonKeys(c);
  assert.equal(keys.length, c.outline.reduce((n, w) => n + w.lessons.length, 0));
  assert.equal(keys[0], '0-0');
  assert.match(newCertificateId(new Date('2026-10-16T00:00:00Z')), /^MQ-2026-[A-HJ-NP-Z2-9]{6}$/);
});
