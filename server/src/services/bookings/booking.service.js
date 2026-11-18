const mongoose = require('mongoose');
const { Customer } = require('../../models/customers/auth.model');
const { Booking, BookingCounter } = require('../../models/bookings/booking.model');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const STAFF_ROLES = ['admin', 'manager'];
const ALLOWED_STAFF_TRANSITIONS = {
    pending: ['under_review', 'rejected', 'cancelled'],
    under_review: ['rejected', 'cancelled'],
    quoted: ['rejected', 'cancelled', 'expired'],
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

function roundedProductRatio(left, right, denominator) {
    const numerator = BigInt(left) * BigInt(right);
    const result = Number((numerator + BigInt(denominator) / 2n) / BigInt(denominator));
    if (!Number.isSafeInteger(result)) throw serviceError('A quote amount is outside the supported range.', 400);
    return result;
}

function toPaise(amount) {
    const paise = Math.round(amount * 100);
    if (!Number.isSafeInteger(paise)) throw serviceError('A quote amount is outside the supported range.', 400);
    return paise;
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

exports.issueQuote = async (bookingId, data, actor) => {
    const filter = ownershipFilter(bookingId, actor);
    const booking = await Booking.findOne(filter).select('_id bookingStatus quote').lean();
    if (!booking) throw serviceError('Booking not found.', 404);
    if (!['under_review', 'quoted'].includes(booking.bookingStatus)) {
        throw serviceError('A quote can only be issued while a booking is under review or awaiting quote acceptance.', 409);
    }
    if (booking.quote && ['Accepted', 'Declined'].includes(booking.quote.status)) {
        throw serviceError('A customer-approved or declined quote cannot be replaced.', 409);
    }

    const validUntil = new Date(`${data.validUntil}T23:59:59.999Z`);
    if (validUntil <= new Date()) throw serviceError('Quote expiry must be in the future.', 400);
    const items = data.items.map((item) => {
        const quantityMilli = Math.round(item.quantity * 1000);
        const unitPricePaise = toPaise(item.unitPrice);
        return {
            description: item.description,
            quantityMilli,
            unitPricePaise,
            lineTotalPaise: roundedProductRatio(quantityMilli, unitPricePaise, 1000)
        };
    });
    const totalPaise = items.reduce((total, item) => total + item.lineTotalPaise, 0);
    if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) {
        throw serviceError('Quote total must be greater than zero and within the supported range.', 400);
    }
    const version = (booking.quote?.version || 0) + 1;
    const now = new Date();
    const quote = {
        version,
        currency: 'INR',
        items,
        subtotalPaise: totalPaise,
        totalPaise,
        terms: data.terms,
        validUntil,
        status: 'PendingAcceptance',
        issuedBy: String(actor.id),
        issuedAt: now,
        respondedBy: '',
        respondedAt: null
    };
    const updated = await Booking.findOneAndUpdate(
        {
            ...filter,
            bookingStatus: booking.bookingStatus,
            ...(booking.quote
                ? { 'quote.version': booking.quote.version, 'quote.status': booking.quote.status }
                : { quote: null })
        },
        {
            $set: { bookingStatus: 'quoted', quote },
            $push: {
                statusHistory: {
                    status: 'quoted',
                    remarks: `Quote v${version} issued for INR ${(totalPaise / 100).toFixed(2)}, valid through ${data.validUntil}.`,
                    updatedBy: String(actor.id),
                    role: actor.role,
                    createdAt: now
                }
            }
        },
        { new: true, runValidators: true }
    ).lean();
    if (!updated) throw serviceError('Booking or quote changed in another request. Reload and retry.', 409);
    return updated;
};

exports.respondToQuote = async (bookingId, { decision, version, remarks = '' }, actor) => {
    const filter = ownershipFilter(bookingId, actor);
    const booking = await Booking.findOne(filter).select('_id bookingStatus quote').lean();
    if (!booking) throw serviceError('Booking not found.', 404);
    if (booking.bookingStatus !== 'quoted' || !booking.quote) {
        throw serviceError('There is no active quote to respond to.', 409);
    }
    if (booking.quote.version !== version) throw serviceError('This quote has been replaced. Refresh and review the current quote.', 409);
    if (booking.quote.status !== 'PendingAcceptance') throw serviceError('This quote has already been answered or expired.', 409);
    const now = new Date();
    if (booking.quote.validUntil <= now) {
        await Booking.updateOne(
            { ...filter, bookingStatus: 'quoted', 'quote.version': version, 'quote.status': 'PendingAcceptance' },
            { $set: { 'quote.status': 'Expired' } }
        );
        throw serviceError('This quote has expired. Contact staff for a revised quote.', 409);
    }

    const accepted = decision === 'accept';
    const nextStatus = accepted ? 'confirmed' : 'rejected';
    const updated = await Booking.findOneAndUpdate(
        {
            ...filter,
            bookingStatus: 'quoted',
            'quote.version': version,
            'quote.status': 'PendingAcceptance',
            'quote.validUntil': { $gt: now }
        },
        {
            $set: {
                bookingStatus: nextStatus,
                'quote.status': accepted ? 'Accepted' : 'Declined',
                'quote.respondedBy': String(actor.id),
                'quote.respondedAt': now
            },
            $push: {
                statusHistory: {
                    status: nextStatus,
                    remarks: accepted ? `Quote v${version} accepted by customer.` : `Quote v${version} declined by customer: ${remarks}`,
                    updatedBy: String(actor.id),
                    role: actor.role,
                    createdAt: now
                }
            }
        },
        { new: true, runValidators: true }
    ).lean();
    if (!updated) throw serviceError('Quote expired or booking changed while processing your response. Refresh and try again.', 409);
    return updated;
};

exports.updateBookingStatus = async (bookingId, { status, remarks = '' }, actor) => {
    const filter = ownershipFilter(bookingId, actor);
    const booking = await Booking.findOne(filter).select('_id bookingStatus quote.version quote.validUntil').lean();
    if (!booking) throw serviceError('Booking not found.', 404);

    const isStaff = STAFF_ROLES.includes(actor.role);
    if (status === 'quoted') {
        throw serviceError('Issue a priced quote before changing a booking to quoted.', 409);
    }
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
    if (status === 'confirmed' && booking.bookingStatus === 'quoted') {
        throw serviceError('The customer must accept the active quote before the booking can be confirmed.', 409);
    }
    if (status === 'expired' && booking.bookingStatus === 'quoted') {
        if (!booking.quote?.validUntil || booking.quote.validUntil > new Date()) {
            throw serviceError('A quote can only be expired after its validity period ends.', 409);
        }
    }

    const now = new Date();
    const updated = await Booking.findOneAndUpdate(
        {
            ...filter,
            bookingStatus: booking.bookingStatus,
            ...(status === 'expired' && booking.bookingStatus === 'quoted' ? {
                'quote.version': booking.quote.version,
                'quote.validUntil': { $lte: now }
            } : {})
        },
        {
            $set: {
                bookingStatus: status,
                ...(['expired', 'cancelled', 'rejected'].includes(status) && booking.bookingStatus === 'quoted'
                    ? { 'quote.status': status === 'expired' ? 'Expired' : 'Withdrawn' }
                    : {})
            },
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
