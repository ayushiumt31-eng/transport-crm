const mongoose = require('mongoose');
const { Booking } = require('../../models/bookings/booking.model');
const Driver = require('../../models/driver/driver.model');
const DriverLicense = require('../../models/driver/driver-license.model');
const FleetVehicle = require('../../models/fleet/vehicle.model');
const { VehicleAllocation } = require('../../models/fleet/vehicle-allocation.model');
const { Trip, TripCounter } = require('../../models/trips/trip.model');
const TripRoutePlan = require('../../models/trips/trip-route-plan.model');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const ACTIVE_TRIP_STATUSES = ['Scheduled', 'Assigned', 'Starting', 'InProgress', 'Delayed', 'Completing', 'Cancelling'];
const PUBLIC_TRIP_STATUSES = ['Scheduled', 'Assigned', 'InProgress', 'Delayed', 'Completed', 'Cancelled'];

const actorId = (actor) => String(actor.id);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const utcDay = (value) => {
    const date = new Date(value);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

async function nextTripNumber() {
    const year = new Date().getUTCFullYear();
    const counterId = `trip-${year}`;
    let counter;
    try {
        counter = await TripCounter.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    } catch (error) {
        if (error?.code !== 11000) throw error;
        counter = await TripCounter.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true }
        );
    }
    return `TR-${year}-${String(counter.value).padStart(6, '0')}`;
}

function populateTrip(query) {
    return query
        .populate('bookingId', 'bookingNumber bookingStatus pickupAddress deliveryAddress cargo schedule')
        .populate('vehicleId', 'registrationNumber vehicleType manufacturer model vehicleStatus')
        .populate('driverId', 'driverCode personalInfo.fullName contactInfo.phone driverStatus');
}

async function findTrip(id, actor, options = {}) {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid trip ID.', 400);
    const filter = { _id: id };
    if (actor?.role === 'driver' || options.driverScoped) filter.driverId = actor.id;
    const trip = await populateTrip(Trip.findOne(filter));
    if (!trip) throw serviceError('Trip not found.', 404);
    return trip;
}

function dateRange(query, field) {
    const filter = {};
    if (query.startDate || query.endDate) {
        filter[field] = {};
        if (query.startDate) filter[field].$gte = query.startDate;
        if (query.endDate) {
            const end = new Date(query.endDate);
            end.setUTCHours(23, 59, 59, 999);
            filter[field].$lte = end;
        }
    }
    return filter;
}

function queryFilter(query, actor, statusOverride) {
    const filter = {};
    if (actor.role === 'driver') filter.driverId = actor.id;
    const status = statusOverride || query.status;
    if (Array.isArray(status)) filter.tripStatus = { $in: status };
    else if (status) filter.tripStatus = status;
    if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), 'i');
        filter.$or = [
            { tripNumber: pattern },
            { routeId: pattern },
            { notes: pattern }
        ];
    }
    Object.assign(filter, dateRange(query, 'scheduledAt'));
    return filter;
}

async function listTrips(query, actor, statusOverride) {
    const filter = queryFilter(query, actor, statusOverride);
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
        populateTrip(Trip.find(filter).sort({ scheduledAt: -1, _id: -1 }).skip(skip).limit(query.limit)).lean(),
        Trip.countDocuments(filter)
    ]);
    return {
        data,
        pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }
    };
}

function addHistory(status, actor, remarks = '') {
    return {
        status,
        remarks,
        updatedBy: actorId(actor),
        role: actor.role,
        createdAt: new Date()
    };
}

function addFleetHistory(status, actor, remarks) {
    return {
        status,
        remarks,
        updatedBy: actorId(actor),
        role: actor.role,
        createdAt: new Date()
    };
}

