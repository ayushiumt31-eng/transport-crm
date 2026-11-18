const express = require('express');
const controller = require('../../controllers/notifications/notification.controller');
const { requireRole, verifyAccessToken } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const validation = require('../../validations/notifications/notification.validation');

const router = express.Router();
router.use(verifyAccessToken, requireRole('admin', 'manager', 'driver', 'customer'));
router.get('/', validate(validation.listQuerySchema, 'query'), controller.list);
router.patch('/read-all', controller.markAllAsRead);
router.patch('/:id/read', validate(validation.idParamsSchema, 'params'), controller.markAsRead);

module.exports = router;
