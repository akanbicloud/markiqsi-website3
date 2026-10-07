import { body, fail, json, str } from '@/lib/http';
import { describeRules, parseStrategy, sanitizeRules, type Rules } from '@/lib/trading/botspec';
import { gemini, parseJson } from '@/lib/gemini';

export async function POST(req: Request) {
  const b = await body(req);
  const text = str(b.text, 3000);
  if (text.length < 10) return fail('Please describe your strategy in a sentence or two.');
  const local = parseStrategy(text);
  let rules = local.rules;
  let questions = local.questions;
  let via = 'rules';
  if (!local.confident && process.env.GEMINI_API_KEY) {
    try {
      const system = `You convert a trader's plain-English strategy into JSON rules for a trading bot. Supported entry kinds ONLY: "ema_cross" (fast, slow), "sma_cross" (fast, slow), "rsi" (period, lower, upper), "macd_cross", "breakout" (lookback). timeframe is one of "H1","H4","D1". direction is "both","long" or "short". symbol like "EURUSD", "XAUUSD", "BTCUSD". Never invent numbers the trader did not give: leave them out instead. If the strategy cannot be expressed with the supported kinds, set "unsupported" to a short plain explanation. Return JSON: {"rules": {...}, "questions": [string], "unsupported": string}`;
      const out = parseJson<{ rules: Partial<Rules>; questions?: string[]; unsupported?: string }>(await gemini(system, text, { json: true, maxTokens: 800 }));
      if (out?.unsupported) return json({ ok: true, unsupported: out.unsupported, rules: null, table: [], questions: [] });
      if (out?.rules?.entry) {
        rules = sanitizeRules({ ...local.rules, ...out.rules, entry: out.rules.entry });
        questions = (out.questions || []).slice(0, 5).map((q) => String(q).slice(0, 200));
        via = 'ai';
      }
    } catch (e) {
      console.error('parse ai', e);
    }
  }
  if (via === 'rules' && !local.confident) {
    return json({ ok: true, unsupported: 'We could not find the entry rule yet. Try wording it like: "Buy EURUSD when the 20 EMA crosses above the 50 EMA on the 1-hour chart. Stop loss 20 pips, take profit 40 pips, risk 1%."', rules: null, table: [], questions: [] });
  }
  return json({ ok: true, rules, table: describeRules(rules), questions, via });
}