async function eligibleDriver(driverId, scheduledAt, expectedDeliveryAt) {
    if (!mongoose.isValidObjectId(driverId)) throw serviceError('Invalid driver ID.', 400);
    const driver = await Driver.findOne({
        _id: driverId,
        isDeleted: false,
        driverStatus: 'Available'
    }).lean();
    if (!driver) throw serviceError('Driver is not available for assignment.', 409);

    const validLicense = await DriverLicense.exists({
        driverId,
        isDeleted: false,
        licenseType: { $in: ['HMV', 'Transport'] },
        status: { $ne: 'UnderReview' },
        expiryDate: { $gte: utcDay(expectedDeliveryAt) },
        $or: [{ issueDate: null }, { issueDate: { $lte: utcDay(scheduledAt) } }]
    });
    if (!validLicense) {
        throw serviceError('Driver needs a valid HMV or Transport licence for the scheduled trip date.', 409);
    }
    return driver;
}

async function setDriverStatus(driverId, expectedStatus, nextStatus, actor, remarks) {
    const driver = await Driver.findOneAndUpdate(
        { _id: driverId, driverStatus: expectedStatus, isDeleted: false },
        {
            $set: { driverStatus: nextStatus, statusUpdatedAt: new Date() },
            $push: {
                statusHistory: {
                    status: nextStatus,
                    remarks,
                    updatedBy: actorId(actor),
                    role: actor.role,
                    createdAt: new Date()
                }
            }
        },
        { new: true, runValidators: true }
    );
    if (!driver) throw serviceError('Driver availability changed. Refresh and retry.', 409);
    return driver;
}

async function setVehicleStatus(vehicleId, expectedStatus, nextStatus, actor, remarks) {
    const vehicle = await FleetVehicle.findOneAndUpdate(
        { _id: vehicleId, vehicleStatus: expectedStatus, isDeleted: false },
        {
            $set: { vehicleStatus: nextStatus, statusUpdatedAt: new Date() },
            $push: { statusHistory: addFleetHistory(nextStatus, actor, remarks) }
        },
        { new: true, runValidators: true }
    );
    if (!vehicle) throw serviceError('Vehicle status changed. Refresh and retry.', 409);
    return vehicle;
}

async function transitionTrip(trip, fromStatuses, nextStatus, actor, remarks, extra = {}) {
    const update = {
        $set: { tripStatus: nextStatus, statusUpdatedAt: new Date(), ...extra }
    };
    if (PUBLIC_TRIP_STATUSES.includes(nextStatus)) {
        update.$push = { statusHistory: addHistory(nextStatus, actor, remarks) };
    }
    const updated = await Trip.findOneAndUpdate(
        { _id: trip._id, tripStatus: { $in: fromStatuses } },
        update,
        { new: true, runValidators: true }
    );
    if (!updated) throw serviceError('Trip status changed in another request. Refresh and retry.', 409);
    return updated;
}

async function releaseAllocation(trip, actor, allocationStatus, remarks) {
    const allocation = await VehicleAllocation.findOneAndUpdate(
        { _id: trip.allocationId, allocationStatus: 'Allocated' },
        {
            $set: { allocationStatus },
            $push: {
                statusHistory: {
                    status: allocationStatus,
                    remarks,
                    updatedBy: actorId(actor),
                    role: actor.role,
                    createdAt: new Date()
                }
            }
        },
        { new: true }
    );
    if (!allocation) throw serviceError('The trip vehicle allocation is no longer active. Contact operations support.', 409);
    return allocation;
}

async function restoreAllocation(allocationId, status, actor, remarks) {
    const restored = await VehicleAllocation.updateOne(
        { _id: allocationId, allocationStatus: status },
        {
            $set: { allocationStatus: 'Allocated' },
            $push: {
                statusHistory: {
                    status: 'Allocated',
                    remarks,
                    updatedBy: actorId(actor),
                    role: actor.role,
                    createdAt: new Date()
                }
            }
        }
    );
    return restored.modifiedCount === 1;
    if (!restored.modifiedCount) throw serviceError('Vehicle allocation could not be restored. Contact support.', 500);
}

async function rollbackTripState(tripId, intermediateStatus, priorStatus, actor, remarks) {
    const restored = await Trip.updateOne(
        { _id: tripId, tripStatus: intermediateStatus },
        {
            $set: { tripStatus: priorStatus, statusUpdatedAt: new Date() },
            $push: { statusHistory: addHistory(priorStatus, actor, remarks) }
        }
    );
}

