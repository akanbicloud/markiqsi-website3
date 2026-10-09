export async function gemini(system: string, user: string, opts: { json?: boolean; maxTokens?: number } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.2,
        // Gemini 3 models think before answering and that counts against this limit, so leave room.
        maxOutputTokens: Math.max((opts.maxTokens || 1400) * 4, 8192),
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Gemini error ${r.status}`);
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
