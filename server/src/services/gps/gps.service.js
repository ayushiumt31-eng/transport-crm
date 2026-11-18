const mongoose = require('mongoose');
const { Trip } = require('../../models/trips/trip.model');
const GpsLocation = require('../../models/gps/gps-location.model');
const GpsAlert = require('../../models/gps/gps-alert.model');
const { GpsGeofence, GpsGeofenceState } = require('../../models/gps/gps-geofence.model');
const notificationService = require('../notifications/notification.service');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const earthRadiusMeters = 6371008.8;

function actorId(actor) {
    return String(actor.id);
}

function pagination(total, page, limit) {
    return { total, page, limit, totalPages: Math.ceil(total / limit) };
}

function haversineMeters(latitude1, longitude1, latitude2, longitude2) {
    const radians = (degrees) => degrees * Math.PI / 180;
    const latitudeDelta = radians(latitude2 - latitude1);
    const longitudeDelta = radians(longitude2 - longitude1);
    const value = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2))
        * Math.sin(longitudeDelta / 2) ** 2;
    return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function configuredSpeedLimit() {
    const value = process.env.GPS_SPEED_ALERT_LIMIT_KMH;
    if (!value) return 80;
    const limit = Number(value);
    if (!Number.isFinite(limit) || limit <= 0 || limit > 300) {
        throw serviceError('GPS_SPEED_ALERT_LIMIT_KMH must be a number greater than 0 and no greater than 300.', 500);
    }
    return limit;
}

async function findTripForActor(tripId, actor) {
    if (!mongoose.isValidObjectId(tripId)) throw serviceError('Invalid trip ID.', 400);
    const filter = { _id: tripId };
    if (actor.role === 'driver') filter.driverId = actorId(actor);
    const trip = await Trip.findOne(filter)
        .populate('vehicleId', 'registrationNumber vehicleType')
        .populate('driverId', 'driverCode personalInfo.fullName')
        .lean();
    if (!trip) throw serviceError('Trip not found.', 404);
    return trip;
}

exports.getMapConfig = async () => {
    const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) throw serviceError('Google Maps is not configured. Set VITE_GOOGLE_MAPS_API_KEY in server/.env and restart the API.', 503);
    return { provider: 'Google Maps', apiKey };
};

exports.listActiveTrips = async (query, actor) => {
    const filter = { tripStatus: { $in: ['InProgress', 'Delayed'] } };
    if (actor.role === 'driver') filter.driverId = actorId(actor);
    const skip = (query.page - 1) * query.limit;
    const [trips, total] = await Promise.all([
        Trip.find(filter)
            .populate('vehicleId', 'registrationNumber vehicleType')
            .populate('driverId', 'driverCode personalInfo.fullName')
            .sort({ scheduledAt: 1, _id: 1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        Trip.countDocuments(filter)
    ]);
    const tripIds = trips.map((trip) => trip._id);
    const locations = tripIds.length ? await GpsLocation.aggregate([
        { $match: { tripId: { $in: tripIds } } },
        { $sort: { recordedAt: -1, _id: -1 } },
        { $group: { _id: '$tripId', location: { $first: '$$ROOT' } } }
    ]) : [];
    const locationByTrip = new Map(locations.map((item) => [String(item._id), item.location]));
    return {
        data: trips.map((trip) => ({ ...trip, lastLocation: locationByTrip.get(String(trip._id)) || null })),
        pagination: pagination(total, query.page, query.limit)
    };
};

exports.listLocations = async (tripId, query, actor) => {
    await findTripForActor(tripId, actor);
    const filter = { tripId };
    if (query.startDate || query.endDate) {
        filter.recordedAt = {};
        if (query.startDate) filter.recordedAt.$gte = new Date(query.startDate);
        if (query.endDate) filter.recordedAt.$lte = new Date(query.endDate);
    }
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
        GpsLocation.find(filter).sort({ recordedAt: -1, _id: -1 }).skip(skip).limit(query.limit).lean(),
        GpsLocation.countDocuments(filter)
    ]);
    return { data, pagination: pagination(total, query.page, query.limit) };
};