exports.listTrips = (query, actor) => listTrips(query, actor);
exports.listAssignments = (query, actor) => listTrips(query, actor, ['Scheduled', 'Assigned']);
exports.listActiveTrips = (query, actor) => listTrips(query, actor, ['InProgress', 'Delayed']);
exports.listTripHistory = async (query, actor) => {
    if (query.status) {
        if (!['Completed', 'Cancelled'].includes(query.status)) {
            throw serviceError('Trip history can be filtered only to Completed or Cancelled trips.', 400);
        }
        return listTrips(query, actor, query.status);
    }
    const filter = queryFilter(query, actor);
    filter.tripStatus = { $in: ['Completed', 'Cancelled'] };
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
        populateTrip(Trip.find(filter).sort({ scheduledAt: -1, _id: -1 }).skip(skip).limit(query.limit)).lean(),
        Trip.countDocuments(filter)
    ]);
    return {
        data,
        pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }
    };
};

exports.listAllocationOptions = async () => {
    const allocations = await VehicleAllocation.find({ allocationStatus: 'Allocated' })
        .sort({ plannedPickupDate: 1, _id: 1 })
        .populate('bookingId', 'bookingNumber bookingStatus pickupAddress deliveryAddress cargo schedule')
        .populate('vehicleId', 'registrationNumber vehicleType manufacturer model vehicleStatus')
        .lean();
    const allocationIds = allocations.map((allocation) => allocation._id);
    const trips = await Trip.find({ allocationId: { $in: allocationIds } }).select('allocationId').lean();
    const scheduled = new Set(trips.map((trip) => String(trip.allocationId)));
    return allocations.filter((allocation) =>
        allocation.bookingId?.bookingStatus === 'confirmed'
        && !scheduled.has(String(allocation._id))
    );
};

exports.createTrip = async (data, actor) => {
    if (!mongoose.isValidObjectId(data.allocationId)) throw serviceError('Invalid allocation ID.', 400);
    const allocation = await VehicleAllocation.findOne({
        _id: data.allocationId,
        allocationStatus: 'Allocated'
    }).populate('bookingId').lean();
    if (!allocation) throw serviceError('An active vehicle allocation is required to schedule a trip.', 409);
    if (!allocation.bookingId || allocation.bookingId.bookingStatus !== 'confirmed') {
        throw serviceError('Only allocations for confirmed bookings can be scheduled.', 409);
    }
    const vehicle = await FleetVehicle.findOne({
        _id: allocation.vehicleId,
        isDeleted: false,
        vehicleStatus: 'Allocated'
    }).lean();
    if (!vehicle) throw serviceError('Allocated vehicle is no longer available for trip scheduling.', 409);

    try {
        const trip = await Trip.create({
            tripNumber: await nextTripNumber(),
            allocationId: allocation._id,
            bookingId: allocation.bookingId._id,
            vehicleId: allocation.vehicleId,
            scheduledAt: allocation.plannedPickupDate,
            expectedDeliveryAt: allocation.plannedDeliveryDate,
            notes: data.notes || '',
            tripStatus: 'Scheduled',
            statusHistory: [addHistory('Scheduled', actor, 'Trip scheduled from an active vehicle allocation.')]
        });
        return populateTrip(Trip.findById(trip._id)).lean();
    } catch (error) {
        if (error?.code === 11000) throw serviceError('This vehicle allocation already has a trip.', 409);
        throw error;
    }
};

