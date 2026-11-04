const mongoose = require('mongoose');
const { Customer } = require('../../models/customers/auth.model');
const { Booking, BookingCounter } = require('../../models/bookings/booking.model');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const STAFF_ROLES = ['admin', 'manager'];
const ALLOWED_STAFF_TRANSITIONS = {
    pending: ['under_review', 'rejected', 'cancelled'],
    under_review: ['quoted', 'rejected', 'cancelled'],
    quoted: ['confirmed', 'rejected', 'cancelled', 'expired'],
    confirmed: ['cancelled'],
    rejected: [],
    cancelled: [],
    expired: []
};

async function findCustomer(id) {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid customer account.', 400);
    const customer = await Customer.findById(id).select('_id status').lean();
    if (!customer) throw serviceError('Customer profile not found.', 404);
    if (customer.status !== 'Active') {
        throw serviceError('Your customer account must be active to manage bookings.', 403);
    }
    return customer;
}

async function nextBookingNumber() {
    const year = new Date().getUTCFullYear();
    const counterId = `booking-${year}`;
    let counter;
    try {
        counter = await BookingCounter.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    } catch (error) {
        if (error.code !== 11000) throw error;
        counter = await BookingCounter.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true }
        );
    }
    return `BK-${year}-${String(counter.value).padStart(6, '0')}`;
}

function ownershipFilter(bookingId, actor) {
    if (!mongoose.isValidObjectId(bookingId)) throw serviceError('Invalid booking ID.', 400);
    const filter = { _id: bookingId };
    if (!STAFF_ROLES.includes(actor.role)) filter.customerId = actor.id;
    return filter;
}

exports.createBooking = async (type, payload, actor) => {
    const customer = await findCustomer(actor.id);
    const bookingNumber = await nextBookingNumber();
    const booking = await Booking.create({
        ...payload,
        bookingNumber,
        bookingType: type,
        customerId: customer._id,
        bookingStatus: 'pending',
        statusHistory: [{
            status: 'pending',
            remarks: 'Booking request submitted.',
            updatedBy: actor.id,
            role: actor.role,
            createdAt: new Date()
        }]
    });
    return booking.toObject();
};

exports.listBookings = async (query, actor) => {
    const filter = {};
    if (!STAFF_ROLES.includes(actor.role)) {
        await findCustomer(actor.id);
        filter.customerId = actor.id;
    }
    if (query.status) filter.bookingStatus = query.status;
    const skip = (query.page - 1) * query.limit;
    const [bookings, total] = await Promise.all([
        Booking.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        Booking.countDocuments(filter)
    ]);
    return {
        bookings,
        pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }
    };
};

exports.listCalendar = async ({ startDate, endDate }) => {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);
    return Booking.find({
        $or: [
            { 'schedule.pickupDate': { $gte: start, $lte: end } },
            { 'schedule.expectedDeliveryDate': { $gte: start, $lte: end } }
        ]
    }).sort({ 'schedule.pickupDate': 1, _id: 1 }).lean();
};

exports.getBooking = async (bookingId, actor) => {
    const booking = await Booking.findOne(ownershipFilter(bookingId, actor)).lean();
    if (!booking) throw serviceError('Booking not found.', 404);
    return booking;
};

exports.getBookingHistory = async (bookingId, actor) => {
    const booking = await Booking.findOne(ownershipFilter(bookingId, actor))
        .select('_id statusHistory')
        .lean();
    if (!booking) throw serviceError('Booking not found.', 404);
    return booking.statusHistory;
};

exports.updateBookingStatus = async (bookingId, { status, remarks = '' }, actor) => {
    const filter = ownershipFilter(bookingId, actor);
    const booking = await Booking.findOne(filter).select('_id bookingStatus').lean();
    if (!booking) throw serviceError('Booking not found.', 404);

    const isStaff = STAFF_ROLES.includes(actor.role);
    const allowed = isStaff
        ? ALLOWED_STAFF_TRANSITIONS[booking.bookingStatus]
        : ['pending', 'under_review', 'quoted'].includes(booking.bookingStatus) ? ['cancelled'] : [];
    if (!allowed.includes(status)) {
        if (!isStaff && status !== 'cancelled') {
            throw serviceError('Customers may only cancel their own booking before it is confirmed.', 403);
        }
        throw serviceError(`Booking cannot move from ${booking.bookingStatus} to ${status}.`, 409);
    }
    if (status === 'rejected' && !remarks.trim()) {
        throw serviceError('A reason is required when rejecting a booking.', 400);
    }

    const updated = await Booking.findOneAndUpdate(
        { ...filter, bookingStatus: booking.bookingStatus },
        {
            $set: { bookingStatus: status },
            $push: {
                statusHistory: {
                    status,
                    remarks,
                    updatedBy: actor.id,
                    role: actor.role,
                    createdAt: new Date()
                }
            }
        },
        { new: true, runValidators: true }
    ).lean();
    if (!updated) throw serviceError('Booking status changed in another request. Reload and try again.', 409);
    return updated;
};
