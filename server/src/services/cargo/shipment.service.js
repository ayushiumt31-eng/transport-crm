const mongoose = require('mongoose');
const { Booking } = require('../../models/bookings/booking.model');
const { Trip } = require('../../models/trips/trip.model');
const { Shipment, ShipmentCounter } = require('../../models/cargo/shipment.model');
const GpsLocation = require('../../models/gps/gps-location.model');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const STAFF_ROLES = ['admin', 'manager'];
const ACTIVE_TRIP_STATUSES = ['InProgress', 'Delayed'];
const MIME_SIGNATURES = {
    'application/pdf': (data) => data.subarray(0, 5).toString('ascii') === '%PDF-',
    'image/jpeg': (data) => data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
    'image/png': (data) => data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
};
const TRANSITIONS = {
    Booked: ['ReadyForPickup', 'Exception', 'Cancelled'],
    ReadyForPickup: ['PickedUp', 'Exception', 'Cancelled'],
    PickedUp: ['InTransit', 'Exception'],
    InTransit: ['OutForDelivery', 'Exception'],
    OutForDelivery: ['Delivered', 'Exception'],
    Exception: [],
    Delivered: [],
    Cancelled: []
};
const SAFE_BOOKING_FIELDS = 'bookingNumber bookingStatus customerId pickupAddress deliveryAddress cargo schedule';
const SAFE_TRIP_POPULATION = [
    { path: 'vehicleId', select: 'registrationNumber vehicleType' },
    { path: 'driverId', select: 'driverCode personalInfo.fullName' }
];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function nextConsignmentNumber() {
    const year = new Date().getUTCFullYear();
    const counterId = `consignment-${year}`;
    let counter;
    try {
        counter = await ShipmentCounter.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    } catch (error) {
        if (error?.code !== 11000) throw error;
        counter = await ShipmentCounter.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true }
        );
    }
    return `CN-${year}-${String(counter.value).padStart(6, '0')}`;
}

function historyEntry(status, actor, remarks, location) {
    return {
        status,
        remarks,
        ...(location ? { location } : {}),
        updatedBy: String(actor.id),
        role: actor.role,
        createdAt: new Date()
    };
}

function shipmentFilterForActor(actor) {
    if (STAFF_ROLES.includes(actor.role)) return Promise.resolve({});
    if (actor.role === 'customer') {
        return Booking.find({ customerId: actor.id }).distinct('_id')
            .then((bookingIds) => ({ bookingId: { $in: bookingIds } }));
    }
    if (actor.role === 'driver') {
        return Trip.find({ driverId: actor.id }).distinct('bookingId')
            .then((bookingIds) => ({ bookingId: { $in: bookingIds } }));
    }
    throw serviceError('You do not have permission to access shipments.', 403);
}

async function addTripDetails(shipments) {
    const bookingIds = shipments.map((shipment) => shipment.bookingId?._id || shipment.bookingId).filter(Boolean);
    if (!bookingIds.length) return shipments;
    const trips = await Trip.find({ bookingId: { $in: bookingIds } })
        .populate(SAFE_TRIP_POPULATION)
        .sort({ createdAt: -1 })
        .lean();
    const tripsByBooking = new Map();
    trips.forEach((trip) => {
        const key = String(trip.bookingId);
        if (!tripsByBooking.has(key)) tripsByBooking.set(key, trip);
    });
    return shipments.map((shipment) => ({
        ...shipment,
        trip: tripsByBooking.get(String(shipment.bookingId?._id || shipment.bookingId)) || null
    }));
}

async function findShipment(id, actor, { includeContent = false } = {}) {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid shipment ID.', 400);
    const actorFilter = await shipmentFilterForActor(actor);
    const query = Shipment.findOne({ ...actorFilter, _id: id })
        .populate('bookingId', SAFE_BOOKING_FIELDS);
    if (includeContent) query.select('+pod.content');
    const shipment = await query.lean();
    if (!shipment) throw serviceError('Shipment not found.', 404);
    const [withTrip] = await addTripDetails([shipment]);
    return withTrip;
}

function publicShipment(shipment) {
    const result = { ...shipment };
    if (result.pod) {
        result.pod = { ...result.pod };
        delete result.pod.content;
    }
    return result;
}