exports.assignTrip = async (id, data, actor) => {
    const trip = await findTrip(id, actor);
    if (trip.tripStatus !== 'Scheduled') throw serviceError('Only a Scheduled trip can be assigned.', 409);
    await eligibleDriver(data.driverId, trip.scheduledAt, trip.expectedDeliveryAt);
    const otherActiveTrip = await Trip.exists({
        driverId: data.driverId,
        _id: { $ne: trip._id },
        tripStatus: { $in: ACTIVE_TRIP_STATUSES }
    });
    if (otherActiveTrip) throw serviceError('Driver already has an active or scheduled trip.', 409);

    const claimedDriver = await Driver.findOneAndUpdate(
        { _id: data.driverId, driverStatus: 'Available', isDeleted: false },
        {
            $set: { driverStatus: 'Assigned', statusUpdatedAt: new Date() },
            $push: {
                statusHistory: {
                    status: 'Assigned',
                    remarks: `Assigned to trip ${trip.tripNumber}.`,
                    updatedBy: actorId(actor),
                    role: actor.role,
                    createdAt: new Date()
                }
            }
        },
        { new: true }
    );
    if (!claimedDriver) throw serviceError('Driver availability changed. Refresh and retry.', 409);

    try {
        const updated = await Trip.findOneAndUpdate(
            { _id: trip._id, tripStatus: 'Scheduled', driverId: null },
            {
                $set: {
                    driverId: claimedDriver._id,
                    tripStatus: 'Assigned',
                    statusUpdatedAt: new Date(),
                    ...(data.routeId !== undefined ? { routeId: data.routeId } : {}),
                    ...(data.notes !== undefined ? { notes: data.notes } : {})
                },
                $push: { statusHistory: addHistory('Assigned', actor, `Driver ${claimedDriver.driverCode} assigned.`) }
            },
            { new: true, runValidators: true }
        );
        if (!updated) throw serviceError('Trip changed in another request. Refresh and retry.', 409);
        return populateTrip(Trip.findById(updated._id)).lean();
    } catch (error) {
        const restored = await Driver.findOneAndUpdate(
            { _id: claimedDriver._id, driverStatus: 'Assigned' },
            {
                $set: { driverStatus: 'Available', statusUpdatedAt: new Date() },
                $push: { statusHistory: {
                    status: 'Available',
                    remarks: `Trip assignment ${trip.tripNumber} was not completed.`,
                    updatedBy: actorId(actor),
                    role: actor.role,
                    createdAt: new Date()
                } }
            }
        );
        if (!restored) throw serviceError('Trip assignment failed and driver availability could not be restored. Contact support.', 500);
        throw error;
    }
};

