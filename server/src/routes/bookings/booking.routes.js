const express = require('express');
const controller = require('../../controllers/bookings/booking.controller');
const { verifyAccessToken, requireRole, STAFF_ROLES } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const {
    bookingCalendarQuerySchema,
    bookingListQuerySchema,
    bookingParamsSchema,
    bookingQuoteSchema,
    bookingRequestSchema,
    bookingStatusSchema,
    quoteDecisionSchema
} = require('../../validations/bookings/booking.validation');

const router = express.Router();
router.use(verifyAccessToken);

router.post('/vehicle', requireRole('customer'), validate(bookingRequestSchema), controller.createVehicleBooking);
router.post('/online', requireRole('customer'), validate(bookingRequestSchema), controller.createOnlineBooking);
router.get('/calendar', requireRole(...STAFF_ROLES), validate(bookingCalendarQuerySchema, 'query'), controller.listCalendar);
router.get('/', requireRole('customer', ...STAFF_ROLES), validate(bookingListQuerySchema, 'query'), controller.listBookings);
router.get('/:bookingId/history', requireRole('customer', ...STAFF_ROLES), validate(bookingParamsSchema, 'params'), controller.getBookingHistory);
router.get('/:bookingId', requireRole('customer', ...STAFF_ROLES), validate(bookingParamsSchema, 'params'), controller.getBooking);
router.put('/:bookingId/quote', requireRole(...STAFF_ROLES), validate(bookingParamsSchema, 'params'), validate(bookingQuoteSchema), controller.issueQuote);
router.patch('/:bookingId/quote/decision', requireRole('customer'), validate(bookingParamsSchema, 'params'), validate(quoteDecisionSchema), controller.respondToQuote);
router.patch('/:bookingId/status', requireRole('customer', ...STAFF_ROLES), validate(bookingParamsSchema, 'params'), validate(bookingStatusSchema), controller.updateBookingStatus);

module.exports = router;
