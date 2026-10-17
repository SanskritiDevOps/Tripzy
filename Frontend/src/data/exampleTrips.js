// The example trips shown on "My trips" (Jaipur, Kyoto, Goa). Dates are relative
// to today, so there is always an upcoming trip, a later one and a past one.

import { addDays, todayIso } from '../utils/dates'
import { splitEqual, splitPercent } from '../utils/money'
import { POI_CATALOG } from './poiCatalog'

const MAIN_TRAVELLER_ID = 'u1'

const USERS = [
  { id: 'u1', name: 'Sanskriti Singh', email: 'demo@tripzy.app', color: 'bg-ocean-600' },
  { id: 'u2', name: 'Aman Verma', email: 'aman@tripzy.app', color: 'bg-coral-500' },
  { id: 'u3', name: 'Priya Nair', email: 'priya@tripzy.app', color: 'bg-violet-500' },
  { id: 'u4', name: 'Rahul Mehta', email: 'rahul@tripzy.app', color: 'bg-amber-500' },
  { id: 'u5', name: 'Riya Kapoor', email: 'riya@tripzy.app', color: 'bg-emerald-600' },
]

function hoursAgo(h) {
  return new Date(Date.now() - h * 3_600_000).toISOString()
}

function poi(destination, name) {
  const found = POI_CATALOG[destination].find((p) => p.name === name)
  if (!found) throw new Error(`Unknown POI ${name}`)
  return found
}

function makePlaces(tripId, destination, specs) {
  return specs.map(([id, name, addedBy, notes = '', hours = 48], index) => ({
    id,
    tripId,
    addedBy,
    ...poi(destination, name),
    notes,
    isLocked: false,
    createdAt: hoursAgo(hours + index),
  }))
}