exports.updateTripStatus = async (id, { tripStatus, remarks = '' }, actor) => {
    const trip = await findTrip(id, actor);
    if (actor.role === 'driver' && String(trip.driverId?._id) !== String(actor.id)) {
        throw serviceError('Trip not found.', 404);
    }

    if (tripStatus === 'InProgress') {
        if (trip.tripStatus === 'Delayed') {
            await transitionTrip(trip, ['Delayed'], 'InProgress', actor, remarks || 'Trip resumed.', { delayReason: '' });
            return populateTrip(Trip.findById(trip._id)).lean();
        }
        if (trip.tripStatus !== 'Assigned') throw serviceError('Only an assigned trip can be started.', 409);
        if (actor.role === 'driver' && String(trip.driverId?._id) !== String(actor.id)) {
            throw serviceError('Only the assigned driver can start this trip.', 403);
        }

        await transitionTrip(trip, ['Assigned'], 'Starting', actor, remarks || 'Trip departure started.');
        let vehicleClaimed = false;
        let driverClaimed = false;
        try {
            await setVehicleStatus(trip.vehicleId._id, 'Allocated', 'OnTrip', actor, `Trip ${trip.tripNumber} started.`);
            vehicleClaimed = true;
            await setDriverStatus(trip.driverId._id, 'Assigned', 'OnTrip', actor, `Trip ${trip.tripNumber} started.`);
            driverClaimed = true;
            const startedAt = new Date();
            await transitionTrip(
                await Trip.findById(trip._id),
                ['Starting'],
                'InProgress',
                actor,
                remarks || 'Trip started.',
                { actualStartedAt: startedAt }
            );
        } catch (error) {
            let rollbackFailed = false;
            if (driverClaimed) {
                try {
                    await setDriverStatus(trip.driverId._id, 'OnTrip', 'Assigned', actor, `Trip ${trip.tripNumber} could not start.`);
                } catch (_rollbackError) {
                    rollbackFailed = true;
                }
            }
            if (vehicleClaimed) {
                try {
                    await setVehicleStatus(trip.vehicleId._id, 'OnTrip', 'Allocated', actor, `Trip ${trip.tripNumber} could not start.`);
                } catch (_rollbackError) {
                    rollbackFailed = true;
                }
            }
            if (!await rollbackTripState(trip._id, 'Starting', 'Assigned', actor, 'Trip start was rolled back.')) {
                rollbackFailed = true;
            }
            if (rollbackFailed) throw serviceError('Trip start failed and operational status could not be fully restored. Contact support.', 500);
            throw error;
        }
        return populateTrip(Trip.findById(trip._id)).lean();
    }

    if (tripStatus === 'Delayed') {
        if (!['InProgress'].includes(trip.tripStatus)) throw serviceError('Only an in-progress trip can be delayed.', 409);
        await transitionTrip(trip, ['InProgress'], 'Delayed', actor, remarks, { delayReason: remarks });
        return populateTrip(Trip.findById(trip._id)).lean();
    }

    if (tripStatus === 'Completed') {
        if (!['InProgress', 'Delayed'].includes(trip.tripStatus)) throw serviceError('Only an active trip can be completed.', 409);
        const priorStatus = trip.tripStatus;
        await transitionTrip(trip, [priorStatus], 'Completing', actor, remarks || 'Delivery completed.');
        let vehicleReleased = false;
        let driverReleased = false;
        let allocationReleased = false;
        try {
            await setVehicleStatus(trip.vehicleId._id, 'OnTrip', 'Available', actor, `Trip ${trip.tripNumber} completed.`);
            vehicleReleased = true;
            await setDriverStatus(trip.driverId._id, 'OnTrip', 'Available', actor, `Trip ${trip.tripNumber} completed.`);
            driverReleased = true;
            await releaseAllocation(trip, actor, 'Released', `Trip ${trip.tripNumber} completed.`);
            allocationReleased = true;
            await transitionTrip(
                await Trip.findById(trip._id),
                ['Completing'],
                'Completed',
                actor,
                remarks || 'Delivery completed.',
                { actualCompletedAt: new Date() }
            );
        } catch (error) {
            let rollbackFailed = false;
            if (allocationReleased) {
                try {
                    await restoreAllocation(trip.allocationId, 'Released', actor, `Trip ${trip.tripNumber} completion was rolled back.`);
                } catch (_rollbackError) {
                    rollbackFailed = true;
                }
            }
            if (driverReleased) {
                try {
                    await setDriverStatus(trip.driverId._id, 'Available', 'OnTrip', actor, `Trip ${trip.tripNumber} completion was rolled back.`);
                } catch (_rollbackError) {
                    rollbackFailed = true;
                }
            }
            if (vehicleReleased) {
                try {
                    await setVehicleStatus(trip.vehicleId._id, 'Available', 'OnTrip', actor, `Trip ${trip.tripNumber} completion was rolled back.`);
                } catch (_rollbackError) {
                    rollbackFailed = true;
                }
            }
            if (!await rollbackTripState(trip._id, 'Completing', priorStatus, actor, 'Trip completion was rolled back.')) {
                rollbackFailed = true;
            }
            if (rollbackFailed) throw serviceError('Trip completion failed and operational status could not be fully restored. Contact support.', 500);
            throw error;
        }
        return populateTrip(Trip.findById(trip._id)).lean();
    }

    if (tripStatus === 'Cancelled') {
        if (!['Scheduled', 'Assigned'].includes(trip.tripStatus)) {
            throw serviceError('A trip can only be cancelled before departure.', 409);
        }
        if (actor.role === 'driver') throw serviceError('Only staff can cancel a trip.', 403);
        const priorStatus = trip.tripStatus;
        await transitionTrip(trip, [priorStatus], 'Cancelling', actor, remarks, { cancellationReason: remarks });
        let allocationCancelled = false;
        let vehicleReleased = false;
        let driverReleased = false;
        try {
            await releaseAllocation(trip, actor, 'Cancelled', remarks);
            allocationCancelled = true;
            await setVehicleStatus(trip.vehicleId._id, 'Allocated', 'Available', actor, `Trip ${trip.tripNumber} cancelled.`);
            vehicleReleased = true;
            if (trip.driverId?._id) {
                await setDriverStatus(trip.driverId._id, 'Assigned', 'Available', actor, `Trip ${trip.tripNumber} cancelled.`);
                driverReleased = true;
            }
            await transitionTrip(await Trip.findById(trip._id), ['Cancelling'], 'Cancelled', actor, remarks);
        } catch (error) {
            let rollbackFailed = false;
            if (driverReleased) {
                try {
                    await setDriverStatus(trip.driverId._id, 'Available', 'Assigned', actor, `Trip ${trip.tripNumber} cancellation was rolled back.`);
                } catch (_rollbackError) {
                    rollbackFailed = true;
                }
            }
            if (vehicleReleased) {
                try {
                    await setVehicleStatus(trip.vehicleId._id, 'Available', 'Allocated', actor, `Trip ${trip.tripNumber} cancellation was rolled back.`);
                } catch (_rollbackError) {
                    rollbackFailed = true;
                }
            }
            if (allocationCancelled) {
                try {
                    await restoreAllocation(trip.allocationId, 'Cancelled', actor, `Trip ${trip.tripNumber} cancellation was rolled back.`);
                } catch (_rollbackError) {
                    rollbackFailed = true;
                }
            }
            if (!await rollbackTripState(trip._id, 'Cancelling', priorStatus, actor, 'Trip cancellation was rolled back.')) {
                rollbackFailed = true;
            }
            if (rollbackFailed) throw serviceError('Trip cancellation failed and operational status could not be fully restored. Contact support.', 500);
            throw error;
        }
        return populateTrip(Trip.findById(trip._id)).lean();
    }

    throw serviceError('Trip status transition is not supported.', 400);
};

