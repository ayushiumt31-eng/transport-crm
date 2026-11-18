const express = require('express');
const controller = require('../../controllers/routes/route.controller');
const { STAFF_ROLES, requireRole, verifyAccessToken } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const validation = require('../../validations/routes/route.validation');

const router = express.Router();
router.use(verifyAccessToken);

router.get('/suggestions', requireRole(...STAFF_ROLES), validate(validation.suggestionQuerySchema, 'query'), controller.getSuggestions);
router.get('/reports/summary', requireRole(...STAFF_ROLES), validate(validation.summaryQuerySchema, 'query'), controller.getSummary);
router.get('/', requireRole(...STAFF_ROLES, 'driver'), validate(validation.listQuerySchema, 'query'), controller.listRoutes);
router.post('/', requireRole(...STAFF_ROLES), validate(validation.createRouteSchema), controller.createRoute);
router.patch('/:id', requireRole(...STAFF_ROLES), validate(validation.routeParamsSchema, 'params'), validate(validation.updateRouteSchema), controller.updateRoute);
router.patch('/:id/archive', requireRole(...STAFF_ROLES), validate(validation.routeParamsSchema, 'params'), validate(validation.archiveSchema), controller.archiveRoute);

module.exports = router;
