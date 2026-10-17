import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { app, auth, signUp, tripWithTeam } from './helpers.js'
import { env } from '../src/config/env.js'
import { prisma } from '../src/config/prisma.js'
import { codePlan, planSettings, scheduleDay } from '../src/modules/itinerary/planner/engine.js'

// Jaipur: two clusters ~10 km apart.
const OLD_CITY = [
  { name: 'Hawa Mahal', lat: 26.9239, lng: 75.8267, category: 'sight', durationMinutes: 60 },
  { name: 'City Palace', lat: 26.9258, lng: 75.8237, category: 'sight', durationMinutes: 120 },
  { name: 'LMB Cafe', lat: 26.9221, lng: 75.8235, category: 'food', durationMinutes: 60 },
]
const AMER = [
  { name: 'Amber Fort', lat: 26.9855, lng: 75.8513, category: 'sight', durationMinutes: 180 },
  { name: 'Panna Meena ka Kund', lat: 26.9878, lng: 75.8559, category: 'sight', durationMinutes: 30 },
]

async function setup() {
  const team = await tripWithTeam()
  const { trip, member } = team
  const places = []
  for (const body of [...OLD_CITY, ...AMER]) {
    const res = await request(app).post(`/api/trips/${trip.id}/places`).set(auth(member.token)).send(body).expect(201)
    places.push(res.body.place)
  }
  const { body } = await request(app).get(`/api/trips/${trip.id}/itinerary`).set(auth(member.token)).expect(200)
  const byName = Object.fromEntries(places.map((p) => [p.name, p]))
  return { ...team, places, byName, days: body.days }
}

const generate = (ctx, user, body) => request(app).post(`/api/trips/${ctx.trip.id}/itinerary/generate`).set(auth(user.token)).send(body)
const allPlaces = (ctx) => ctx.places.map((p) => ({ placeId: p.id, durationMinutes: p.durationMinutes }))

/** Stubs fetch with a queue of Gemini replies: objects become JSON answers, numbers become HTTP errors. */
function mockGemini(...replies) {
  const calls = []
  const fetchMock = vi.fn(async (url, init) => {
    calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) })
    const reply = replies.shift()
    if (typeof reply === 'number') return new Response(JSON.stringify({ error: { message: 'nope' } }), { status: reply })
    return new Response(
      JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(reply) }] } }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

/** The prompt's PLACES list, so tests can answer with the right refs. */
const refsFrom = (call) => {
  const brief = JSON.parse(call.body.contents[0].parts[0].text.split('Brief:\n')[1])
  return Object.fromEntries(brief.PLACES.map((p) => [p.name, p.ref]))
}

beforeEach(() => {
  env.GEMINI_API_KEY = undefined
})
afterEach(() => {
  vi.unstubAllGlobals()
  env.GEMINI_API_KEY = undefined
})

describe('planner engine (code does the math)', () => {
  const settings = planSettings({ dayStart: '09:00', dayEnd: '18:00', pace: 'balanced' })
  const place = (id, lat, lng, durationMinutes = 60) => ({ id, name: id, lat, lng, durationMinutes, score: 0, createdAt: 0 })

  it('schedules around a locked stop with travel time and never past the day end', () => {
    const locked = place('locked', 26.92, 75.82, 120)
    const day = { id: 'd1', dayNumber: 1, fixed: [{ place: locked, start: 10 * 60, end: 12 * 60, durationMinutes: 120 }] }
    const a = place('a', 26.921, 75.821, 90)
    const b = place('b', 26.922, 75.822, 400)
    const { placed, overflow } = scheduleDay(day, [{ place: a }, { place: b }], settings)
    expect(placed).toHaveLength(1)
    // 90 min doesn't fit before 10:00 with travel + buffer, so it goes after the locked stop.
    expect(placed[0].start).toBeGreaterThanOrEqual(12 * 60 + 5)
    expect(overflow.map((p) => p.id)).toEqual(['b'])
  })

  it('clusters nearby places onto the same day', () => {
    const days = [{ id: 'd1', dayNumber: 1, fixed: [] }, { id: 'd2', dayNumber: 2, fixed: [] }]
    const near = [place('n1', 26.92, 75.82), place('n2', 26.921, 75.821)]
    const far = [place('f1', 26.985, 75.851), place('f2', 26.986, 75.852)]
    const { days: planned, unplaced } = codePlan(days, [...near, ...far], settings)
    expect(unplaced).toEqual([])
    const groups = planned.map((d) => d.stops.map((s) => s.placeId).sort())
    expect(groups).toEqual(expect.arrayContaining([['n1', 'n2'], ['f1', 'f2']]))
  })
})