exports.listDriversForTrip = async (tripId) => {
    if (!mongoose.isValidObjectId(tripId)) throw serviceError('Invalid trip ID.', 400);
    const trip = await Trip.findById(tripId).select('tripStatus scheduledAt expectedDeliveryAt').lean();
    if (!trip) throw serviceError('Trip not found.', 404);
    if (trip.tripStatus !== 'Scheduled') throw serviceError('Drivers can only be assigned to Scheduled trips.', 409);
    const drivers = await Driver.find({ isDeleted: false, driverStatus: 'Available' })
        .select('_id driverCode personalInfo.fullName driverStatus')
        .sort({ 'personalInfo.fullName': 1, _id: 1 })
        .lean();
    const licenses = await DriverLicense.find({
        driverId: { $in: drivers.map((driver) => driver._id) },
        isDeleted: false,
        licenseType: { $in: ['HMV', 'Transport'] },
        status: { $ne: 'UnderReview' },
        expiryDate: { $gte: utcDay(trip.expectedDeliveryAt) },
        $or: [{ issueDate: null }, { issueDate: { $lte: utcDay(trip.scheduledAt) } }]
    }).select('driverId').lean();
    const eligibleIds = new Set(licenses.map((license) => String(license.driverId)));
    const assignedIds = await Trip.find({
        driverId: { $in: drivers.map((driver) => driver._id) },
        tripStatus: { $in: ACTIVE_TRIP_STATUSES }
    }).distinct('driverId');
    const unavailableIds = new Set(assignedIds.map(String));
    return drivers.filter((driver) => eligibleIds.has(String(driver._id)) && !unavailableIds.has(String(driver._id)));
};

exports.listRoutePlans = async (query, actor) => {
    const filter = {};
    const tripsFilter = actor.role === 'driver' ? { driverId: actor.id } : {};
    if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), 'i');
        filter.$or = [{ routeId: pattern }, { waypoints: pattern }, { notes: pattern }];
    }
    const trips = await Trip.find(tripsFilter).select('_id').lean();
    filter.tripId = { $in: trips.map((trip) => trip._id) };
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
        TripRoutePlan.find(filter).populate({
            path: 'tripId',
            select: 'tripNumber tripStatus scheduledAt expectedDeliveryAt bookingId vehicleId driverId',
            populate: [
                { path: 'bookingId', select: 'bookingNumber pickupAddress deliveryAddress' },
                { path: 'vehicleId', select: 'registrationNumber' },
                { path: 'driverId', select: 'driverCode personalInfo.fullName' }
            ]
        }).sort({ plannedStartDate: 1, _id: 1 }).skip(skip).limit(query.limit).lean(),
        TripRoutePlan.countDocuments(filter)
    ]);
    return { data, pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
};

