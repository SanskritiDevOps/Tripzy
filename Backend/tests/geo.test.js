import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { app, auth, signUp, tripBody } from './helpers.js'
import { env } from '../src/config/env.js'
import { categoryOf, resetGeocoder, toPlace } from '../src/modules/geo/geocoder.js'

const NOMINATIM = 'https://nominatim.test'

const osm = (overrides) => ({
  place_id: 1,
  osm_type: 'way',
  osm_id: 101,
  lat: '32.2396',
  lon: '77.1887',
  category: 'tourism',
  type: 'attraction',
  name: 'Hadimba Devi Temple',
  display_name: 'Hadimba Devi Temple, Dhungri Road, Manali, Kullu, Himachal Pradesh, India',
  ...overrides,
})

/** Stubs fetch: `respond(url)` returns the Nominatim JSON (or a number for an HTTP error). */
function stubNominatim(respond) {
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init) => {
      calls.push({ url: new URL(String(url)), headers: init?.headers ?? {}, at: Date.now() })
      const body = respond(new URL(String(url)))
      if (typeof body === 'number') return new Response('{}', { status: body })
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    }),
  )
  return calls
}

beforeEach(() => {
  env.GEOCODER_URL = NOMINATIM
  resetGeocoder()
})
afterEach(() => {
  vi.unstubAllGlobals()
  env.GEOCODER_URL = undefined
})

describe('mapping OpenStreetMap results', () => {
  it('maps OSM categories to Tripzy categories', () => {
    expect(categoryOf({ category: 'amenity', type: 'restaurant' })).toBe('food')
    expect(categoryOf({ category: 'tourism', type: 'hotel' })).toBe('stay')
    expect(categoryOf({ category: 'historic', type: 'castle' })).toBe('sight')
    expect(categoryOf({ category: 'aeroway', type: 'aerodrome' })).toBe('transit')
    expect(categoryOf({ category: 'leisure', type: 'park' })).toBe('activity')
    expect(categoryOf({ category: 'place', type: 'village' })).toBe('sight') // e.g. Solang Valley
    expect(categoryOf({ category: 'man_made', type: 'tower' })).toBe('sight') // e.g. Eiffel Tower
    expect(categoryOf({ category: 'office', type: 'company' })).toBe('other')
  })

  it('builds a place with a real position, a short address and a default duration', () => {
    expect(toPlace(osm())).toEqual({
      osmId: 'w101',
      name: 'Hadimba Devi Temple',
      address: 'Dhungri Road, Manali, Kullu, Himachal Pradesh',
      lat: 32.2396,
      lng: 77.1887,
      category: 'sight',
      durationMinutes: 90,
    })
  })
})

describe('GET /api/geo/search', () => {
  it('requires login', async () => {
    await request(app).get('/api/geo/search?q=temple').expect(401)
  })

  it('searches near the trip, identifies Tripzy to Nominatim, and caches repeat searches', async () => {
    const { token } = await signUp()
    const calls = stubNominatim(() => [osm(), osm({ osm_id: 102, name: 'Cafe 1947', category: 'amenity', type: 'cafe', display_name: 'Cafe 1947, Old Manali, India' })])

    const res = await request(app).get('/api/geo/search?q=temple&lat=32.24&lng=77.19').set(auth(token)).expect(200)
    expect(res.body.attribution).toBe('© OpenStreetMap contributors')
    expect(res.body.results.map((r) => [r.name, r.category])).toEqual([
      ['Hadimba Devi Temple', 'sight'],
      ['Cafe 1947', 'food'],
    ])

    const [call] = calls
    expect(call.url.origin + call.url.pathname).toBe(`${NOMINATIM}/search`)
    expect(call.url.searchParams.get('q')).toBe('temple')
    expect(call.url.searchParams.get('bounded')).toBe('1')
    expect(call.url.searchParams.get('viewbox')).toBe('76.4400,32.9900,77.9400,31.4900')
    expect(call.headers['User-Agent']).toMatch(/^Tripzy\/1\.0/)

    await request(app).get('/api/geo/search?q=temple&lat=32.24&lng=77.19').set(auth(token)).expect(200)
    expect(calls).toHaveLength(1) // served from cache
  })

  it('falls back to a worldwide search when nothing is near, spacing requests ≥ 1 s apart', async () => {
    const { token } = await signUp()
    const calls = stubNominatim((url) => (url.searchParams.get('bounded') ? [] : [osm({ name: 'Eiffel Tower', display_name: 'Eiffel Tower, Paris, France' })]))
    const res = await request(app).get('/api/geo/search?q=eiffel%20tower&lat=32.24&lng=77.19').set(auth(token)).expect(200)
    expect(res.body.results[0].name).toBe('Eiffel Tower')
    expect(calls).toHaveLength(2)
    expect(calls[1].url.searchParams.has('viewbox')).toBe(false)
    expect(calls[1].at - calls[0].at).toBeGreaterThanOrEqual(1000)
  })

  it('reports the map service being down as 503, not a crash', async () => {
    const { token } = await signUp()
    stubNominatim(() => 500)
    const res = await request(app).get('/api/geo/search?q=temple').set(auth(token)).expect(503)
    expect(res.body.code).toBe('GEOCODER_UNAVAILABLE')
  })

  it('validates the query', async () => {
    const { token } = await signUp()
    await request(app).get('/api/geo/search?q=a').set(auth(token)).expect(400)
    await request(app).get('/api/geo/search?q=temple&lat=32').set(auth(token)).expect(400)
  })
})

describe('trip destinations are geocoded', () => {
  it('stores the destination centre when a trip is created and when the destination changes', async () => {
    const { token } = await signUp()
    stubNominatim((url) => (url.searchParams.get('q').startsWith('Manali') ? [osm({ lat: '32.2432', lon: '77.1892' })] : [osm({ lat: '48.8566', lon: '2.3522' })]))

    const created = await request(app).post('/api/trips').set(auth(token)).send({ ...tripBody, destination: 'Manali, Himachal Pradesh' }).expect(201)
    expect(created.body.trip).toMatchObject({ destinationLat: 32.2432, destinationLng: 77.1892 })

    const updated = await request(app).patch(`/api/trips/${created.body.trip.id}`).set(auth(token)).send({ destination: 'Paris, France' }).expect(200)
    expect(updated.body.trip).toMatchObject({ destinationLat: 48.8566, destinationLng: 2.3522 })
  })

  it('still creates the trip when the map service is down', async () => {
    const { token } = await signUp()
    stubNominatim(() => 503)
    const created = await request(app).post('/api/trips').set(auth(token)).send({ ...tripBody, destination: 'Somewhere' }).expect(201)
    expect(created.body.trip).toMatchObject({ destinationLat: null, destinationLng: null })
  })
})