describe('GET /itinerary/planner', () => {
  it('reports whether AI planning is configured', async () => {
    const { trip, member } = await tripWithTeam()
    const off = await request(app).get(`/api/trips/${trip.id}/itinerary/planner`).set(auth(member.token)).expect(200)
    expect(off.body.ai).toEqual({ enabled: false, provider: 'gemini', model: null })
    env.GEMINI_API_KEY = 'test-key'
    const on = await request(app).get(`/api/trips/${trip.id}/itinerary/planner`).set(auth(member.token)).expect(200)
    expect(on.body.ai).toMatchObject({ enabled: true, model: env.GEMINI_MODEL })
  })
})

describe('POST /itinerary/generate (draft only)', () => {
  it('without a Gemini key uses the route-based planner and saves nothing', async () => {
    const ctx = await setup()
    const res = await generate(ctx, ctx.member, { dayIds: [ctx.days[0].id, ctx.days[1].id], places: allPlaces(ctx) }).expect(200)
    expect(res.body).toMatchObject({ engine: 'code', notice: expect.stringContaining('isn’t set up') })
    const planned = res.body.days.flatMap((d) => d.stops.map((s) => s.placeId))
    expect(planned.sort()).toEqual(ctx.places.map((p) => p.id).sort())
    expect(await prisma.itineraryItem.count()).toBe(0)
  })

  it('in replace mode keeps locked stops fixed and frees the rest', async () => {
    const ctx = await setup()
    const day = ctx.days[0]
    const add = (place, startTime) =>
      request(app).post(`/api/trips/${ctx.trip.id}/itinerary/items`).set(auth(ctx.leader.token)).send({ dayId: day.id, placeId: place.id, startTime, durationMinutes: 60 })
    const locked = (await add(ctx.byName['Hawa Mahal'], '09:00').expect(201)).body.item
    await request(app).patch(`/api/trips/${ctx.trip.id}/itinerary/items/${locked.id}/lock`).set(auth(ctx.leader.token)).send({ locked: true }).expect(200)
    await add(ctx.byName['LMB Cafe'], '13:00').expect(201)

    const res = await generate(ctx, ctx.member, { dayIds: [day.id], mode: 'replace', places: allPlaces(ctx), engine: 'code' }).expect(200)
    const stops = res.body.days[0].stops
    expect(stops.find((s) => s.fixed)).toMatchObject({ placeId: ctx.byName['Hawa Mahal'].id, startTime: '09:00', itemId: locked.id })
    expect(stops.filter((s) => s.fixed)).toHaveLength(1)
    // The locked place can't be planned again; the unlocked café can.
    expect(res.body.skipped).toEqual([{ placeId: ctx.byName['Hawa Mahal'].id, reason: expect.any(String) }])
    expect(stops.some((s) => !s.fixed && s.placeId === ctx.byName['LMB Cafe'].id)).toBe(true)
  })

  it('rejects non-members and empty requests', async () => {
    const ctx = await setup()
    const outsider = await signUp()
    await generate(ctx, outsider, { dayIds: [ctx.days[0].id], places: allPlaces(ctx) }).expect(403)
    await generate(ctx, ctx.member, { dayIds: [], places: allPlaces(ctx) }).expect(400)
    await generate(ctx, ctx.member, { dayIds: [ctx.days[0].id], places: allPlaces(ctx), dayStart: '18:00', dayEnd: '19:00' }).expect(400)
  })
})