exports.createShipment = async ({ bookingId }, actor) => {
    if (!mongoose.isValidObjectId(bookingId)) throw serviceError('Invalid booking ID.', 400);
    const booking = await Booking.findById(bookingId).select('_id bookingNumber bookingStatus').lean();
    if (!booking) throw serviceError('Booking not found.', 404);
    if (booking.bookingStatus !== 'confirmed') {
        throw serviceError('A shipment can only be created from a confirmed booking.', 409);
    }

    try {
        const shipment = await Shipment.create({
            consignmentNumber: await nextConsignmentNumber(),
            bookingId: booking._id,
            shipmentStatus: 'Booked',
            statusHistory: [historyEntry('Booked', actor, 'Shipment created from a confirmed booking.')]
        });
        return publicShipment(await findShipment(shipment._id, actor));
    } catch (error) {
        if (error?.code === 11000) {
            throw serviceError('A shipment already exists for this booking, or the consignment number was already used.', 409);
        }
        throw error;
    }
};

exports.listShipments = async (query, actor) => {
    const actorFilter = await shipmentFilterForActor(actor);
    const filter = { ...actorFilter };
    if (query.status) filter.shipmentStatus = query.status;
    if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), 'i');
        const matchingBookings = await Booking.find({
            $or: [
                { bookingNumber: pattern },
                { 'pickupAddress.city': pattern },
                { 'deliveryAddress.city': pattern },
                { 'cargo.goodsType': pattern }
            ]
        }).distinct('_id');
        filter.$or = [
            { consignmentNumber: pattern },
            { bookingId: { $in: matchingBookings } }
        ];
    }

    const skip = (query.page - 1) * query.limit;
    const [shipments, total] = await Promise.all([
        Shipment.find(filter)
            .populate('bookingId', SAFE_BOOKING_FIELDS)
            .sort({ updatedAt: -1, _id: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        Shipment.countDocuments(filter)
    ]);
    const data = await addTripDetails(shipments);
    return {
        data: data.map(publicShipment),
        pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }
    };
};

