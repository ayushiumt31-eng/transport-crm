const mongoose = require('mongoose');
const CustomerFeedback = require('../../models/customers/feedback.model');
const { Booking } = require('../../models/bookings/booking.model');
const { Shipment } = require('../../models/cargo/shipment.model');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const STAFF_ROLES = ['admin', 'manager'];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function actorFilter(actor) {
    if (STAFF_ROLES.includes(actor.role)) return {};
    if (actor.role === 'customer' && mongoose.isValidObjectId(actor.id)) {
        return { customerId: new mongoose.Types.ObjectId(actor.id) };
    }
    throw serviceError('You do not have permission to access customer feedback.', 403);
}

function statusHistory(status, remarks, actor) {
    return {
        status,
        remarks,
        updatedBy: String(actor.id),
        role: actor.role,
        createdAt: new Date()
    };
}

exports.listEligibleShipments = async (actor) => {
    if (actor.role !== 'customer' || !mongoose.isValidObjectId(actor.id)) {
        throw serviceError('Only customers can submit service feedback.', 403);
    }
    const bookings = await Booking.find({ customerId: actor.id }).select('_id bookingNumber').lean();
    const bookingIds = bookings.map((booking) => booking._id);
    const existingShipmentIds = await CustomerFeedback.distinct('shipmentId', { customerId: actor.id });
    const shipments = await Shipment.find({
        bookingId: { $in: bookingIds },
        shipmentStatus: 'Delivered',
        pod: { $ne: null },
        _id: { $nin: existingShipmentIds }
    }).populate('bookingId', 'bookingNumber cargo.goodsType')
        .sort({ updatedAt: -1, _id: -1 })
        .lean();
    return shipments.map((shipment) => ({
        _id: String(shipment._id),
        consignmentNumber: shipment.consignmentNumber,
        bookingNumber: shipment.bookingId?.bookingNumber || '',
        goodsType: shipment.bookingId?.cargo?.goodsType || '',
        deliveredAt: shipment.statusHistory.filter((item) => item.status === 'Delivered').at(-1)?.createdAt || shipment.updatedAt
    }));
};

exports.createFeedback = async (data, actor) => {
    if (actor.role !== 'customer' || !mongoose.isValidObjectId(actor.id)) {
        throw serviceError('Only customers can submit service feedback.', 403);
    }
    const shipment = await Shipment.findById(data.shipmentId)
        .select('_id bookingId consignmentNumber shipmentStatus pod')
        .lean();
    if (!shipment) throw serviceError('Delivered shipment not found.', 404);
    const booking = await Booking.findOne({ _id: shipment.bookingId, customerId: actor.id })
        .select('_id bookingNumber')
        .lean();
    if (!booking) throw serviceError('Delivered shipment not found.', 404);
    if (shipment.shipmentStatus !== 'Delivered' || !shipment.pod) {
        throw serviceError('Feedback can be submitted only for a delivered shipment with proof of delivery.', 409);
    }

    try {
        const feedback = await CustomerFeedback.create({
            shipmentId: shipment._id,
            bookingId: booking._id,
            customerId: actor.id,
            bookingNumber: booking.bookingNumber,
            consignmentNumber: shipment.consignmentNumber,
            category: data.category,
            rating: data.rating,
            subject: data.subject,
            message: data.message,
            status: 'Open',
            statusHistory: [statusHistory('Open', 'Customer submitted feedback.', actor)]
        });
        return feedback.toObject();
    } catch (error) {
        if (error?.code === 11000) {
            throw serviceError('Feedback has already been submitted for this shipment.', 409);
        }
        throw error;
    }
};

exports.listFeedback = async (query, actor) => {
    const filter = actorFilter(actor);
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.rating) filter.rating = query.rating;
    if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), 'i');
        filter.$or = [
            { bookingNumber: pattern },
            { consignmentNumber: pattern },
            { subject: pattern },
            { message: pattern },
            { staffResponse: pattern }
        ];
    }
    const skip = (query.page - 1) * query.limit;
    const [feedback, total] = await Promise.all([
        CustomerFeedback.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        CustomerFeedback.countDocuments(filter)
    ]);
    return {
        data: feedback,
        pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }
    };
};

exports.updateFeedback = async (id, data, actor) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid feedback ID.', 400);
    const feedback = await CustomerFeedback.findById(id).select('_id status').lean();
    if (!feedback) throw serviceError('Feedback not found.', 404);
    const allowed = {
        Open: ['Open', 'InReview', 'Resolved'],
        InReview: ['InReview', 'Open', 'Resolved'],
        Resolved: ['Resolved', 'InReview']
    };
    if (!allowed[feedback.status].includes(data.status)) {
        throw serviceError(`Feedback cannot move from ${feedback.status} to ${data.status}.`, 409);
    }
    const updated = await CustomerFeedback.findOneAndUpdate(
        { _id: feedback._id, status: feedback.status },
        {
            $set: { status: data.status, staffResponse: data.staffResponse },
            $push: {
                statusHistory: statusHistory(data.status, data.staffResponse || `Status changed to ${data.status}.`, actor)
            }
        },
        { new: true, runValidators: true }
    ).lean();
    if (!updated) throw serviceError('Feedback changed in another request. Reload and retry.', 409);
    return updated;
};

exports.getSummary = async () => {
    const [groups, ratingRows] = await Promise.all([
        CustomerFeedback.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        CustomerFeedback.aggregate([
            { $group: { _id: null, total: { $sum: 1 }, averageRating: { $avg: '$rating' } } }
        ])
    ]);
    const byStatus = Object.fromEntries(groups.map((item) => [item._id, item.count]));
    return {
        total: ratingRows[0]?.total || 0,
        averageRating: ratingRows[0] ? Math.round(ratingRows[0].averageRating * 100) / 100 : 0,
        open: byStatus.Open || 0,
        inReview: byStatus.InReview || 0,
        resolved: byStatus.Resolved || 0
    };
};
