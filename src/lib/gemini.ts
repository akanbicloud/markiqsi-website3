/** `images` are base64 (no data: prefix) with their MIME type, e.g. a chart screenshot. */
export async function gemini(system: string, user: string, opts: { json?: boolean; maxTokens?: number; images?: { mime: string; data: string }[]; timeoutMs?: number } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }, ...(opts.images || []).map((i) => ({ inlineData: { mimeType: i.mime, data: i.data } }))] }],
      generationConfig: {
        temperature: 0.2,
        // Gemini 3 models think before answering and that counts against this limit, so leave room.
        maxOutputTokens: Math.max((opts.maxTokens || 1400) * 4, 8192),
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs || 30000),
  });
  if (!r.ok) {
    // Google's message says what is wrong (e.g. unknown model, image too large, quota), without secrets.
    const why = await r.json().then((x) => String(x?.error?.message || '')).catch(() => '');
    throw new Error(`Gemini error ${r.status}${why ? `: ${why.slice(0, 160)}` : ''} (model ${model})`);
  }
  const d = await r.json();
  const text: string = d?.candidates?.[0]?.content?.parts?.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || '').join('') || '';
  if (!text) throw new Error(`Empty answer (${d?.candidates?.[0]?.finishReason || 'unknown'})`);
  return text;
}

export function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}
