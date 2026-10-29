// Free-tier LLM wrapper with provider fallback. No paid Claude/OpenAI calls.
// Providers are tried in order (LLM_ORDER, default gemini,groq,openrouter); a provider
// is only used if its API key is set. Model names are env-overridable because free-tier
// model names change — if one starts returning 404, just update the env var.

type Provider = {
  name: string
  model: string
  call: (system: string, user: string, temperature: number) => Promise<string>
}

const TIMEOUT_MS = 25_000

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200)
    throw new Error(`HTTP ${res.status} ${detail}`)
  }
  return res.json()
}

function buildProviders(): Provider[] {
  const all: Record<string, Provider | null> = {
    gemini: process.env.GEMINI_API_KEY ? (() => {
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
      const key = process.env.GEMINI_API_KEY!
      return {
        name: 'gemini', model,
        call: async (system, user, temperature) => {
          const d = await postJson(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            { 'x-goog-api-key': key },
            {
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: 'user', parts: [{ text: user }] }],
              generationConfig: { temperature, responseMimeType: 'application/json' },
            },
          ) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
          return (d.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('')
        },
      } satisfies Provider
    })() : null,

    groq: process.env.GROQ_API_KEY ? (() => {
      const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
      const key = process.env.GROQ_API_KEY!
      return {
        name: 'groq', model,
        call: async (system, user, temperature) => {
          const d = await postJson(
            'https://api.groq.com/openai/v1/chat/completions',
            { authorization: `Bearer ${key}` },
            {
              model, temperature,
              response_format: { type: 'json_object' },
              messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            },
          ) as { choices?: { message?: { content?: string } }[] }
          return d.choices?.[0]?.message?.content ?? ''
        },
      } satisfies Provider
    })() : null,

    openrouter: process.env.OPENROUTER_API_KEY ? (() => {
      const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free'
      const key = process.env.OPENROUTER_API_KEY!
      return {
        name: 'openrouter', model,
        call: async (system, user, temperature) => {
          const d = await postJson(
            'https://openrouter.ai/api/v1/chat/completions',
            { authorization: `Bearer ${key}` },
            {
              model, temperature,
              messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            },
          ) as { choices?: { message?: { content?: string } }[] }
          return d.choices?.[0]?.message?.content ?? ''
        },
      } satisfies Provider
    })() : null,
  }

  const order = (process.env.LLM_ORDER || 'gemini,groq,openrouter').split(',').map(s => s.trim())
  return order.map(n => all[n]).filter((p): p is Provider => !!p)
}

export class LlmError extends Error {}

export function llmConfigured(): boolean {
  return buildProviders().length > 0
}

function extractJson<T>(text: string): T {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('no JSON object in reply')
  return JSON.parse(text.slice(start, end + 1)) as T
}

export async function llmJson<T>(opts: {
  system: string
  user: string
  temperature?: number
}): Promise<{ data: T; provider: string; model: string }> {
  const providers = buildProviders()
  if (providers.length === 0) {
    throw new LlmError('No free AI provider configured. Add GEMINI_API_KEY, GROQ_API_KEY or OPENROUTER_API_KEY to the environment.')
  }
  const failures: string[] = []
  for (const p of providers) {
    try {
      const text = await p.call(opts.system, opts.user, opts.temperature ?? 0.9)
      return { data: extractJson<T>(text), provider: p.name, model: p.model }
    } catch (e) {
      failures.push(`${p.name}: ${(e as Error).message}`)
    }
  }
  throw new LlmError(`All AI providers failed — ${failures.join(' | ')}`)
}