describe('POST /itinerary/generate with Gemini (mocked)', () => {
  it('uses the AI plan with tips, repairs overlapping times, and sends the key only as a header', async () => {
    const ctx = await setup()
    env.GEMINI_API_KEY = 'test-key'
    // First call: capture refs; the answer is built from the prompt it receives.
    let refs
    const calls = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) })
        refs = refsFrom(calls[0])
        const answer = {
          days: [
            {
              dayNumber: 1,
              items: [
                { placeRef: refs['Hawa Mahal'], startTime: '09:00', tip: 'Shoot the facade from Wind View Cafe opposite.' },
                // Overlaps Hawa Mahal — code must push it later.
                { placeRef: refs['City Palace'], startTime: '09:30', tip: 'Buy the composite ticket.' },
                { placeRef: refs['LMB Cafe'], startTime: '13:00', tip: 'Try the ghewar.' },
              ],
            },
            {
              dayNumber: 2,
              items: [
                { placeRef: refs['Amber Fort'], startTime: '08:30', tip: 'Arrive at opening to beat the heat.' },
                { placeRef: refs['Panna Meena ka Kund'], startTime: '12:00', tip: 'Five minutes’ walk from the fort.' },
              ],
            },
          ],
          unplaced: [],
        }
        return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(answer) }] } }] }), { status: 200 })
      }),
    )

    const res = await generate(ctx, ctx.member, { dayIds: [ctx.days[0].id, ctx.days[1].id], places: allPlaces(ctx), notes: 'We love street food' }).expect(200)
    expect(res.body).toMatchObject({ engine: 'gemini', attempts: 1 })
    const day1 = res.body.days[0].stops
    expect(day1.map((s) => s.tip)).toContain('Try the ghewar.')
    const hawa = day1.find((s) => s.placeId === ctx.byName['Hawa Mahal'].id)
    const palace = day1.find((s) => s.placeId === ctx.byName['City Palace'].id)
    expect(hawa.startTime).toBe('09:00')
    expect(palace.startTime > '10:00').toBe(true) // after Hawa Mahal ends + travel + buffer
    // Day window starts at 09:00, so the 08:30 suggestion moves to 09:00.
    expect(res.body.days[1].stops[0]).toMatchObject({ placeId: ctx.byName['Amber Fort'].id, startTime: '09:00' })

    const [call] = calls
    expect(call.url).toContain(`/models/${env.GEMINI_MODEL}:generateContent`)
    expect(call.url).not.toContain('test-key')
    expect(call.headers['x-goog-api-key']).toBe('test-key')
    expect(call.body.generationConfig.responseMimeType).toBe('application/json')
    expect(call.body.contents[0].parts[0].text).toContain('We love street food')
  })

  it('retries once with the validation errors, then succeeds', async () => {
    const ctx = await setup()
    env.GEMINI_API_KEY = 'test-key'
    const calls = []
    let n = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        calls.push(JSON.parse(init.body))
        const refs = refsFrom({ body: calls[0] })
        n += 1
        const answer =
          n === 1
            ? { days: [{ dayNumber: 1, items: [{ placeRef: 'P99', startTime: '09:00', tip: 'Invented' }] }], unplaced: [] }
            : {
                days: [{ dayNumber: 1, items: ctx.places.slice(0, 3).map((p, i) => ({ placeRef: refs[p.name], startTime: `${10 + i * 2}:00`, tip: 'ok' })) }],
                unplaced: ctx.places.slice(3).map((p) => ({ placeRef: refs[p.name], reason: 'Too far for one day' })),
              }
        return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(answer) }] } }] }), { status: 200 })
      }),
    )
    const res = await generate(ctx, ctx.member, { dayIds: [ctx.days[0].id], places: allPlaces(ctx).slice(0, 3) }).expect(200)
    expect(res.body).toMatchObject({ engine: 'gemini', attempts: 2 })
    expect(calls).toHaveLength(2)
    const followUp = calls[1].contents.at(-1).parts[0].text
    expect(followUp).toContain('Unknown placeRef "P99"')
    expect(calls[1].contents[1].role).toBe('model')
  })

  it('falls back to the route-based plan when Gemini is rate limited', async () => {
    const ctx = await setup()
    env.GEMINI_API_KEY = 'test-key'
    const calls = mockGemini(429, 429, 429, 429, 429, 429) // every model, both passes, out of quota
    const res = await generate(ctx, ctx.member, { dayIds: [ctx.days[0].id, ctx.days[1].id], places: allPlaces(ctx) }).expect(200)
    expect(res.body).toMatchObject({ engine: 'code', fallbackCode: 'AI_RATE_LIMITED', notice: expect.stringContaining('busy right now') })
    expect(calls).toHaveLength(6)
    expect(res.body.days.flatMap((d) => d.stops)).toHaveLength(ctx.places.length)
  })

  it('falls back when the AI keeps leaving out places that fit', async () => {
    const ctx = await setup()
    env.GEMINI_API_KEY = 'test-key'
    const lazy = { days: [{ dayNumber: 1, items: [] }], unplaced: [] }
    const calls = mockGemini(lazy, lazy)
    const res = await generate(ctx, ctx.member, { dayIds: [ctx.days[0].id, ctx.days[1].id], places: allPlaces(ctx) }).expect(200)
    expect(calls).toHaveLength(2)
    expect(res.body).toMatchObject({ engine: 'code', fallbackCode: 'AI_INVALID_PLAN' })
  })
})

