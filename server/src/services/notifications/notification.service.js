const mongoose = require('mongoose');
const Notification = require('../../models/notifications/notification.model');
const { Booking } = require('../../models/bookings/booking.model');
const { UserAccount } = require('../../models/auth/user-account.model');
const { Trip } = require('../../models/trips/trip.model');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const TRIP_TITLES = {
    Scheduled: 'Trip scheduled',
    Assigned: 'Driver assigned',
    InProgress: 'Trip started',
    Delayed: 'Trip delayed',
    Completed: 'Trip completed',
    Cancelled: 'Trip cancelled'
};
const GPS_TITLES = {
    SpeedLimitExceeded: 'Speed limit exceeded',
    GeofenceEntered: 'Geofence entered',
    GeofenceExited: 'Geofence exited'
};

async function recipientAccounts(trip) {
    const filters = [{ role: { $in: ['admin', 'manager'] }, status: 'Active' }];
    const driverId = trip.driverId?._id || trip.driverId;
    if (driverId) filters.push({ role: 'driver', profileId: driverId, status: 'Active' });

    const bookingId = trip.bookingId?._id || trip.bookingId;
    if (bookingId) {
        const booking = await Booking.findById(bookingId).select('customerId').lean();
        if (booking?.customerId) {
            filters.push({ role: 'customer', profileId: booking.customerId, status: 'Active' });
        }
    }

    return UserAccount.find({ $or: filters }).select('_id').lean();
}

async function publishToTripRecipients(trip, { eventKey, category, eventType, title, message }) {
    if (!trip?._id || !eventKey || !title || !message) return;
    const accounts = await recipientAccounts(trip);
    if (!accounts.length) return;

    await Notification.bulkWrite(accounts.map((account) => ({
        updateOne: {
            filter: { eventKey, recipientAccountId: account._id },
            update: {
                $setOnInsert: {
                    recipientAccountId: account._id,
                    eventKey,
                    category,
                    eventType,
                    title,
                    message,
                    tripId: trip._id,
                    tripNumber: trip.tripNumber || ''
                }
            },
            upsert: true
        }
    })), { ordered: false });
}

exports.publishTripEvent = async ({ tripId, status, remarks = '' }) => {
    const trip = await Trip.findById(tripId).select('_id bookingId driverId tripNumber statusUpdatedAt').lean();
    if (!trip || !TRIP_TITLES[status]) return;
    const timeKey = new Date(trip.statusUpdatedAt || trip.updatedAt).getTime();
    const suffix = remarks.trim() ? ` Note: ${remarks.trim()}` : '';
    await publishToTripRecipients(trip, {
        eventKey: `trip:${trip._id}:${status}:${timeKey}`,
        category: 'trip',
        eventType: `Trip${status}`,
        title: TRIP_TITLES[status],
        message: `${trip.tripNumber} is now ${status}.${suffix}`.slice(0, 500)
    });
};

exports.publishGpsAlerts = async (alerts) => {
    for (const alert of alerts) {
        const trip = await Trip.findById(alert.tripId).select('_id bookingId driverId tripNumber').lean();
        if (!trip || !GPS_TITLES[alert.type]) continue;
        await publishToTripRecipients(trip, {
            eventKey: `gps:${alert._id}`,
            category: 'gps',
            eventType: alert.type,
            title: GPS_TITLES[alert.type],
            message: alert.message
        });
    }
};

exports.listNotifications = async (query, actor) => {
    const recipientAccountId = actor.accountId;
    const filter = { recipientAccountId };
    if (query.category) filter.category = query.category;
    if (query.unreadOnly) filter.readAt = null;
    const skip = (query.page - 1) * query.limit;
    const [data, total, unreadCount] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(query.limit).lean(),
        Notification.countDocuments(filter),
        Notification.countDocuments({ recipientAccountId, readAt: null })
    ]);
    return {
        data,
        unreadCount,
        pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }
    };
};

exports.markAsRead = async (id, actor) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid notification ID.', 400);
    const notification = await Notification.findOneAndUpdate(
        { _id: id, recipientAccountId: actor.accountId, readAt: null },
        { $set: { readAt: new Date() } },
        { new: true }
    ).lean();
    if (notification) return notification;
    const existing = await Notification.exists({ _id: id, recipientAccountId: actor.accountId });
    if (!existing) throw serviceError('Notification not found.', 404);
    return Notification.findById(id).lean();
};

exports.markAllAsRead = async (actor) => {
    const result = await Notification.updateMany(
        { recipientAccountId: actor.accountId, readAt: null },
        { $set: { readAt: new Date() } }
    );
    return { updatedCount: result.modifiedCount };
};

exports.logPublishingFailure = (eventType, error) => {
    console.error(`Failed to publish ${eventType} in-app notification:`, error);
};