exports.listAvailableBookings = async ({ page, limit }) => {
    const shippedBookingIds = await Shipment.distinct('bookingId');
    const filter = {
        bookingStatus: 'confirmed',
        _id: { $nin: shippedBookingIds }
    };
    const skip = (page - 1) * limit;
    const [bookings, total] = await Promise.all([
        Booking.find(filter)
            .select('bookingNumber pickupAddress deliveryAddress cargo schedule')
            .sort({ 'schedule.pickupDate': 1, _id: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Booking.countDocuments(filter)
    ]);
    return {
        data: bookings,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
};

exports.getShipment = async (id, actor) => publicShipment(await findShipment(id, actor));

exports.getShipmentLiveLocation = async (id, actor) => {
    const shipment = await findShipment(id, actor);
    const trip = shipment.trip;
    if (!trip || !ACTIVE_TRIP_STATUSES.includes(trip.tripStatus)) {
        return {
            available: false,
            consignmentNumber: shipment.consignmentNumber,
            shipmentStatus: shipment.shipmentStatus,
            tripStatus: trip?.tripStatus || null,
            location: null,
            trail: []
        };
    }

    const points = await GpsLocation.find({ tripId: trip._id })
        .select('latitude longitude recordedAt')
        .sort({ recordedAt: -1, _id: -1 })
        .limit(100)
        .lean();
    const trail = points.reverse();
    const location = trail.at(-1) || null;

    return {
        available: true,
        consignmentNumber: shipment.consignmentNumber,
        shipmentStatus: shipment.shipmentStatus,
        tripStatus: trip.tripStatus,
        vehicle: trip.vehicleId ? { registrationNumber: trip.vehicleId.registrationNumber } : null,
        location: location ? {
            latitude: location.latitude,
            longitude: location.longitude,
            recordedAt: location.recordedAt,
            isStale: Date.now() - new Date(location.recordedAt).getTime() > 90000
        } : null,
        trail
    };
};

exports.updateShipmentStatus = async (id, { shipmentStatus, remarks = '', location }, actor) => {
    const shipment = await findShipment(id, actor);
    const currentStatus = shipment.shipmentStatus;
    const isExceptionRecovery = currentStatus === 'Exception';
    const nextExpected = isExceptionRecovery ? shipment.previousStatus : shipmentStatus;
    if (isExceptionRecovery) {
        if (shipmentStatus !== nextExpected) {
            throw serviceError(`An exception can only be resolved back to ${nextExpected || 'its prior status'}.`, 409);
        }
    } else if (!TRANSITIONS[currentStatus]?.includes(shipmentStatus)) {
        throw serviceError(`Shipment cannot move from ${currentStatus} to ${shipmentStatus}.`, 409);
    }

    if (actor.role === 'driver') {
        if (isExceptionRecovery || shipmentStatus === 'Exception' || shipmentStatus === 'Cancelled') {
            throw serviceError('Only staff can raise or resolve shipment exceptions or cancel shipments.', 403);
        }
        if (!shipment.trip || String(shipment.trip.driverId?._id) !== String(actor.id)) {
            throw serviceError('Shipment not found.', 404);
        }
    }

    if (shipmentStatus === 'PickedUp' && shipment.trip?.tripStatus !== 'InProgress') {
        throw serviceError('Start the assigned trip before confirming pickup.', 409);
    }
    if (shipmentStatus === 'InTransit' && !ACTIVE_TRIP_STATUSES.includes(shipment.trip?.tripStatus)) {
        throw serviceError('An assigned active trip is required to mark a shipment in transit.', 409);
    }
    if (shipmentStatus === 'OutForDelivery' && !ACTIVE_TRIP_STATUSES.includes(shipment.trip?.tripStatus)) {
        throw serviceError('An assigned active trip is required to mark a shipment out for delivery.', 409);
    }
    if (shipmentStatus === 'Delivered') {
        if (!shipment.trip || shipment.trip.tripStatus !== 'Completed') {
            throw serviceError('Complete the linked trip before confirming shipment delivery.', 409);
        }
        if (!shipment.pod) throw serviceError('Upload proof of delivery before confirming delivery.', 409);
    }

    const update = {
        $set: { shipmentStatus },
        $push: { statusHistory: historyEntry(shipmentStatus, actor, remarks, location) }
    };
    if (shipmentStatus === 'Exception') update.$set.previousStatus = currentStatus;
    if (isExceptionRecovery) update.$set.previousStatus = null;
    const updated = await Shipment.findOneAndUpdate(
        { _id: shipment._id, shipmentStatus: currentStatus },
        update,
        { new: true, runValidators: true }
    );
    if (!updated) throw serviceError('Shipment status changed in another request. Refresh and retry.', 409);
    return publicShipment(await findShipment(updated._id, actor));
};

exports.uploadProofOfDelivery = async (id, payload, file, actor) => {
    const shipment = await findShipment(id, actor);
    if (actor.role === 'driver' && (
        !shipment.trip
        || String(shipment.trip.driverId?._id) !== String(actor.id)
        || !ACTIVE_TRIP_STATUSES.concat(['Completed']).includes(shipment.trip.tripStatus)
    )) {
        throw serviceError('Only the driver assigned to the active or completed trip can upload proof of delivery.', 403);
    }
    if (!['PickedUp', 'InTransit', 'OutForDelivery'].includes(shipment.shipmentStatus)) {
        throw serviceError('Delivery confirmation can only be recorded after pickup and before delivery is confirmed.', 409);
    }
    if (file) {
        if (file.size < 1 || file.size > 5 * 1024 * 1024) {
            throw serviceError('Proof-of-delivery files must be between 1 byte and 5 MB.', 413);
        }
        if (!MIME_SIGNATURES[file.mimetype]?.(file.buffer)) {
            throw serviceError('Only valid PDF, JPEG or PNG proof-of-delivery files are accepted.', 415);
        }
    }

    const pod = {
        ...(file ? {
            originalName: file.originalname
                .replace(/[\\/\u0000-\u001f\u007f"]/g, '_')
                .slice(0, 255),
            contentType: file.mimetype,
            size: file.size,
            content: file.buffer
        } : {}),
        receivedBy: payload.receivedBy,
        receivedAt: payload.receivedAt,
        remarks: payload.remarks || '',
        uploadedBy: String(actor.id),
        uploadedAt: new Date()
    };
    const updated = await Shipment.findOneAndUpdate(
        {
            _id: shipment._id,
            shipmentStatus: shipment.shipmentStatus,
            pod: null
        },
        { $set: { pod } },
        { new: true, runValidators: true }
    );
    if (!updated) {
        const latest = await Shipment.findById(shipment._id).select('_id pod shipmentStatus').lean();
        if (!latest) throw serviceError('Shipment not found.', 404);
        if (latest.pod) throw serviceError('A delivery record has already been saved for this shipment.', 409);
        throw serviceError('Shipment status changed while uploading proof of delivery. Refresh and retry.', 409);
    }
    return publicShipment(await findShipment(updated._id, actor));
};

exports.getProofOfDelivery = async (id, actor) => {
    const shipment = await findShipment(id, actor, { includeContent: true });
    if (!shipment.pod) throw serviceError('Proof of delivery not found.', 404);
    if (!shipment.pod.content) throw serviceError('No proof-of-delivery attachment is available for this shipment.', 404);
    return shipment.pod;
};
