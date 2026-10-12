import { body, fail, json, safeError, str } from '@/lib/http';
import { describeIndicator, parseIndicator, sanitizeIndicator, type IndicatorSpec } from '@/lib/trading/indicatorspec';
import { gemini, parseJson } from '@/lib/gemini';
import { quotaMessage, takeQuota } from '@/lib/usage';

const SYSTEM = `You convert a trader's plain-English description of a chart indicator into JSON.
Shape: {"name": string, "lines": [{"type": "ema"|"sma"|"bb"|"supertrend"|"donchian", "length": number, "mult": number}], "panel": {"type": "none"|"rsi"|"macd"|"stoch", "length": number, "lower": number, "upper": number}, "signals": null or {"entry": {"kind": ..., params}, "confirm": {"kind": ..., "within": candles} or null, "trendFilter": "none"|"ema200", "session": "any"|"london"|"newyork"|"london_ny", "direction": "both"|"long"|"short"}, "alerts": boolean}
Signal kinds you may use (and only these): "sd" supply & demand, "sr" support & resistance, "candles" candle patterns, "ibb" inside bar breakout, "fvg" fair value gap, "ob" order block, "bos" break of structure, "liq" liquidity sweep, "ote" optimal trade entry, "london" London breakout, "ema_cross" (fast, slow), "sma_cross" (fast, slow), "pullback" (trendLen, emaLen), "rsi" (period, lower, upper), "macd_cross", "bb" (bbPeriod, bbDev), "stoch" (stochK, stochD, stochSmooth), "supertrend" (stLen, stMult), "breakout" (lookback).
Use "signals" only if the trader wants arrows, signals or alerts. Never invent numbers the trader did not give: leave them out. If the request cannot be built from these pieces, set "unsupported" to a short plain explanation. Return JSON only: {"spec": {...}, "questions": [string], "unsupported": string}`;

export async function POST(req: Request) {
  const b = await body(req);
  const text = str(b.text, 2000);
  if (text.length < 6) return fail('Please describe your indicator in a sentence.');
  const local = parseIndicator(text);
  let spec: IndicatorSpec = local.spec;
  let questions = local.questions;
  let via = 'rules';
  if (!local.confident && process.env.GEMINI_API_KEY) {
    const quota = await takeQuota(req, 'ai_build');
    if (!quota.ok) return fail(quotaMessage(quota, 'AI builds'), 429);
    try {
      const out = parseJson<{ spec?: Partial<IndicatorSpec>; questions?: string[]; unsupported?: string }>(await gemini(SYSTEM, text, { json: true, maxTokens: 900 }));
      if (out?.unsupported) return json({ ok: true, unsupported: out.unsupported, spec: null, table: [], questions: [] });
      if (out?.spec && ((out.spec.lines?.length || 0) > 0 || out.spec.signals || (out.spec.panel && out.spec.panel.type !== 'none'))) {
        spec = sanitizeIndicator(out.spec);
        questions = (out.questions || []).slice(0, 4).map((q) => String(q).slice(0, 200));
        via = 'ai';
      }
    } catch (e) {
      console.error('indicator ai', safeError(e));
    }
  }
  if (via === 'rules' && !local.confident) {
    return json({ ok: true, unsupported: 'We could not work out what to draw yet. Try: "20 and 50 EMA with arrows when they cross" or "RSI 14 with 30 and 70 levels".', spec: null, table: [], questions: local.questions });
  }
  return json({ ok: true, spec, table: describeIndicator(spec), questions, via });
}
