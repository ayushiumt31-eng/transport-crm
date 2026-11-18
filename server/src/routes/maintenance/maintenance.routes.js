const express = require('express');
const controller = require('../../controllers/maintenance/maintenance.controller');
const { STAFF_ROLES, requireRole, verifyAccessToken } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const validation = require('../../validations/maintenance/maintenance.validation');

const router = express.Router();
router.use(verifyAccessToken, requireRole(...STAFF_ROLES));

router.get('/options/vehicles', validate(validation.vehicleOptionsQuerySchema, 'query'), controller.listVehicleOptions);
router.get('/records', validate(validation.listQuerySchema, 'query'), controller.listRecords);
router.post('/records', validate(validation.createRecordSchema), controller.createRecord);
router.patch('/records/:id/status', validate(validation.recordParamsSchema, 'params'), validate(validation.statusSchema), controller.updateRecordStatus);
router.patch('/vehicles/:id/documents/:documentType', validate(validation.documentParamsSchema, 'params'), validate(validation.documentSchema), controller.updateVehicleDocument);
router.get('/reminders', validate(validation.reminderQuerySchema, 'query'), controller.listReminders);
router.get('/reports/summary', controller.getSummary);

module.exports = router;
