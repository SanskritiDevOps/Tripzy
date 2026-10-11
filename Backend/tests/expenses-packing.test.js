import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, auth, signUp, tripWithTeam } from './helpers.js'
import { prisma } from '../src/config/prisma.js'
import { buildSplits, computeBalances, simplifyDebts, splitEqual } from '../src/utils/money.js'

let keyCounter = 0
const key = () => `test-key-${Date.now()}-${++keyCounter}`

function addExpense(t, user, body, idempotencyKey = key()) {
  return request(app)
    .post(`/api/trips/${t.trip.id}/expenses`)
    .set(auth(user.token))
    .set('Idempotency-Key', idempotencyKey)
    .send({ title: 'Dinner', amountMinor: 10000, paidBy: user.user.id, splitType: 'EQUAL', category: 'food', participants: [{ userId: t.leader.user.id }, { userId: t.member.user.id }], ...body })
}

describe('money helpers (server)', () => {
  it('equal splits always add up; remainders go to the first people', () => {
    expect(splitEqual(10000, ['a', 'b', 'c']).map((s) => s.shareMinor)).toEqual([3334, 3333, 3333])
  })

  it('rejects exact shares and percentages that do not add up', () => {
    expect(buildSplits({ amountMinor: 1000, splitType: 'EXACT', participants: [{ userId: 'a', value: 500 }, { userId: 'b', value: 400 }] }).error).toMatch(/add up/)
    expect(buildSplits({ amountMinor: 1000, splitType: 'PERCENT', participants: [{ userId: 'a', value: 60 }, { userId: 'b', value: 30 }] }).error).toMatch(/100%/)
    const ok = buildSplits({ amountMinor: 1001, splitType: 'PERCENT', participants: [{ userId: 'a', value: 33.33 }, { userId: 'b', value: 66.67 }] })
    expect(ok.splits.reduce((s, x) => s + x.shareMinor, 0)).toBe(1001)
  })

  it('debt simplification settles everyone in at most n − 1 payments', () => {
    const expenses = [
      { paidBy: 'a', amountMinor: 9000, splits: splitEqual(9000, ['a', 'b', 'c']) },
      { paidBy: 'b', amountMinor: 3000, splits: splitEqual(3000, ['a', 'b', 'c']) },
    ]
    const balances = computeBalances(['a', 'b', 'c'], expenses, [])
    const payments = simplifyDebts(balances)
    expect(payments.length).toBeLessThanOrEqual(2)
    expect(computeBalances(['a', 'b', 'c'], expenses, payments).every((b) => b.netMinor === 0)).toBe(true)
  })
})

describe('expenses', () => {
  it('any member adds an expense; splits are built on the server; everyone sees it', async () => {
    const t = await tripWithTeam()
    const res = await addExpense(t, t.member, { amountMinor: 10001 }).expect(201)
    expect(res.body.expense).toMatchObject({ title: 'Dinner', amountMinor: 10001, paidBy: t.member.user.id, createdBy: t.member.user.id })
    expect(res.body.expense.splits.map((s) => s.shareMinor).sort()).toEqual([5000, 5001])

    const list = await request(app).get(`/api/trips/${t.trip.id}/expenses`).set(auth(t.leader.token)).expect(200)
    expect(list.body.expenses).toHaveLength(1)
  })

  it('the same Idempotency-Key creates the expense only once', async () => {
    const t = await tripWithTeam()
    const k = key()
    const first = await addExpense(t, t.member, {}, k).expect(201)
    const replay = await addExpense(t, t.member, {}, k).expect(200)
    expect(replay.body).toMatchObject({ created: false, expense: { id: first.body.expense.id } })
    expect(await prisma.expense.count()).toBe(1)
    await request(app).post(`/api/trips/${t.trip.id}/expenses`).set(auth(t.member.token)).send({}).expect(400)
  })

  it('validates splits and that everyone involved is on the trip', async () => {
    const t = await tripWithTeam()
    const stranger = await signUp()
    await addExpense(t, t.member, { splitType: 'EXACT', participants: [{ userId: t.leader.user.id, value: 3000 }, { userId: t.member.user.id, value: 3000 }] }).expect(400)
    await addExpense(t, t.member, { participants: [{ userId: stranger.user.id }] }).expect(400)
    await addExpense(t, t.member, { paidBy: stranger.user.id }).expect(400)
  })

  it('only the creator or the leader can edit or delete an expense', async () => {
    const t = await tripWithTeam()
    const third = await signUp()
    await prisma.tripMember.create({ data: { tripId: t.trip.id, userId: third.user.id, role: 'MEMBER' } })
    const expense = (await addExpense(t, t.member).expect(201)).body.expense
    const url = `/api/trips/${t.trip.id}/expenses/${expense.id}`
    const body = { title: 'Dinner + dessert', amountMinor: 12000, paidBy: t.member.user.id, splitType: 'EQUAL', category: 'food', participants: [{ userId: t.member.user.id }] }

    const denied = await request(app).patch(url).set(auth(third.token)).send(body).expect(403)
    expect(denied.body.code).toBe('NOT_EXPENSE_OWNER')
    await request(app).patch(url).set(auth(t.member.token)).send(body).expect(200)
    await request(app).delete(url).set(auth(third.token)).expect(403)
    await request(app).delete(url).set(auth(t.leader.token)).expect(204)
  })

  it('balances and settlements are shared; only involved people or the leader record payments', async () => {
    const t = await tripWithTeam()
    const third = await signUp()
    await prisma.tripMember.create({ data: { tripId: t.trip.id, userId: third.user.id, role: 'MEMBER' } })
    await addExpense(t, t.leader, { amountMinor: 20000 }).expect(201) // member owes leader 10000

    const before = (await request(app).get(`/api/trips/${t.trip.id}/balances`).set(auth(third.token)).expect(200)).body
    expect(before.suggested).toEqual([{ fromUser: t.member.user.id, toUser: t.leader.user.id, amountMinor: 10000 }])

    const pay = { fromUser: t.member.user.id, toUser: t.leader.user.id, amountMinor: 10000 }
    await request(app).post(`/api/trips/${t.trip.id}/settlements`).set(auth(third.token)).send(pay).expect(403)
    await request(app).post(`/api/trips/${t.trip.id}/settlements`).set(auth(t.member.token)).send(pay).expect(201)

    const after = (await request(app).get(`/api/trips/${t.trip.id}/balances`).set(auth(t.leader.token)).expect(200)).body
    expect(after.suggested).toEqual([])
    const feed = (await request(app).get(`/api/trips/${t.trip.id}/activities`).set(auth(t.leader.token))).body.activities
    expect(feed[0].message).toBe(`${t.member.user.name} recorded that ${t.member.user.name} paid ${t.leader.user.name} ₹100`)
    expect(feed[1]).toMatchObject({ action: 'EXPENSE_ADDED', message: `${t.leader.user.name} added Dinner (₹200)` })
  })
})

