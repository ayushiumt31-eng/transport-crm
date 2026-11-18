const express = require('express');
const controller = require('../../controllers/customers/feedback.controller');
const { STAFF_ROLES, requireRole, verifyAccessToken } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const validation = require('../../validations/customers/feedback.validation');

const router = express.Router();
router.use(verifyAccessToken);

router.get('/options/shipments', requireRole('customer'), controller.listEligibleShipments);
router.get('/summary', requireRole(...STAFF_ROLES), controller.getSummary);
router.get('/', requireRole('customer', ...STAFF_ROLES), validate(validation.listQuerySchema, 'query'), controller.listFeedback);
router.post('/', requireRole('customer'), validate(validation.createSchema), controller.createFeedback);
router.patch('/:id', requireRole(...STAFF_ROLES), validate(validation.paramsSchema, 'params'), validate(validation.updateSchema), controller.updateFeedback);

module.exports = router;
