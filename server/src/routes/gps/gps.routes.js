const express = require('express');
const controller = require('../../controllers/gps/gps.controller');
const { STAFF_ROLES, requireRole, verifyAccessToken } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const validation = require('../../validations/gps/gps.validation');

const router = express.Router();
const staff = [requireRole(...STAFF_ROLES)];
const tripUsers = [requireRole(...STAFF_ROLES, 'driver')];

router.use(verifyAccessToken);
router.get('/map-config', requireRole(...STAFF_ROLES, 'driver', 'customer'), controller.getMapConfig);
router.get('/active', requireRole(...STAFF_ROLES, 'driver'), validate(validation.listQuerySchema, 'query'), controller.listActiveTrips);
router.get('/trips/:tripId/locations', requireRole(...STAFF_ROLES, 'driver'), validate(validation.tripParamsSchema, 'params'), validate(validation.historyQuerySchema, 'query'), controller.listLocations);
router.post('/trips/:tripId/location', requireRole('driver'), validate(validation.tripParamsSchema, 'params'), validate(validation.locationSchema), controller.recordLocation);
router.get('/geofences', requireRole(...STAFF_ROLES, 'driver'), controller.listGeofences);
router.post('/geofences', ...staff, validate(validation.createGeofenceSchema), controller.createGeofence);
router.patch('/geofences/:id/archive', ...staff, validate(validation.geofenceParamsSchema, 'params'), controller.archiveGeofence);
router.get('/alerts', ...tripUsers, validate(validation.listQuerySchema, 'query'), controller.listAlerts);

module.exports = router;