describe('packing list', () => {
  it('new trips start with a shared starter list', async () => {
    const t = await tripWithTeam()
    const res = await request(app).get(`/api/trips/${t.trip.id}/packing`).set(auth(t.member.token)).expect(200)
    expect(res.body.items.length).toBeGreaterThan(0)
  })

  it('any member adds and ticks items; everyone sees them', async () => {
    const t = await tripWithTeam()
    const base = `/api/trips/${t.trip.id}/packing`
    const item = (await request(app).post(base).set(auth(t.member.token)).send({ label: 'Sunscreen', category: 'toiletries', ownerId: t.leader.user.id }).expect(201)).body.item
    expect(item).toMatchObject({ label: 'Sunscreen', ownerId: t.leader.user.id, addedBy: t.member.user.id, packed: false })
    await request(app).post(base).set(auth(t.leader.token)).send({ label: 'sunscreen' }).expect(409)

    await request(app).patch(`${base}/${item.id}`).set(auth(t.leader.token)).send({ packed: true }).expect(200)
    const list = (await request(app).get(base).set(auth(t.member.token))).body.items
    expect(list.find((i) => i.id === item.id).packed).toBe(true)

    await request(app).post(`${base}/reset`).set(auth(t.member.token)).expect(204)
    expect((await prisma.packingItem.findUnique({ where: { id: item.id } })).packed).toBe(false)
  })

  it('only whoever added an item, or the leader, can delete it', async () => {
    const t = await tripWithTeam()
    const third = await signUp()
    await prisma.tripMember.create({ data: { tripId: t.trip.id, userId: third.user.id, role: 'MEMBER' } })
    const base = `/api/trips/${t.trip.id}/packing`
    const item = (await request(app).post(base).set(auth(t.member.token)).send({ label: 'Travel adapter', category: 'electronics' }).expect(201)).body.item

    await request(app).delete(`${base}/${item.id}`).set(auth(third.token)).expect(403)
    await request(app).delete(`${base}/${item.id}`).set(auth(t.member.token)).expect(204)
    const feed = (await request(app).get(`/api/trips/${t.trip.id}/activities`).set(auth(t.leader.token))).body.activities
    expect(feed.slice(0, 2).map((a) => a.action)).toEqual(['PACKING_ITEM_DELETED', 'PACKING_ITEM_ADDED'])
  })

  it('is hidden from non-members', async () => {
    const t = await tripWithTeam()
    const stranger = await signUp()
    await request(app).get(`/api/trips/${t.trip.id}/packing`).set(auth(stranger.token)).expect(403)
    await request(app).get(`/api/trips/${t.trip.id}/expenses`).set(auth(stranger.token)).expect(403)
  })
})
