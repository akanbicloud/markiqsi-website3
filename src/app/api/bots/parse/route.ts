import { safeError } from '@/lib/http';
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
      const system = `You convert a trader's plain-English strategy into JSON rules for a trading bot.
Entry kinds you may use (and only these): "sd" supply & demand zones, "sr" support & resistance, "candles" candle patterns, "ibb" inside bar breakout, "fvg" fair value gap, "ob" order block, "bos" break of structure / CHoCH, "liq" liquidity sweep, "ote" optimal trade entry, "london" London breakout, "ema_cross" (fast, slow), "sma_cross" (fast, slow), "pullback" (trendLen, emaLen), "rsi" (period, lower, upper), "macd_cross", "bb" (bbPeriod, bbDev), "stoch" (stochK, stochD, stochSmooth), "supertrend" (stLen, stMult), "breakout" (lookback).
Rules shape: {"name": string, "symbol": "EURUSD"|"XAUUSD"|"BTCUSD"|..., "timeframe": "M1"|"M5"|"M15"|"M30"|"H1"|"H4"|"D1"|"W1"|"MN1", "entry": {"kind": ..., params}, "confirm": {"kind": ..., "within": candles} or null (use when the trader wants one thing to happen before the entry), "trendFilter": "none"|"ema200", "session": "any"|"london"|"newyork"|"london_ny", "direction": "both"|"long"|"short", "stopLossPips": number, "takeProfitPips": number, "riskPercent": number}.
Never invent numbers the trader did not give: leave them out instead. If the strategy cannot be expressed with these pieces, set "unsupported" to a short plain explanation of what is missing. Return JSON only: {"rules": {...}, "questions": [string], "unsupported": string}`;
      const out = parseJson<{ rules: Partial<Rules>; questions?: string[]; unsupported?: string }>(await gemini(system, text, { json: true, maxTokens: 800 }));
      if (out?.unsupported) return json({ ok: true, unsupported: out.unsupported, rules: null, table: [], questions: [] });
      if (out?.rules?.entry) {
        rules = sanitizeRules({ ...local.rules, ...out.rules, entry: out.rules.entry });
        questions = (out.questions || []).slice(0, 5).map((q) => String(q).slice(0, 200));
        via = 'ai';
      }
    } catch (e) {
      console.error('parse ai', safeError(e));
    }
  }
  if (via === 'rules' && !local.confident) {
    return json({ ok: true, unsupported: 'We could not find the entry rule yet. Try wording it like: "Buy EURUSD when the 20 EMA crosses above the 50 EMA on the 1-hour chart. Stop loss 20 pips, take profit 40 pips, risk 1%."', rules: null, table: [], questions: [] });
  }
  return json({ ok: true, rules, table: describeRules(rules), questions, via });
}
