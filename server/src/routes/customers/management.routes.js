const express = require('express');
const controller = require('../../controllers/customers/management.controller');
const { verifyAccessToken, requireRole, STAFF_ROLES } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const {
    activityListQuerySchema,
    activityParamsSchema,
    activitySchema,
    customerIdParamsSchema,
    customerListQuerySchema,
    customerProfileSchema,
    customerStatusSchema,
    documentParamsSchema,
    documentReviewSchema,
    kycReviewSchema
} = require('../../validations/customers/customer.validation');

const router = express.Router();
router.use(verifyAccessToken, requireRole(...STAFF_ROLES));

router.get('/summary', controller.getSummary);
router.get('/', validate(customerListQuerySchema, 'query'), controller.listCustomers);
router.get('/:id/activities', validate(customerIdParamsSchema, 'params'), validate(activityListQuerySchema, 'query'), controller.listActivities);
router.post('/:id/activities', validate(customerIdParamsSchema, 'params'), validate(activitySchema), controller.createActivity);
router.patch('/:id/activities/:activityId/complete', validate(activityParamsSchema, 'params'), controller.completeFollowUp);
router.get('/:id/kyc/documents', validate(customerIdParamsSchema, 'params'), controller.listKycDocuments);
router.get('/:id/kyc/documents/:documentId/download', validate(documentParamsSchema, 'params'), controller.downloadKycDocument);
router.patch('/:id/kyc/documents/:documentId/review', validate(documentParamsSchema, 'params'), validate(documentReviewSchema), controller.reviewKycDocument);
router.patch('/:id/status', validate(customerIdParamsSchema, 'params'), validate(customerStatusSchema), controller.updateCustomerStatus);
router.patch('/:id/kyc', validate(customerIdParamsSchema, 'params'), validate(kycReviewSchema), controller.reviewCustomerKyc);
router.get('/:id', validate(customerIdParamsSchema, 'params'), controller.getCustomer);
router.put('/:id', validate(customerIdParamsSchema, 'params'), validate(customerProfileSchema), controller.updateCustomerProfile);

module.exports = router;
