const express = require('express');
const controller = require('../../controllers/trips/trip.controller');
const { STAFF_ROLES, requireRole, verifyAccessToken } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const validation = require('../../validations/trips/trip.validation');

const router = express.Router();
const staff = [verifyAccessToken, requireRole(...STAFF_ROLES)];
const tripReader = [verifyAccessToken, requireRole(...STAFF_ROLES, 'driver')];
const query = validate(validation.listQuerySchema, 'query');
const tripId = validate(validation.tripParamsSchema, 'params');

router.get('/metrics', ...staff, query, controller.getTripMetrics);
router.get('/options/allocations', ...staff, controller.listAllocationOptions);
router.get('/options/drivers', ...staff, validate(validation.driverOptionsQuerySchema, 'query'), controller.listDriversForTrip);

router.get('/plans', ...tripReader, query, controller.listRoutePlans);
router.post('/plans', ...staff, validate(validation.routePlanSchema), controller.createRoutePlan);
router.patch('/plans/:id', ...staff, tripId, validate(validation.routePlanUpdateSchema), controller.updateRoutePlan);
router.delete('/plans/:id', ...staff, tripId, controller.deleteRoutePlan);

router.get('/assignments', ...tripReader, query, controller.listAssignments);
router.get('/active', ...tripReader, query, controller.listActiveTrips);
router.get('/history', ...tripReader, query, controller.listTripHistory);

router.get('/', ...tripReader, query, controller.listTrips);
router.post('/', ...staff, validate(validation.tripCreateSchema), controller.createTrip);
router.patch('/:id/assignment', ...staff, tripId, validate(validation.tripAssignmentSchema), controller.assignTrip);
router.patch('/:id/status', ...tripReader, tripId, validate(validation.tripStatusSchema), controller.updateTripStatus);

module.exports = router;
