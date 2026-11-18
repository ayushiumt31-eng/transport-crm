const express = require('express');
const multer = require('multer');
const controller = require('../../controllers/drivers/driver.controller');
const { STAFF_ROLES, requireRole, verifyAccessToken } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const validation = require('../../validations/drivers/driver.validation');

const router = express.Router();
const staff = [verifyAccessToken, requireRole(...STAFF_ROLES)];
const staffOrDriver = [verifyAccessToken, requireRole(...STAFF_ROLES, 'driver')];
const validateList = validate(validation.listQuerySchema, 'query');
const validateId = validate(validation.idParamsSchema, 'params');
const uploadDocumentFile = multer({ limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file');

function parseDocumentFile(request, response, next) {
    uploadDocumentFile(request, response, (error) => {
        if (error) {
            if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
                return response.status(413).json({ success: false, message: 'Driver documents cannot exceed 5 MB.' });
            }
            if (error instanceof multer.MulterError) {
                return response.status(400).json({ success: false, message: 'A single driver document file is allowed.' });
            }
            return next(error);
        }
        return next();
    });
}

router.get('/performance', ...staff, validateList, controller.getPerformance);

router.get('/licenses', ...staffOrDriver, validateList, controller.listLicenses);
router.post('/licenses', ...staff, validate(validation.licenseSchema), controller.createLicense);
router.patch('/licenses/:id/status', ...staff, validateId, validate(validation.licenseStatusSchema), controller.updateLicenseStatus);
router.patch('/licenses/:id', ...staff, validateId, validate(validation.licenseUpdateSchema), controller.updateLicense);
router.delete('/licenses/:id', ...staff, validateId, controller.deleteLicense);

router.get('/documents', ...staffOrDriver, validateList, controller.listDocuments);
router.get('/documents/:id/download', ...staffOrDriver, validateId, controller.downloadDocument);
router.post('/documents', ...staff, parseDocumentFile, validate(validation.documentSchema), controller.createDocument);
router.patch('/documents/:id', ...staff, validateId, validate(validation.documentUpdateSchema), controller.updateDocument);
router.delete('/documents/:id', ...staff, validateId, controller.deleteDocument);

router.get('/attendance', ...staffOrDriver, validateList, controller.listAttendance);
router.post('/attendance', ...staff, validate(validation.attendanceSchema), controller.createAttendance);
router.patch('/attendance/:id/status', ...staff, validateId, validate(validation.attendanceStatusSchema), controller.updateAttendanceStatus);
router.patch('/attendance/:id', ...staff, validateId, validate(validation.attendanceUpdateSchema), controller.updateAttendance);
router.delete('/attendance/:id', ...staff, validateId, controller.deleteAttendance);

router.get('/payments', ...staffOrDriver, validateList, controller.listPayments);
router.post('/payments', ...staff, validate(validation.paymentSchema), controller.createPayment);
router.patch('/payments/:id/status', ...staff, validateId, validate(validation.paymentStatusSchema), controller.updatePaymentStatus);
router.patch('/payments/:id', ...staff, validateId, validate(validation.paymentUpdateSchema), controller.updatePayment);
router.delete('/payments/:id', ...staff, validateId, controller.deletePayment);

router.get('/', ...staff, validateList, controller.listDrivers);
router.post('/', ...staff, validate(validation.driverSchema), controller.createDriver);
router.get('/:id', ...staff, validateId, controller.getDriver);
router.patch('/:id/status', ...staff, validateId, validate(validation.driverStatusSchema), controller.updateDriverStatus);
router.patch('/:id', ...staff, validateId, validate(validation.driverUpdateSchema), controller.updateDriver);
router.delete('/:id', ...staff, validateId, controller.deleteDriver);

module.exports = router;