exports.recordLocation = async (tripId, data, actor) => {
    const trip = await findTripForActor(tripId, actor);
    if (actor.role !== 'driver') throw serviceError('Only the assigned driver can share trip location.', 403);
    if (!['InProgress', 'Delayed'].includes(trip.tripStatus)) {
        throw serviceError('Location sharing is available only while the trip is in progress or delayed.', 409);
    }

    const recordedAt = new Date(data.recordedAt);
    const now = Date.now();
    if (recordedAt.getTime() > now + 60000 || recordedAt.getTime() < now - 5 * 60 * 1000) {
        throw serviceError('Location timestamp must be current and within the last five minutes.', 400);
    }
    if (data.accuracyMeters > 500) throw serviceError('GPS accuracy is too low. Move to an area with a clearer signal and retry.', 400);

    const previous = await GpsLocation.findOne({ tripId: trip._id }).sort({ recordedAt: -1, _id: -1 }).lean();
    if (previous && recordedAt <= previous.recordedAt) {
        throw serviceError('This location is older than the latest recorded position.', 409);
    }
    if (previous && now - previous.receivedAt.getTime() < 5000) {
        throw serviceError('Location updates are limited to one every five seconds.', 429);
    }
    const speedLimitKmh = configuredSpeedLimit();

    let speedKmh = data.speedMetersPerSecond == null ? null : Math.round(data.speedMetersPerSecond * 3.6 * 10) / 10;
    if (speedKmh == null && previous) {
        const elapsedHours = (recordedAt.getTime() - previous.recordedAt.getTime()) / 3600000;
        if (elapsedHours > 0) {
            const distanceKm = haversineMeters(previous.latitude, previous.longitude, data.latitude, data.longitude) / 1000;
            const estimatedSpeed = distanceKm / elapsedHours;
            if (estimatedSpeed <= 300) speedKmh = Math.round(estimatedSpeed * 10) / 10;
        }
    }

    const location = await GpsLocation.create({
        tripId: trip._id,
        vehicleId: trip.vehicleId._id,
        driverId: trip.driverId._id,
        latitude: data.latitude,
        longitude: data.longitude,
        point: { type: 'Point', coordinates: [data.longitude, data.latitude] },
        accuracyMeters: data.accuracyMeters,
        speedKmh,
        headingDegrees: data.headingDegrees,
        recordedAt
    });
    const alerts = [];
    if (speedKmh != null && speedKmh > speedLimitKmh
        && (!previous || previous.speedKmh == null || previous.speedKmh <= speedLimitKmh)) {
        alerts.push({
            tripId: trip._id,
            vehicleId: trip.vehicleId._id,
            driverId: trip.driverId._id,
            locationId: location._id,
            type: 'SpeedLimitExceeded',
            message: `Reported speed ${speedKmh} km/h exceeded the configured ${speedLimitKmh} km/h alert threshold.`,
            speedKmh,
            recordedAt
        });
    }

    const geofences = await GpsGeofence.find({ isActive: true }).lean();
    for (const geofence of geofences) {
        const distanceMeters = haversineMeters(data.latitude, data.longitude, geofence.latitude, geofence.longitude);
        const isInside = distanceMeters <= geofence.radiusMeters;
        const state = await GpsGeofenceState.findOne({ tripId: trip._id, geofenceId: geofence._id }).lean();
        if (state?.isInside === isInside) continue;

        await GpsGeofenceState.findOneAndUpdate(
            { tripId: trip._id, geofenceId: geofence._id },
            { $set: { isInside, updatedAt: recordedAt } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        if (isInside || state) {
            const type = isInside ? 'GeofenceEntered' : 'GeofenceExited';
            alerts.push({
                tripId: trip._id,
                vehicleId: trip.vehicleId._id,
                driverId: trip.driverId._id,
                locationId: location._id,
                geofenceId: geofence._id,
                type,
                message: `${trip.tripNumber} ${isInside ? 'entered' : 'exited'} geofence "${geofence.name}".`,
                recordedAt
            });
        }
    }
    if (alerts.length) {
        const createdAlerts = await GpsAlert.insertMany(alerts);
        try {
            await notificationService.publishGpsAlerts(createdAlerts);
        } catch (error) {
            notificationService.logPublishingFailure('GPS alert', error);
        }
    }
    return { location: location.toObject(), speedLimitKmh, alertsCreated: alerts.length };
};

exports.listGeofences = async () => GpsGeofence.find({ isActive: true }).sort({ name: 1 }).lean();

exports.createGeofence = async (data, actor) => GpsGeofence.create({
    ...data,
    createdBy: actorId(actor),
    updatedBy: actorId(actor)
});

exports.archiveGeofence = async (id, actor) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid geofence ID.', 400);
    const geofence = await GpsGeofence.findOneAndUpdate(
        { _id: id, isActive: true },
        { $set: { isActive: false, updatedBy: actorId(actor) } },
        { new: true, runValidators: true }
    );
    if (!geofence) throw serviceError('Active geofence not found.', 404);
    return geofence;
};

exports.listAlerts = async (query, actor) => {
    const filter = {};
    if (actor.role === 'driver') filter.driverId = actorId(actor);
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
        GpsAlert.find(filter)
            .populate('tripId', 'tripNumber tripStatus')
            .populate('vehicleId', 'registrationNumber')
            .populate('driverId', 'driverCode personalInfo.fullName')
            .populate('geofenceId', 'name')
            .sort({ recordedAt: -1, _id: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        GpsAlert.countDocuments(filter)
    ]);
    return { data, pagination: pagination(total, query.page, query.limit) };
};
