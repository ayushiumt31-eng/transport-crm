const express = require('express');
const multer = require('multer');
const controller = require('../../controllers/cargo/shipment.controller');
const { STAFF_ROLES, requireRole, verifyAccessToken } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const validation = require('../../validations/cargo/shipment.validation');

const router = express.Router();
const uploadPodFile = multer({ limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file');

function parsePodFile(request, response, next) {
    uploadPodFile(request, response, (error) => {
        if (error) {
            if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
                return response.status(413).json({ success: false, message: 'Proof-of-delivery files cannot exceed 5 MB.' });
            }
            if (error instanceof multer.MulterError) {
                return response.status(400).json({ success: false, message: 'A single proof-of-delivery file is allowed.' });
            }
            return next(error);
        }
        return next();
    });
}

router.use(verifyAccessToken);

router.get('/shipments/options/bookings', requireRole(...STAFF_ROLES), validate(validation.listQuerySchema, 'query'), controller.listAvailableBookings);
router.get('/shipments', requireRole(...STAFF_ROLES, 'driver', 'customer'), validate(validation.listQuerySchema, 'query'), controller.listShipments);
router.post('/shipments', requireRole(...STAFF_ROLES), validate(validation.createSchema), controller.createShipment);
router.get('/shipments/:id/live-location', requireRole(...STAFF_ROLES, 'driver', 'customer'), validate(validation.shipmentParamsSchema, 'params'), controller.getShipmentLiveLocation);
router.get('/shipments/:id', requireRole(...STAFF_ROLES, 'driver', 'customer'), validate(validation.shipmentParamsSchema, 'params'), controller.getShipment);
router.patch('/shipments/:id/status', requireRole(...STAFF_ROLES, 'driver'), validate(validation.shipmentParamsSchema, 'params'), validate(validation.statusSchema), controller.updateShipmentStatus);
router.post(
    '/shipments/:id/pod',
    requireRole(...STAFF_ROLES, 'driver'),
    validate(validation.shipmentParamsSchema, 'params'),
    parsePodFile,
    validate(validation.podSchema),
    controller.uploadProofOfDelivery
);
router.get('/shipments/:id/pod/download', requireRole(...STAFF_ROLES, 'driver', 'customer'), validate(validation.shipmentParamsSchema, 'params'), controller.downloadProofOfDelivery);

module.exports = router;