describe('POST /itinerary/plan (save a draft)', () => {
  it('replaces unlocked stops on several days, keeps tips as notes, and logs who planned with AI', async () => {
    const ctx = await setup()
    const [d1, d2] = ctx.days
    const old = await request(app)
      .post(`/api/trips/${ctx.trip.id}/itinerary/items`)
      .set(auth(ctx.member.token))
      .send({ dayId: d2.id, placeId: ctx.byName['LMB Cafe'].id, startTime: '19:00', durationMinutes: 60 })
      .expect(201)

    const items = [
      { dayId: d1.id, placeId: ctx.byName['Hawa Mahal'].id, startTime: '09:00', durationMinutes: 60, notes: 'Go at sunrise' },
      { dayId: d2.id, placeId: ctx.byName['Amber Fort'].id, startTime: '09:00', durationMinutes: 180, notes: 'Take a jeep up' },
    ]
    await request(app).post(`/api/trips/${ctx.trip.id}/itinerary/plan`).set(auth(ctx.member.token)).send({ replaceDayIds: [d1.id, d2.id], engine: 'gemini', items }).expect(201)

    const { body } = await request(app).get(`/api/trips/${ctx.trip.id}/itinerary`).set(auth(ctx.member.token)).expect(200)
    const saved = body.days.flatMap((d) => d.items)
    expect(saved.find((i) => i.id === old.body.item.id)).toBeUndefined()
    expect(saved).toHaveLength(2)
    expect(saved.every((i) => i.source === 'AI')).toBe(true)
    expect(saved.map((i) => i.notes).sort()).toEqual(['Go at sunrise', 'Take a jeep up'])

    const feed = await request(app).get(`/api/trips/${ctx.trip.id}/activities`).set(auth(ctx.leader.token)).expect(200)
    expect(feed.body.activities[0].message).toBe(`${ctx.member.user.name} planned with AI 2 stops across 2 days`)
  })

  it('rejects a plan that lists the same place twice', async () => {
    const ctx = await setup()
    const item = { dayId: ctx.days[0].id, placeId: ctx.places[0].id, startTime: '09:00', durationMinutes: 60 }
    await request(app).post(`/api/trips/${ctx.trip.id}/itinerary/plan`).set(auth(ctx.member.token)).send({ items: [item, { ...item, startTime: '12:00' }] }).expect(400)
  })
})

