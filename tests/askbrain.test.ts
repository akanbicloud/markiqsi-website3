import { test } from 'node:test';
import assert from 'node:assert/strict';

test('ask brain: finds the markets in a question', async () => {
  const { detectAssets } = await import('../src/lib/askbrain');
  assert.deepEqual(detectAssets('Why did gold fall today?').map((a) => a.key), ['Gold']);
  assert.deepEqual(detectAssets('is the pound stronger than the yen').map((a) => a.key).sort(), ['GBP/USD', 'USD/JPY']);
  assert.deepEqual(detectAssets('what is a pip').map((a) => a.key), []);
  assert.deepEqual(detectAssets('what about it', 'EUR/USD').map((a) => a.key), ['EUR/USD']);
});

test('ask brain: removes invented price levels, keeps real ones and education', async () => {
  const { groundPrices } = await import('../src/lib/askbrain');
  const data = { prices: [{ market: 'Gold', last_price: 4123.45 }, { market: 'EUR/USD', last_price: 1.08734 }] };
  const out = groundPrices('Gold is at 4123.45 now. It could reach 4250.000 soon. A pip on EUR/USD is 0.0001 of the price.\n- Risk 1% per trade.', data);
  assert.match(out, /4123\.45/);
  assert.doesNotMatch(out, /4250/);
  assert.match(out, /0\.0001/); // pip sizes are education, not price levels
  assert.match(out, /Risk 1% per trade/);
  assert.equal(groundPrices('EUR/USD last traded at 1.08734.', data), 'EUR/USD last traded at 1.08734.');
});

test('ask brain: platform facts carry the real course prices', async () => {
  const { platformFacts } = await import('../src/lib/askbrain');
  const f = platformFacts();
  const pro = f.courses.find((c) => c.title.toLowerCase().includes('pro'));
  assert.ok(pro);
  assert.match(pro!.physical, /250,000/);
  assert.match(f.academy.address, /Majek Kembo Plaza/);
});
