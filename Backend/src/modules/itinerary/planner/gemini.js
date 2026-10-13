// Minimal Gemini API client (models.generateContent with JSON output).
// The key goes in the x-goog-api-key header, never in the URL, so it can't leak into logs.

import { env } from '../../../config/env.js'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const OVERLOADED = new Set([500, 503])
const OVERLOAD_RETRY_MS = 2000

export class AiError extends Error {
  /** `detail`: what Gemini itself said (status + message), for the server log only. */
  constructor(code, message, detail) {
    super(message)
    this.name = 'AiError'
    this.code = code
    this.detail = detail
  }
}

export const isAiConfigured = () => Boolean(env.GEMINI_API_KEY)

function describeHttpError(status, body) {
  const detail = body?.error?.message ?? ''
  const logDetail = `HTTP ${status}${body?.error?.status ? ` ${body.error.status}` : ''}: ${detail.slice(0, 300) || 'no message'}`
  if (status === 429) return new AiError('AI_RATE_LIMITED', 'Gemini’s usage limit was reached. Try again in a minute.', logDetail)
  if (status === 401 || status === 403 || /api key/i.test(detail)) return new AiError('AI_AUTH', 'Gemini rejected the API key. Check GEMINI_API_KEY in Backend/.env.', logDetail)
  if (status === 404) return new AiError('AI_MODEL', `Gemini model “${env.GEMINI_MODEL}” isn’t available. Check GEMINI_MODEL in Backend/.env.`, logDetail)
  if (status >= 500) return new AiError('AI_UNAVAILABLE', 'Gemini is temporarily unavailable.', logDetail)
  return new AiError('AI_REQUEST', `Gemini couldn’t process the request (${status}).`, logDetail)
}

/**
 * Sends a conversation and returns the parsed JSON reply plus the raw text
 * (to append to `contents` for a follow-up turn).
 *
 * contents: [{ role: 'user' | 'model', text }]
 */
export async function generateJson({ system, contents, schema, timeoutMs = env.AI_TIMEOUT_MS }) {
  if (!isAiConfigured()) throw new AiError('AI_DISABLED', 'AI planning isn’t set up on this server.')

  const request = () =>
    fetch(`${BASE_URL}/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: contents.map(({ role, text }) => ({ role, parts: [{ text }] })),
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

  let response
  try {
    response = await request()
    // "Model overloaded" spikes (500/503) are usually brief: one retry after a short pause.
    if (OVERLOADED.has(response.status)) {
      await new Promise((resolve) => setTimeout(resolve, OVERLOAD_RETRY_MS))
      response = await request()
    }
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new AiError('AI_TIMEOUT', 'Gemini took too long to answer.')
    throw new AiError('AI_UNAVAILABLE', 'Couldn’t reach Gemini.', `${error.name}: ${error.message}`)
  }

  const body = await response.json().catch(() => null)
  if (!response.ok) throw describeHttpError(response.status, body)

  const candidate = body?.candidates?.[0]
  if (!candidate) {
    const reason = body?.promptFeedback?.blockReason
    throw new AiError('AI_BLOCKED', reason ? `Gemini declined the request (${reason}).` : 'Gemini returned no answer.')
  }
  if (candidate.finishReason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(candidate.finishReason)) {
    throw new AiError('AI_BAD_OUTPUT', `Gemini stopped early (${candidate.finishReason}).`)
  }
  // Skip "thought" parts some models include; keep the answer text.
  const text = (candidate.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
  try {
    return { json: JSON.parse(text), text }
  } catch {
    throw new AiError('AI_BAD_OUTPUT', 'Gemini’s answer wasn’t valid JSON.')
  }
}
