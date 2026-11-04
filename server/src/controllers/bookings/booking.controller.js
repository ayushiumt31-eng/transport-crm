const bookingService = require('../../services/bookings/booking.service');

const handle = (work, status = 200) => async (request, response, next) => {
    try {
        const data = await work(request);
        return response.status(status).json({ success: true, data });
    } catch (error) {
        return next(error);
    }
};

exports.createVehicleBooking = handle((request) => bookingService.createBooking(
    'vehicle',
    request.body,
    request.user
), 201);

exports.createOnlineBooking = handle((request) => bookingService.createBooking(
    'online',
    request.body,
    request.user
), 201);

exports.listBookings = handle((request) => bookingService.listBookings(
    request.validated.query,
    request.user
));

exports.listCalendar = handle((request) => bookingService.listCalendar(request.validated.query));

exports.getBooking = handle((request) => bookingService.getBooking(
    request.params.bookingId,
    request.user
));

exports.getBookingHistory = handle((request) => bookingService.getBookingHistory(
    request.params.bookingId,
    request.user
));

exports.updateBookingStatus = handle((request) => bookingService.updateBookingStatus(
    request.params.bookingId,
    request.body,
    request.user
));
