const express = require('express');
const controller = require('../../controllers/fuel/fuel.controller');
const { STAFF_ROLES, requireRole, verifyAccessToken } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const validation = require('../../validations/fuel/fuel.validation');

const router = express.Router();
router.use(verifyAccessToken, requireRole(...STAFF_ROLES));

router.get('/options/vehicles', validate(validation.vehicleOptionsQuerySchema, 'query'), controller.listVehicleOptions);
router.get('/options/trips', validate(validation.tripOptionsQuerySchema, 'query'), controller.listTripOptions);
router.get('/reports/summary', validate(validation.reportQuerySchema, 'query'), controller.getSummary);
router.get('/entries', validate(validation.listQuerySchema, 'query'), controller.listEntries);
router.post('/entries', validate(validation.createEntrySchema), controller.createEntry);

module.exports = router;
