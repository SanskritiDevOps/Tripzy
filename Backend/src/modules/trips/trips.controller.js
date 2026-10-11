import * as tripsService from './trips.service.js'
import { originSocketId } from '../../middleware/broadcast.js'
import { emitTripChanged, emitTripDeleted, revokeTripAccess } from '../../realtime/io.js'

const actorOf = (req) => ({ id: req.user.id, name: req.user.name })

export async function create(req, res) {
  const trip = await tripsService.createTrip(req.user.id, req.body)
  req.log.info({ tripId: trip.id, userId: req.user.id }, 'trip created')
  res.status(201).json({ trip })
}

export async function list(req, res) {
  res.json({ trips: await tripsService.listTripsForUser(req.user.id) })
}

export async function get(req, res) {
  res.json({ trip: await tripsService.getTrip(req.valid.params.tripId, req.user.id) })
}

export async function update(req, res) {
  res.json({ trip: await tripsService.updateTrip(req.valid.params.tripId, req.user.id, req.body) })
}

export async function updateBudget(req, res) {
  const trip = await tripsService.updateBudget(req.valid.params.tripId, req.user.id, req.body.budgetMinor)
  req.log.info({ tripId: trip.id, userId: req.user.id, budgetMinor: trip.budgetMinor }, 'trip budget updated')
  res.json({ trip })
}

export async function remove(req, res) {
  await tripsService.deleteTrip(req.valid.params.tripId)
  req.log.info({ tripId: req.valid.params.tripId, userId: req.user.id }, 'trip deleted')
  emitTripDeleted(req.valid.params.tripId, actorOf(req))
  res.status(204).end()
}

export async function removeMember(req, res) {
  await tripsService.removeMember({
    tripId: req.valid.params.tripId,
    targetUserId: req.valid.params.userId,
    actor: req.membership,
  })
  const { tripId, userId } = req.valid.params
  const left = userId === req.user.id
  revokeTripAccess(tripId, userId, { reason: left ? 'left' : 'removed', actor: actorOf(req) })
  emitTripChanged(tripId, { scopes: ['trip'], actor: actorOf(req), exceptSocketId: originSocketId(req) })
  res.status(204).end()
}