exports.createRoutePlan = async (data, actor) => {
    const trip = await Trip.findById(data.tripId);
    if (!trip) throw serviceError('Trip not found.', 404);
    if (!['Scheduled', 'Assigned'].includes(trip.tripStatus)) {
        throw serviceError('Route plans can only be created before a trip starts.', 409);
    }
    if (data.plannedStartDate) {
        const plannedDay = utcDay(data.plannedStartDate);
        if (plannedDay < utcDay(trip.scheduledAt) || plannedDay > utcDay(trip.expectedDeliveryAt)) {
            throw serviceError('Planned route start must fall within the trip schedule dates.', 400);
        }
    }
    try {
        return await TripRoutePlan.create({
            ...data,
            createdBy: actorId(actor),
            updatedBy: actorId(actor)
        });
    } catch (error) {
        if (error?.code === 11000) throw serviceError('This trip already has a route plan.', 409);
        throw error;
    }
};

exports.updateRoutePlan = async (id, changes, actor) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid route plan ID.', 400);
    const plan = await TripRoutePlan.findById(id);
    if (!plan) throw serviceError('Route plan not found.', 404);
    const trip = await Trip.findById(plan.tripId);
    if (!trip) throw serviceError('Trip not found.', 404);
    if (!['Scheduled', 'Assigned'].includes(trip.tripStatus)) {
        throw serviceError('Route plans cannot be changed after a trip starts.', 409);
    }
    if (changes.plannedStartDate) {
        const plannedDay = utcDay(changes.plannedStartDate);
        if (plannedDay < utcDay(trip.scheduledAt) || plannedDay > utcDay(trip.expectedDeliveryAt)) {
            throw serviceError('Planned route start must fall within the trip schedule dates.', 400);
        }
    }
    for (const [key, value] of Object.entries(changes)) {
        if (key !== 'tripId') plan.set(key, value);
    }
    plan.updatedBy = actorId(actor);
    await plan.save();
    return plan.toObject();
};

exports.deleteRoutePlan = async (id) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid route plan ID.', 400);
    const plan = await TripRoutePlan.findById(id);
    if (!plan) throw serviceError('Route plan not found.', 404);
    const trip = await Trip.findById(plan.tripId);
    if (!trip) throw serviceError('Trip not found.', 404);
    if (!['Scheduled', 'Assigned'].includes(trip.tripStatus)) {
        throw serviceError('A route plan cannot be removed after a trip starts.', 409);
    }
    await plan.deleteOne();
    return { message: 'Trip route plan deleted.' };
};

exports.getTripMetrics = async (query = {}) => {
    const [summary = {}] = await Trip.aggregate([
        { $match: { tripStatus: { $in: PUBLIC_TRIP_STATUSES }, ...dateRange(query, 'scheduledAt') } },
        { $group: {
            _id: null,
            total: { $sum: 1 },
            scheduled: { $sum: { $cond: [{ $eq: ['$tripStatus', 'Scheduled'] }, 1, 0] } },
            assigned: { $sum: { $cond: [{ $eq: ['$tripStatus', 'Assigned'] }, 1, 0] } },
            inProgress: { $sum: { $cond: [{ $eq: ['$tripStatus', 'InProgress'] }, 1, 0] } },
            delayed: { $sum: { $cond: [{ $eq: ['$tripStatus', 'Delayed'] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ['$tripStatus', 'Completed'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$tripStatus', 'Cancelled'] }, 1, 0] } }
        } },
        { $project: { _id: 0, total: 1, scheduled: 1, assigned: 1, inProgress: 1, delayed: 1, completed: 1, cancelled: 1 } }
    ]);
    return summary.total ? summary : {
        total: 0, scheduled: 0, assigned: 0, inProgress: 0, delayed: 0, completed: 0, cancelled: 0
    };
};