function makeDays(tripId, prefix, startDate, count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-d${i + 1}`,
    tripId,
    dayNumber: i + 1,
    date: addDays(startDate, i),
  }))
}

function makeItems(dayId, specs) {
  return specs.map(([id, placeId, startTime, durationMinutes, extra = {}], position) => ({
    id,
    dayId,
    placeId,
    position,
    startTime,
    durationMinutes,
    isLocked: false,
    source: 'MANUAL',
    notes: '',
    costMinor: 0,
    version: 1,
    ...extra,
  }))
}

function expense(id, tripId, { title, amountMinor, paidBy, splitType, category, splits, hours }) {
  return {
    id,
    tripId,
    title,
    amountMinor,
    currency: 'INR',
    paidBy,
    splitType,
    category,
    splits,
    idempotencyKey: `seed-${id}`,
    createdAt: hoursAgo(hours),
  }
}

/** Replaces every exact `from` string value in a nested structure. */
function rebindId(value, from, to) {
  if (value === from) return to
  if (Array.isArray(value)) return value.map((v) => rebindId(v, from, to))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebindId(v, from, to)]))
  return value
}

/**
 * Example trips with `sessionUser` ({ id, name, email }) as the main traveller,
 * so the logged-in account owns the Jaipur trip and is a member of the others.
 */
export function createExampleData(sessionUser) {
  const data = buildExamples()
  if (!sessionUser) return data
  const rebound = rebindId(data, MAIN_TRAVELLER_ID, sessionUser.id)
  rebound.users = rebound.users.map((u) => (u.id === sessionUser.id ? { ...u, name: sessionUser.name, email: sessionUser.email, avatarUrl: sessionUser.avatarUrl ?? null } : u))
  return rebound
}

function buildExamples() {
  const today = todayIso()

  // Trip 1: Jaipur (upcoming, rich data)
  const jaipurStart = addDays(today, 21)
  const jaipur = {
    id: 't-jaipur',
    name: 'Jaipur Royal Weekend',
    destination: 'Jaipur, Rajasthan',
    destinationId: 'jaipur',
    startDate: jaipurStart,
    endDate: addDays(jaipurStart, 3),
    currency: 'INR',
    budgetMinor: 12000000,
    groupType: 'friends',
    ownerId: 'u1',
    votingDeadline: addDays(today, 10) + 'T21:00:00',
    shareToken: 'jaipur-royal-7f3k',
    createdAt: hoursAgo(24 * 9),
  }

  const jaipurPlaces = makePlaces('t-jaipur', 'jaipur', [
    ['p-airport', 'Jaipur International Airport', 'u1', 'IndiGo 6E-2134 lands 10:45'],
    ['p-samode', 'Samode Haveli', 'u2', 'Booked 2 rooms, breakfast included', 200],
    ['p-lmb', 'Laxmi Mishthan Bhandar', 'u3', 'Try the pyaaz kachori and ghewar'],
    ['p-hawa', 'Hawa Mahal', 'u1', 'Best photos from the café opposite'],
    ['p-johari', 'Johari Bazaar', 'u3', 'Block-print fabric + silver jewellery'],
    ['p-palladio', 'Bar Palladio', 'u2', 'Reserve a garden table'],
    ['p-amber', 'Amber Fort', 'u1', 'Go early, it gets crowded by 11'],
    ['p-jal', 'Jal Mahal', 'u4'],
    ['p-rawat', 'Rawat Mishthan Bhandar', 'u4', 'Famous mawa kachori'],
    ['p-city', 'City Palace', 'u3'],
    ['p-jantar', 'Jantar Mantar', 'u1', 'Combo ticket with City Palace'],
    ['p-nahargarh', 'Nahargarh Fort', 'u2', 'Sunset point; stay till dusk'],
    ['p-galta', 'Galtaji Temple', 'u3', 'Monkey temple, wear good shoes'],
    ['p-albert', 'Albert Hall Museum', 'u4', 'Lit up beautifully at night'],
    ['p-chokhi', 'Chokhi Dhani', 'u2', 'Village-style dinner + folk dance'],
    ['p-patrika', 'Patrika Gate', 'u3', 'Most colourful gate in the city'],
    ['p-tapri', 'Tapri Central', 'u4', 'Chai with a rooftop view'],
    ['p-birla', 'Birla Mandir', 'u2', '', 20],
    ['p-balloon', 'Hot-air balloon ride, Amer', 'u4', 'Pricey — vote if you’re in!', 12],
    ['p-suvarna', 'Suvarna Mahal', 'u1', 'Fancy last-night dinner?', 6],
  ])

  const jaipurDays = makeDays('t-jaipur', 'jai', jaipurStart, 4)
  const [d1, d2, d3, d4] = jaipurDays.map((d) => d.id)
  const jaipurItems = [
    ...makeItems(d1, [
      ['i-1', 'p-airport', '10:45', 45, { isLocked: true, notes: 'Flight lands, cab to hotel', costMinor: 60000 }],
      ['i-2', 'p-samode', '12:00', 60, { notes: 'Check-in + freshen up' }],
      ['i-3', 'p-lmb', '13:30', 60, { costMinor: 120000 }],
      ['i-4', 'p-hawa', '15:00', 60, { costMinor: 80000 }],
      ['i-5', 'p-johari', '16:15', 90, { notes: 'Bargain hard!', costMinor: 400000 }],
      ['i-6', 'p-palladio', '19:30', 120, { notes: 'Table booked for 4', costMinor: 600000 }],
    ]),
    ...makeItems(d2, [
      ['i-7', 'p-amber', '08:30', 180, { isLocked: true, source: 'AI', notes: 'Guide meets us at Suraj Pol', costMinor: 200000 }],
      ['i-8', 'p-jal', '12:00', 45, { source: 'AI' }],
      ['i-9', 'p-rawat', '13:15', 60, { source: 'AI', costMinor: 60000 }],
      ['i-10', 'p-city', '15:00', 120, { source: 'AI', costMinor: 280000 }],
      ['i-11', 'p-jantar', '17:15', 60, { source: 'AI', costMinor: 80000 }],
    ]),
    ...makeItems(d3, [
      ['i-12', 'p-nahargarh', '09:00', 120, { costMinor: 80000 }],
      ['i-13', 'p-galta', '12:00', 90],
      ['i-14', 'p-albert', '15:00', 90, { costMinor: 60000 }],
      ['i-15', 'p-chokhi', '18:30', 180, { notes: 'Booked — pickup 18:00', costMinor: 340000 }],
    ]),
    ...makeItems(d4, [
      ['i-16', 'p-patrika', '09:30', 45],
      ['i-17', 'p-tapri', '10:45', 60, { costMinor: 40000 }],
      ['i-18', 'p-airport', '13:30', 60, { isLocked: true, notes: 'Flight 6E-2178 departs 15:10', costMinor: 60000 }],
    ]),
  ]

  const jaipurVotes = [
    ['p-amber', ['u1', 'u2', 'u3', 'u4'], []],
    ['p-hawa', ['u1', 'u2', 'u3', 'u4'], []],
    ['p-city', ['u1', 'u3', 'u4'], []],
    ['p-nahargarh', ['u1', 'u2', 'u3'], []],
    ['p-chokhi', ['u2', 'u3', 'u4'], ['u1']],
    ['p-lmb', ['u1', 'u3'], []],
    ['p-johari', ['u3', 'u1'], ['u4']],
    ['p-palladio', ['u2', 'u1', 'u3'], []],
    ['p-jal', ['u4', 'u2'], []],
    ['p-jantar', ['u1'], ['u2']],
    ['p-galta', ['u3', 'u2'], []],
    ['p-albert', ['u4'], []],
    ['p-patrika', ['u3', 'u1', 'u4'], []],
    ['p-tapri', ['u4', 'u2'], []],
    ['p-rawat', ['u4', 'u1'], []],
    ['p-balloon', ['u4', 'u2'], ['u1', 'u3']],
    ['p-birla', ['u2'], []],
    ['p-suvarna', ['u1', 'u3'], ['u4']],
  ].flatMap(([placeId, ups, downs]) => [
    ...ups.map((userId) => ({ id: `v-${placeId}-${userId}`, placeId, userId, value: 1 })),
    ...downs.map((userId) => ({ id: `v-${placeId}-${userId}`, placeId, userId, value: -1 })),
  ])

  const crew = ['u1', 'u2', 'u3', 'u4']
  const jaipurExpenses = [
    expense('e-1', 't-jaipur', {
      title: 'Flights DEL ⇄ JAI (4 pax)', amountMinor: 1840000, paidBy: 'u1', splitType: 'EQUAL', category: 'transit',
      splits: splitEqual(1840000, crew), hours: 24 * 8,
    }),
    expense('e-2', 't-jaipur', {
      title: 'Samode Haveli · 3 nights', amountMinor: 4200000, paidBy: 'u2', splitType: 'EQUAL', category: 'stay',
      splits: splitEqual(4200000, crew), hours: 24 * 7,
    }),
    expense('e-3', 't-jaipur', {
      title: 'Amber Fort guide + tickets', amountMinor: 200000, paidBy: 'u3', splitType: 'EQUAL', category: 'activity',
      splits: splitEqual(200000, crew), hours: 24 * 5,
    }),
    expense('e-4', 't-jaipur', {
      title: 'Chokhi Dhani booking', amountMinor: 340000, paidBy: 'u4', splitType: 'EXACT', category: 'food',
      splits: [
        { userId: 'u1', shareMinor: 100000 },
        { userId: 'u2', shareMinor: 80000 },
        { userId: 'u3', shareMinor: 80000 },
        { userId: 'u4', shareMinor: 80000 },
      ],
      hours: 24 * 3,
    }),
    expense('e-5', 't-jaipur', {
      title: 'Full-day cab (Innova)', amountMinor: 450000, paidBy: 'u1', splitType: 'PERCENT', category: 'transit',
      splits: splitPercent(450000, [
        { userId: 'u1', percent: 25 },
        { userId: 'u2', percent: 25 },
        { userId: 'u3', percent: 30 },
        { userId: 'u4', percent: 20 },
      ]),
      hours: 30,
    }),
    expense('e-6', 't-jaipur', {
      title: 'Block-print bedsheets (shared gift)', amountMinor: 285000, paidBy: 'u3', splitType: 'EQUAL', category: 'shopping',
      splits: splitEqual(285000, ['u1', 'u3']), hours: 10,
    }),
  ]

  const jaipurSettlements = [
    { id: 's-1', tripId: 't-jaipur', fromUser: 'u4', toUser: 'u1', amountMinor: 200000, settledAt: hoursAgo(20) },
  ]

  const jaipurPacking = [
    ['documents', 'Aadhaar / ID card', true],
    ['documents', 'Flight tickets (PDF)', true],
    ['documents', 'Hotel booking confirmation', false],
    ['clothing', 'Light cotton kurtas', true],
    ['clothing', 'Comfortable walking shoes', false],
    ['clothing', 'Shawl for the evenings', false],
    ['clothing', 'Sunglasses + cap', true],
    ['toiletries', 'Sunscreen SPF 50', false],
    ['toiletries', 'Toothbrush & toiletries kit', false],
    ['electronics', 'Power bank', true],
    ['electronics', 'Phone + camera chargers', false],
    ['health', 'ORS sachets', false],
    ['health', 'Basic medicines', false],
    ['gear', 'Reusable water bottle', true],
    ['gear', 'Tote bag for shopping', false],
  ].map(([category, label, packed], i) => ({ id: `pk-j-${i}`, tripId: 't-jaipur', category, label, packed, ownerId: null }))

  // Trip 2: Kyoto (later, early-stage planning)
  const kyotoStart = addDays(today, 54)
  const kyoto = {
    id: 't-kyoto',
    name: 'Kyoto in Autumn',
    destination: 'Kyoto, Japan',
    destinationId: 'kyoto',
    startDate: kyotoStart,
    endDate: addDays(kyotoStart, 4),
    currency: 'INR',
    budgetMinor: 32000000,
    groupType: 'friends',
    ownerId: 'u5',
    votingDeadline: null,
    shareToken: 'kyoto-autumn-2m9q',
    createdAt: hoursAgo(24 * 3),
  }
  const kyotoPlaces = makePlaces('t-kyoto', 'kyoto', [
    ['k-inari', 'Fushimi Inari Taisha', 'u5', 'Hike to the top early morning'],
    ['k-kinkaku', 'Kinkaku-ji', 'u1'],
    ['k-bamboo', 'Arashiyama Bamboo Grove', 'u3', 'Before 8am for no crowds'],
    ['k-kiyomizu', 'Kiyomizu-dera', 'u5'],
    ['k-nishiki', 'Nishiki Market', 'u1', 'Street food crawl'],
    ['k-gion', 'Gion District', 'u3', 'Evening walk'],
    ['k-path', 'Philosopher’s Path', 'u1', 'Maple season!'],
  ])
  const kyotoDays = makeDays('t-kyoto', 'kyo', kyotoStart, 5)
  const kyotoItems = makeItems(kyotoDays[0].id, [
    ['ki-1', 'k-inari', '07:30', 150, { costMinor: 0 }],
    ['ki-2', 'k-nishiki', '12:00', 75, { costMinor: 250000 }],
  ])
  const kyotoVotes = [
    ['k-inari', ['u1', 'u3', 'u5']],
    ['k-bamboo', ['u3', 'u5']],
    ['k-kinkaku', ['u1']],
    ['k-nishiki', ['u1', 'u5']],
    ['k-path', ['u1', 'u3']],
  ].flatMap(([placeId, ups]) => ups.map((userId) => ({ id: `v-${placeId}-${userId}`, placeId, userId, value: 1 })))
  const kyotoExpenses = [
    expense('e-k1', 't-kyoto', {
      title: 'Japan Rail Pass deposit', amountMinor: 2400000, paidBy: 'u5', splitType: 'EQUAL', category: 'transit',
      splits: splitEqual(2400000, ['u1', 'u3', 'u5']), hours: 50,
    }),
  ]
  const kyotoPacking = [
    ['documents', 'Passport + visa', false],
    ['documents', 'Travel insurance', false],
    ['clothing', 'Warm layers', false],
    ['electronics', 'Universal travel adapter', false],
    ['gear', 'IC card (ICOCA)', false],
  ].map(([category, label, packed], i) => ({ id: `pk-k-${i}`, tripId: 't-kyoto', category, label, packed, ownerId: null }))

  // Trip 3: Goa (past)
  const goaStart = addDays(today, -160)
  const goa = {
    id: 't-goa',
    name: 'Goa with the Gang',
    destination: 'North Goa, India',
    destinationId: 'goa',
    startDate: goaStart,
    endDate: addDays(goaStart, 2),
    currency: 'INR',
    budgetMinor: 6000000,
    groupType: 'friends',
    ownerId: 'u2',
    votingDeadline: null,
    shareToken: 'goa-gang-x81p',
    createdAt: hoursAgo(24 * 190),
  }
  const goaPlaces = makePlaces('t-goa', 'goa', [
    ['g-baga', 'Baga Beach', 'u2', '', 24 * 185],
    ['g-aguada', 'Fort Aguada', 'u1', '', 24 * 185],
    ['g-thalassa', 'Thalassa', 'u4', 'Sunset dinner', 24 * 185],
  ])
  const goaDays = makeDays('t-goa', 'goa', goaStart, 3)
  const goaItems = [
    ...makeItems(goaDays[0].id, [['gi-1', 'g-baga', '11:00', 180]]),
    ...makeItems(goaDays[1].id, [
      ['gi-2', 'g-aguada', '10:00', 60],
      ['gi-3', 'g-thalassa', '18:00', 120, { costMinor: 800000 }],
    ]),
  ]
  const goaExpenses = [
    expense('e-g1', 't-goa', {
      title: 'Villa in Assagao', amountMinor: 3600000, paidBy: 'u2', splitType: 'EQUAL', category: 'stay',
      splits: splitEqual(3600000, ['u1', 'u2', 'u4']), hours: 24 * 170,
    }),
  ]
  const goaSettlements = [
    { id: 's-g1', tripId: 't-goa', fromUser: 'u1', toUser: 'u2', amountMinor: 1200000, settledAt: hoursAgo(24 * 150) },
    { id: 's-g2', tripId: 't-goa', fromUser: 'u4', toUser: 'u2', amountMinor: 1200000, settledAt: hoursAgo(24 * 150) },
  ]

  const members = [
    ...crew.map((userId, i) => ({ tripId: 't-jaipur', userId, role: userId === 'u1' ? 'LEADER' : 'MEMBER', joinedAt: hoursAgo(24 * 9 - i) })),
    ...['u5', 'u1', 'u3'].map((userId, i) => ({ tripId: 't-kyoto', userId, role: userId === 'u5' ? 'LEADER' : 'MEMBER', joinedAt: hoursAgo(24 * 3 - i) })),
    ...['u2', 'u1', 'u4'].map((userId, i) => ({ tripId: 't-goa', userId, role: userId === 'u2' ? 'LEADER' : 'MEMBER', joinedAt: hoursAgo(24 * 190 - i) })),
  ]

  const activity = [
    ['a-1', 't-jaipur', 'u4', 'PLACE_ADDED', { name: 'Hot-air balloon ride, Amer' }, 12],
    ['a-2', 't-jaipur', 'u3', 'EXPENSE_ADDED', { title: 'Block-print bedsheets (shared gift)', amountMinor: 285000 }, 10],
    ['a-3', 't-jaipur', 'u1', 'PLACE_ADDED', { name: 'Suvarna Mahal' }, 6],
    ['a-4', 't-jaipur', 'u2', 'VOTED', { name: 'Chokhi Dhani', value: 1 }, 4],
    ['a-5', 't-jaipur', 'u3', 'ITINERARY_UPDATED', { name: 'Albert Hall Museum', day: 3 }, 2],
    ['a-6', 't-jaipur', 'u4', 'SETTLED', { to: 'u1', amountMinor: 200000 }, 20],
    ['a-7', 't-kyoto', 'u5', 'EXPENSE_ADDED', { title: 'Japan Rail Pass deposit', amountMinor: 2400000 }, 50],
    ['a-8', 't-kyoto', 'u3', 'PLACE_ADDED', { name: 'Arashiyama Bamboo Grove' }, 40],
  ].map(([id, tripId, actorId, type, payload, hours]) => ({ id, tripId, actorId, type, payload, createdAt: hoursAgo(hours) }))

  return {
    users: USERS,
    trips: [jaipur, kyoto, goa],
    members,
    places: [...jaipurPlaces, ...kyotoPlaces, ...goaPlaces],
    votes: [...jaipurVotes, ...kyotoVotes],
    itineraryDays: [...jaipurDays, ...kyotoDays, ...goaDays],
    itineraryItems: [...jaipurItems, ...kyotoItems, ...goaItems],
    expenses: [...jaipurExpenses, ...kyotoExpenses, ...goaExpenses],
    settlements: [...jaipurSettlements, ...goaSettlements],
    packingItems: [...jaipurPacking, ...kyotoPacking],
    activity,
    // Who appears "online" in each example trip.
    presence: { 't-jaipur': ['u2', 'u3'], 't-kyoto': ['u5'] },
  }
}
