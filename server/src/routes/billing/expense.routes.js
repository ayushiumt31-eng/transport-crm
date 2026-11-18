const express = require('express');
const controller = require('../../controllers/billing/expense.controller');
const { STAFF_ROLES, requireRole, verifyAccessToken } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const validation = require('../../validations/billing/expense.validation');

const router = express.Router();
router.use(verifyAccessToken, requireRole(...STAFF_ROLES));
router.get('/reports/summary', validate(validation.reportQuerySchema, 'query'), controller.getSummary);
router.get('/', validate(validation.listQuerySchema, 'query'), controller.listExpenses);
router.post('/', validate(validation.createSchema), controller.createExpense);

module.exports = router;
