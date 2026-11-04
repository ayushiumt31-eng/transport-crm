const express = require('express');
const multer = require('multer');
const controller = require('../../controllers/customers/portal.controller');
const { verifyAccessToken, requireRole } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const {
    customerIdParamsSchema,
    documentUploadSchema,
    portalProfileSchema,
    portalDocumentParamsSchema,
    preferencesSchema,
    savedAddressSchema
} = require('../../validations/customers/customer.validation');

const router = express.Router();
const uploadKycDocument = multer({ limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file');

function parseKycDocument(request, response, next) {
    uploadKycDocument(request, response, (error) => {
        if (error) {
            if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
                return response.status(413).json({ success: false, message: 'KYC documents cannot exceed 5 MB.' });
            }
            if (error instanceof multer.MulterError) {
                return response.status(400).json({ success: false, message: 'A single KYC document file is allowed.' });
            }
            return next(error);
        }
        return next();
    });
}

function requireKycFile(request, response, next) {
    if (!request.file) {
        return response.status(400).json({ success: false, message: 'Choose a document file to upload.' });
    }
    return next();
}

router.use(verifyAccessToken, requireRole('customer'));

router.get('/dashboard', controller.getDashboard);
router.get('/profile', controller.getProfile);
router.put('/profile', validate(portalProfileSchema), controller.updateProfile);
router.post('/kyc/submit', controller.submitKyc);
router.post('/kyc/documents', parseKycDocument, requireKycFile, validate(documentUploadSchema), controller.uploadKycDocument);
router.get('/kyc/documents', controller.listKycDocuments);
router.get('/kyc/documents/:documentId/download', validate(portalDocumentParamsSchema, 'params'), controller.downloadKycDocument);
router.get('/preferences', controller.getPreferences);
router.put('/preferences', validate(preferencesSchema), controller.updatePreferences);
router.get('/addresses', controller.listAddresses);
router.post('/addresses', validate(savedAddressSchema), controller.saveAddress);
router.put('/addresses/:id', validate(customerIdParamsSchema, 'params'), validate(savedAddressSchema), controller.updateAddress);
router.delete('/addresses/:id', validate(customerIdParamsSchema, 'params'), controller.deleteAddress);

module.exports = router;