describe('Gemini model fallbacks', () => {
  it('switches to the next model when the main one is overloaded (503), and says which model planned', async () => {
    const ctx = await setup()
    env.GEMINI_API_KEY = 'test-key'
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        calls += 1
        if (calls === 1) return new Response(JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand.' } }), { status: 503 })
        const refs = refsFrom({ body: JSON.parse(init.body) })
        const answer = { days: [{ dayNumber: 1, items: [{ placeRef: refs['Hawa Mahal'], startTime: '09:00', tip: 'Go early.' }] }], unplaced: [] }
        return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(answer) }] } }] }), { status: 200 })
      }),
    )
    const res = await generate(ctx, ctx.member, { dayIds: [ctx.days[0].id], places: [{ placeId: ctx.byName['Hawa Mahal'].id, durationMinutes: 60 }] }).expect(200)
    expect(res.body).toMatchObject({ engine: 'gemini', model: env.GEMINI_FALLBACK_MODELS[0] })
    expect(calls).toBe(2)
  })

  it('falls back to the route-based plan when every Gemini model is overloaded', async () => {
    const ctx = await setup()
    env.GEMINI_API_KEY = 'test-key'
    const calls = mockGemini(503, 503, 503, 503, 503, 503)
    const res = await generate(ctx, ctx.member, { dayIds: [ctx.days[0].id], places: [{ placeId: ctx.byName['Hawa Mahal'].id, durationMinutes: 60 }] }).expect(200)
    expect(res.body).toMatchObject({ engine: 'code', fallbackCode: 'AI_UNAVAILABLE' })
    const chain = [env.GEMINI_MODEL, ...env.GEMINI_FALLBACK_MODELS]
    expect(calls.map((c) => c.url.match(/models\/([^:]+):/)[1])).toEqual([...chain, ...chain]) // two passes
  })

  it('falls back to the route-based plan without trying other models when the API key is rejected', async () => {
    const ctx = await setup()
    env.GEMINI_API_KEY = 'bad-key'
    const calls = mockGemini(403, 200, 200)
    const res = await generate(ctx, ctx.member, { dayIds: [ctx.days[0].id], places: allPlaces(ctx).slice(0, 2) }).expect(200)
    expect(res.body).toMatchObject({ engine: 'code', fallbackCode: 'AI_AUTH' })
    expect(calls).toHaveLength(1)
  })

  it('gives up on a hanging main model in time for a fallback to answer', async () => {
    const ctx = await setup()
    env.GEMINI_API_KEY = 'test-key'
    const models = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        const model = String(url).match(/models\/([^:]+):/)[1]
        models.push(model)
        if (model === env.GEMINI_MODEL) {
          // Hangs until the per-model timeout aborts it.
          return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' }))))
        }
        const refs = refsFrom({ body: JSON.parse(init.body) })
        const answer = { days: [{ dayNumber: 1, items: [{ placeRef: refs['Hawa Mahal'], startTime: '09:00', tip: 'Go early.' }] }], unplaced: [] }
        return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(answer) }] } }] }), { status: 200 })
      }),
    )
    const started = Date.now()
    const res = await generate(ctx, ctx.member, { dayIds: [ctx.days[0].id], places: [{ placeId: ctx.byName['Hawa Mahal'].id, durationMinutes: 60 }] }).expect(200)
    expect(res.body).toMatchObject({ engine: 'gemini', model: env.GEMINI_FALLBACK_MODELS[0] })
    expect(models).toEqual([env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODELS[0]])
    // The hanging model gets at most half of the 50 s budget, leaving the rest for fallbacks.
    expect(Date.now() - started).toBeLessThan(30_000)
  }, 45_000)

  it('goes round the models a second time when all were busy, and plans with AI', async () => {
    const ctx = await setup()
    env.GEMINI_API_KEY = 'test-key'
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        calls += 1
        if (calls <= 3) return new Response(JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'high demand' } }), { status: 503 })
        const refs = refsFrom({ body: JSON.parse(init.body) })
        const answer = { days: [{ dayNumber: 1, items: [{ placeRef: refs['Hawa Mahal'], startTime: '09:00', tip: 'Go early.' }] }], unplaced: [] }
        return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(answer) }] } }] }), { status: 200 })
      }),
    )
    const res = await generate(ctx, ctx.member, { dayIds: [ctx.days[0].id], places: [{ placeId: ctx.byName['Hawa Mahal'].id, durationMinutes: 60 }] }).expect(200)
    expect(res.body).toMatchObject({ engine: 'gemini', model: env.GEMINI_MODEL })
    expect(calls).toBe(4)
  })
})
