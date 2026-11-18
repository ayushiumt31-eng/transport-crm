const express = require('express');
const controller = require('../../controllers/billing/invoice.controller');
const gstProfileController = require('../../controllers/billing/gst-profile.controller');
const { STAFF_ROLES, requireRole, verifyAccessToken } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const validation = require('../../validations/billing/invoice.validation');
const gstProfileValidation = require('../../validations/billing/gst-profile.validation');

const router = express.Router();
const staff = [verifyAccessToken, requireRole(...STAFF_ROLES)];
const billingReader = [verifyAccessToken, requireRole(...STAFF_ROLES, 'customer')];

router.get('/options/shipments', ...staff, validate(validation.optionsQuerySchema, 'query'), controller.listInvoiceOptions);
router.get('/gst-profile', ...staff, gstProfileController.getProfile);
router.put('/gst-profile', verifyAccessToken, requireRole('admin'), validate(gstProfileValidation.updateSchema), gstProfileController.updateProfile);
router.get('/reports/summary', ...staff, validate(validation.listQuerySchema, 'query'), controller.getFinancialSummary);
router.get('/invoices', ...billingReader, validate(validation.listQuerySchema, 'query'), controller.listInvoices);
router.post('/invoices', ...staff, validate(validation.createInvoiceSchema), controller.createInvoice);
router.get('/invoices/:id', ...billingReader, validate(validation.invoiceParamsSchema, 'params'), controller.getInvoice);
router.patch('/invoices/:id/cancel', ...staff, validate(validation.invoiceParamsSchema, 'params'), validate(validation.cancelInvoiceSchema), controller.cancelInvoice);
router.post('/invoices/:id/payments', ...staff, validate(validation.invoiceParamsSchema, 'params'), validate(validation.paymentSchema), controller.recordPayment);
router.get('/payments', ...billingReader, validate(validation.paymentListQuerySchema, 'query'), controller.listPayments);

module.exports = router;
