// Minimal Gemini API client (models.generateContent with JSON output).
// The key goes in the x-goog-api-key header, never in the URL, so it can't leak into logs.

import { env } from '../../../config/env.js'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

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
  // Messages are shown to users, so they say "AI" only; which provider/model and why goes to the log.
  if (status === 429) return new AiError('AI_RATE_LIMITED', 'The AI planner is busy right now. Try again in a minute.', logDetail)
  if (status === 401 || status === 403 || /api key/i.test(detail)) return new AiError('AI_AUTH', 'AI planning isn’t available right now.', logDetail)
  if (status === 404) return new AiError('AI_MODEL', 'AI planning isn’t available right now.', logDetail)
  if (status >= 500) return new AiError('AI_UNAVAILABLE', 'The AI planner is temporarily unavailable.', logDetail)
  return new AiError('AI_REQUEST', 'The AI planner couldn’t process the request.', logDetail)
}

/** The main model first, then the fallbacks (no duplicates). */
export const modelChain = () => [...new Set([env.GEMINI_MODEL, ...env.GEMINI_FALLBACK_MODELS])]

// Worth trying the next model: overloaded (500/503), out of quota (429), or not offered (404).
const TRY_NEXT_MODEL = new Set([404, 429, 500, 503])
const MIN_CALL_MS = 3000
const SECOND_PASS_PAUSE_MS = 2000
const SECOND_PASS_MIN_MS = 10_000 // only go round again if this much time is left

/**
 * Sends a conversation and returns { json, text, model }: the parsed JSON reply, the raw
 * text (to append to `contents` for a follow-up turn) and which model answered.
 * Tries each model in `models` until one answers, all within `deadline` (epoch ms).
 *
 * contents: [{ role: 'user' | 'model', text }]
 */
export async function generateJson({ system, contents, schema, deadline = Date.now() + env.AI_TIMEOUT_MS, models = modelChain() }) {
  if (!isAiConfigured()) throw new AiError('AI_DISABLED', 'AI planning isn’t set up on this server.')

  // Two passes over the models: "busy" spikes often clear within seconds, so if every
  // model was busy and time is left, pause briefly and go round once more.
  const attempts = [...models.map((model) => ({ model, pass: 1 })), ...models.map((model) => ({ model, pass: 2 }))]
  const failures = []
  let lastError = null
  for (const [index, { model, pass }] of attempts.entries()) {
    if (pass === 2 && index === models.length) {
      if (deadline - Date.now() < SECOND_PASS_MIN_MS) break
      await new Promise((resolve) => setTimeout(resolve, SECOND_PASS_PAUSE_MS))
    }
    const remaining = deadline - Date.now()
    if (remaining < MIN_CALL_MS) break
    // A model that hangs mustn't use up the whole budget: each attempt except the last gets
    // at most half of the time left, so the others still get their turn.
    const isLast = index === attempts.length - 1
    // Whole milliseconds: AbortSignal.timeout() rejects fractions.
    const timeoutMs = Math.floor(Math.min(env.AI_TIMEOUT_MS, isLast ? remaining : Math.max(MIN_CALL_MS, remaining / 2)))
    let response
    try {
      response = await fetch(`${BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: contents.map(({ role, text }) => ({ role, parts: [{ text }] })),
          generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError'
      lastError = timedOut
        ? new AiError('AI_TIMEOUT', 'The AI planner took too long to answer.')
        : new AiError('AI_UNAVAILABLE', 'Couldn’t reach the AI planner.')
      failures.push(`${model}: ${timedOut ? 'timed out' : `${error.name}: ${error.message}`}`)
      continue
    }

    const body = await response.json().catch(() => null)
    if (!response.ok) {
      const error = describeHttpError(response.status, body)
      failures.push(`${model}: ${error.detail}`)
      error.detail = failures.join(' | ')
      if (TRY_NEXT_MODEL.has(response.status)) {
        lastError = error
        continue
      }
      throw error // e.g. a rejected key: another model won't help
    }
    return { ...parseAnswer(body), model }
  }
  const error = lastError ?? new AiError('AI_TIMEOUT', 'The AI planner took too long to answer.')
  // Every model's reason, for the server log.
  error.detail = failures.join(' | ') || error.detail
  throw error
}

function parseAnswer(body) {
  const candidate = body?.candidates?.[0]
  if (!candidate) {
    const reason = body?.promptFeedback?.blockReason
    throw new AiError('AI_BLOCKED', 'The AI planner returned no answer.', reason ? `blocked: ${reason}` : undefined)
  }
  if (candidate.finishReason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(candidate.finishReason)) {
    throw new AiError('AI_BAD_OUTPUT', 'The AI planner stopped early.', `finishReason: ${candidate.finishReason}`)
  }
  // Skip "thought" parts some models include; keep the answer text.
  const text = (candidate.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
  try {
    return { json: JSON.parse(text), text }
  } catch {
    throw new AiError('AI_BAD_OUTPUT', 'The AI planner’s answer couldn’t be read.', 'reply was not valid JSON')
  }
}

