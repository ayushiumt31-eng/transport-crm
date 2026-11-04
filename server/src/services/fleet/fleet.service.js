const mongoose = require('mongoose');
const Booking = require('../../models/bookings/booking.model').Booking;
const FleetVehicle = require('../../models/fleet/vehicle.model');
const { VehicleAllocation, VehicleAllocationCounter } = require('../../models/fleet/vehicle-allocation.model');
const { Trip } = require('../../models/trips/trip.model');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const ALLOCATABLE_BOOKING_STATUSES = ['confirmed'];

async function nextAllocationNumber() {
    const year = new Date().getUTCFullYear();
    const counterId = `allocation-${year}`;
    let counter;
    try {
        counter = await VehicleAllocationCounter.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    } catch (error) {
        if (error.code !== 11000) throw error;
        counter = await VehicleAllocationCounter.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true }
        );
    }
    return `AL-${year}-${String(counter.value).padStart(6, '0')}`;
}

function capacityKg(vehicle) {
    if (vehicle.capacity.unit === 'Ton') return vehicle.capacity.value * 1000;
    if (vehicle.capacity.unit === 'KG') return vehicle.capacity.value;
    return null;
}

function vehicleMatchesBooking(vehicle, booking) {
    const compatibleTypes = {
        'Open Body': ['Truck', 'Pickup', 'Tempo', 'Van', 'Other'],
        Container: ['Container', 'Trailer'],
        Trailer: ['Trailer'],
        'Heavy Duty': ['Truck', 'Trailer', 'Tanker'],
        'Temperature Controlled': ['Container', 'Truck', 'Van']
    };
    const capacity = capacityKg(vehicle);
    return compatibleTypes[booking.vehicleRequirement.vehicleType]?.includes(vehicle.vehicleType)
        && capacity !== null
        && capacity >= booking.cargo.weightKg
        && capacity >= booking.vehicleRequirement.minCapacityKg;
}

async function listVehicles(query) {
    const filter = { isDeleted: false };
    if (query.vehicleStatus) filter.vehicleStatus = query.vehicleStatus;
    if (query.search) {
        const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(escaped, 'i');
        filter.$or = [
            { registrationNumber: pattern },
            { manufacturer: pattern },
            { model: pattern },
            { vehicleType: pattern }
        ];
    }
    const skip = (query.page - 1) * query.limit;
    const [data, totalVehicles] = await Promise.all([
        FleetVehicle.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(query.limit).lean(),
        FleetVehicle.countDocuments(filter)
    ]);
    return {
        data,
        pagination: {
            totalVehicles,
            currentPage: query.page,
            totalPages: Math.ceil(totalVehicles / query.limit),
            pageLimit: query.limit
        }
    };
}

exports.listVehicles = listVehicles;

exports.createVehicle = async (data, actor) => {
    try {
        const vehicleData = { ...data };
        if (vehicleData.chassisNumber === '') delete vehicleData.chassisNumber;
        if (vehicleData.engineNumber === '') delete vehicleData.engineNumber;
        return (await FleetVehicle.create({
            ...vehicleData,
            statusHistory: [{
                status: 'Available',
                remarks: 'Vehicle registered.',
                updatedBy: actor.id,
                role: actor.role,
                createdAt: new Date()
            }]
        })).toObject();
    } catch (error) {
        if (error.code === 11000) {
            const duplicateField = Object.keys(error.keyPattern || {})[0];
            const labels = {
                registrationNumber: 'Registration number',
                chassisNumber: 'Chassis number',
                engineNumber: 'Engine number'
            };
            throw serviceError(`${labels[duplicateField] || 'Vehicle identifier'} is already registered.`, 409);
        }
        throw error;
    }
};

exports.updateVehicle = async (id, changes) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid vehicle ID.', 400);
    const vehicle = await FleetVehicle.findOne({ _id: id, isDeleted: false });
    if (!vehicle) throw serviceError('Vehicle not found.', 404);
    if (['Allocated', 'OnTrip'].includes(vehicle.vehicleStatus)) {
        throw serviceError('Release or complete the active allocation before editing this vehicle.', 409);
    }
    for (const [key, value] of Object.entries(changes)) {
        if (key === 'capacity' || key === 'documents') {
            vehicle.set(key, { ...vehicle.get(key).toObject(), ...value });
        } else if (['chassisNumber', 'engineNumber'].includes(key) && value === '') {
            vehicle.set(key, undefined);
        } else {
            vehicle.set(key, value);
        }
    }
    try {
        await vehicle.save();
    } catch (error) {
        if (error.code === 11000) throw serviceError('Registration, chassis, or engine number is already in use.', 409);
        throw error;
    }
    return vehicle.toObject();
};

exports.updateVehicleStatus = async (id, { vehicleStatus, remarks = '' }, actor) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid vehicle ID.', 400);
    const vehicle = await FleetVehicle.findOne({ _id: id, isDeleted: false });
    if (!vehicle) throw serviceError('Vehicle not found.', 404);
    if (['Allocated', 'OnTrip'].includes(vehicle.vehicleStatus)) {
        throw serviceError('Release or complete the active allocation before changing vehicle status.', 409);
    }
    vehicle.vehicleStatus = vehicleStatus;
    vehicle.statusUpdatedAt = new Date();
    vehicle.statusHistory.push({
        status: vehicleStatus,
        remarks,
        updatedBy: actor.id,
        role: actor.role,
        createdAt: new Date()
    });
    await vehicle.save();
    return vehicle.toObject();
};

exports.deleteVehicle = async (id, actor) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid vehicle ID.', 400);
    const vehicle = await FleetVehicle.findOne({ _id: id, isDeleted: false });
    if (!vehicle) throw serviceError('Vehicle not found.', 404);
    if (['Allocated', 'OnTrip'].includes(vehicle.vehicleStatus)) {
        throw serviceError('Release the active allocation before deleting this vehicle.', 409);
    }
    vehicle.isDeleted = true;
    vehicle.vehicleStatus = 'Inactive';
    vehicle.statusUpdatedAt = new Date();
    vehicle.statusHistory.push({
        status: 'Inactive',
        remarks: 'Vehicle removed from the active fleet.',
        updatedBy: actor.id,
        role: actor.role,
        createdAt: new Date()
    });
    await vehicle.save();
    return { message: 'Vehicle deleted.' };
};

exports.getFleetDashboard = async () => {
    const [summaryResult, vehicleTypeBreakdown, activeAllocations] = await Promise.all([
        FleetVehicle.aggregate([
            { $match: { isDeleted: false } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    available: { $sum: { $cond: [{ $eq: ['$vehicleStatus', 'Available'] }, 1, 0] } },
                    allocated: { $sum: { $cond: [{ $eq: ['$vehicleStatus', 'Allocated'] }, 1, 0] } },
                    onTrip: { $sum: { $cond: [{ $eq: ['$vehicleStatus', 'OnTrip'] }, 1, 0] } },
                    underMaintenance: { $sum: { $cond: [{ $eq: ['$vehicleStatus', 'UnderMaintenance'] }, 1, 0] } },
                    inactive: { $sum: { $cond: [{ $eq: ['$vehicleStatus', 'Inactive'] }, 1, 0] } }
                }
            },
            { $project: { _id: 0, total: 1, available: 1, allocated: 1, onTrip: 1, underMaintenance: 1, inactive: 1 } }
        ]),
        FleetVehicle.aggregate([
            { $match: { isDeleted: false } },
            { $group: { _id: '$vehicleType', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } }
        ]),
        VehicleAllocation.countDocuments({ allocationStatus: 'Allocated' })
    ]);
    const summary = summaryResult[0] || {
        total: 0, available: 0, allocated: 0, onTrip: 0, underMaintenance: 0, inactive: 0
    };
    return { summary: { ...summary, activeAllocations }, vehicleTypeBreakdown };
};

exports.listAllocatableVehicles = async (bookingId) => {
    if (!mongoose.isValidObjectId(bookingId)) throw serviceError('Invalid booking ID.', 400);
    const booking = await Booking.findById(bookingId).lean();
    if (!booking) throw serviceError('Booking not found.', 404);
    if (!ALLOCATABLE_BOOKING_STATUSES.includes(booking.bookingStatus)) {
        throw serviceError('Only confirmed bookings can be allocated.', 409);
    }
    const vehicles = await FleetVehicle.find({ vehicleStatus: 'Available', isDeleted: false }).sort({ registrationNumber: 1 }).lean();
    return vehicles.filter((vehicle) => vehicleMatchesBooking(vehicle, booking));
};

exports.listAllocatableBookings = async () => {
    const bookings = await Booking.find({ bookingStatus: { $in: ALLOCATABLE_BOOKING_STATUSES } })
        .sort({ 'schedule.pickupDate': 1, _id: 1 })
        .lean();
    const allocations = await VehicleAllocation.find({
        bookingId: { $in: bookings.map((booking) => booking._id) },
        allocationStatus: 'Allocated'
    }).select('bookingId').lean();
    const allocatedIds = new Set(allocations.map((allocation) => String(allocation.bookingId)));
    return bookings.filter((booking) => !allocatedIds.has(String(booking._id)));
};

exports.listAllocations = async ({ page, limit, allocationStatus }) => {
    const filter = {};
    if (allocationStatus) filter.allocationStatus = allocationStatus;
    const skip = (page - 1) * limit;
    const [allocations, totalAllocations] = await Promise.all([
        VehicleAllocation.find(filter)
            .populate('bookingId', 'bookingNumber bookingStatus pickupAddress deliveryAddress cargo schedule')
            .populate('vehicleId', 'registrationNumber vehicleType manufacturer model capacity vehicleStatus')
            .sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
        VehicleAllocation.countDocuments(filter)
    ]);
    return {
        data: allocations,
        pagination: { totalAllocations, currentPage: page, totalPages: Math.ceil(totalAllocations / limit), pageLimit: limit }
    };
};

exports.createAllocation = async (data, actor) => {
    if (!mongoose.isValidObjectId(data.bookingId) || !mongoose.isValidObjectId(data.vehicleId)) {
        throw serviceError('Invalid booking or vehicle ID.', 400);
    }
    const [booking, vehicle] = await Promise.all([
        Booking.findById(data.bookingId).lean(),
        FleetVehicle.findOne({ _id: data.vehicleId, isDeleted: false }).lean()
    ]);
    if (!booking) throw serviceError('Booking not found.', 404);
    if (booking.bookingStatus !== 'confirmed') throw serviceError('Only confirmed bookings can be allocated.', 409);
    if (!vehicle) throw serviceError('Vehicle not found.', 404);
    if (vehicle.vehicleStatus !== 'Available') throw serviceError('Vehicle is not available for allocation.', 409);
    if (!vehicleMatchesBooking(vehicle, booking)) {
        throw serviceError('Vehicle type or capacity does not meet the booking requirement.', 409);
    }
    const utcDay = (date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    if (
        utcDay(data.plannedPickupDate) < utcDay(booking.schedule.pickupDate) ||
        utcDay(data.plannedDeliveryDate) > utcDay(booking.schedule.expectedDeliveryDate)
    ) {
        throw serviceError('Allocation dates must fit within the booking pickup and delivery schedule.', 400);
    }
    const bookingAlreadyAllocated = await VehicleAllocation.exists({
        bookingId: booking._id,
        allocationStatus: 'Allocated'
    });
    if (bookingAlreadyAllocated) throw serviceError('This booking already has an active vehicle allocation.', 409);
    const vehicleHasOverlap = await VehicleAllocation.exists({
        vehicleId: vehicle._id,
        allocationStatus: 'Allocated',
        plannedPickupDate: { $lt: data.plannedDeliveryDate },
        plannedDeliveryDate: { $gt: data.plannedPickupDate }
    });
    if (vehicleHasOverlap) throw serviceError('Vehicle already has an overlapping allocation.', 409);

    const claimedVehicle = await FleetVehicle.findOneAndUpdate(
        { _id: vehicle._id, vehicleStatus: 'Available', isDeleted: false },
        {
            $set: { vehicleStatus: 'Allocated', statusUpdatedAt: new Date() },
            $push: {
                statusHistory: {
                    status: 'Allocated',
                    remarks: data.remarks || 'Vehicle allocated to confirmed booking.',
                    updatedBy: actor.id,
                    role: actor.role,
                    createdAt: new Date()
                }
            }
        },
        { new: true }
    );
    if (!claimedVehicle) throw serviceError('Vehicle was allocated by another request. Refresh and retry.', 409);

    try {
        const allocationNumber = await nextAllocationNumber();
        const allocation = await VehicleAllocation.create({
            ...data,
            allocationNumber,
            statusHistory: [{
                status: 'Allocated',
                remarks: data.remarks || 'Vehicle allocated to confirmed booking.',
                updatedBy: actor.id,
                role: actor.role,
                createdAt: new Date()
            }]
        });
        return (await VehicleAllocation.findById(allocation._id)
            .populate('bookingId', 'bookingNumber bookingStatus pickupAddress deliveryAddress cargo schedule')
            .populate('vehicleId', 'registrationNumber vehicleType manufacturer model capacity vehicleStatus')
            .lean());
    } catch (error) {
        await FleetVehicle.updateOne(
            { _id: claimedVehicle._id, vehicleStatus: 'Allocated' },
            {
                $set: { vehicleStatus: 'Available', statusUpdatedAt: new Date() },
                $push: {
                    statusHistory: {
                        status: 'Available',
                        remarks: 'Allocation failed; vehicle reservation was released.',
                        updatedBy: actor.id,
                        role: actor.role,
                        createdAt: new Date()
                    }
                }
            }
        );
        if (error.code === 11000) throw serviceError('Booking or vehicle already has an active allocation.', 409);
        throw error;
    }
};

exports.updateAllocationStatus = async (id, { allocationStatus, remarks = '' }, actor) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid allocation ID.', 400);
    const allocation = await VehicleAllocation.findOne({ _id: id, allocationStatus: 'Allocated' });
    if (!allocation) throw serviceError('Active allocation not found.', 404);
    const activeTrip = await Trip.exists({
        allocationId: allocation._id,
        tripStatus: { $in: ['Scheduled', 'Assigned', 'Starting', 'InProgress', 'Delayed', 'Completing', 'Cancelling'] }
    });
    if (activeTrip) throw serviceError('Cancel or complete the linked trip before releasing this allocation.', 409);
    const updated = await VehicleAllocation.findOneAndUpdate(
        { _id: allocation._id, allocationStatus: 'Allocated' },
        {
            $set: { allocationStatus },
            $push: {
                statusHistory: {
                    status: allocationStatus,
                    remarks,
                    updatedBy: actor.id,
                    role: actor.role,
                    createdAt: new Date()
                }
            }
        },
        { new: true, runValidators: true }
    );
    if (!updated) throw serviceError('Allocation changed in another request. Refresh and retry.', 409);
    const releasedVehicle = await FleetVehicle.findOneAndUpdate(
        { _id: allocation.vehicleId, vehicleStatus: 'Allocated', isDeleted: false },
        {
            $set: { vehicleStatus: 'Available', statusUpdatedAt: new Date() },
            $push: {
                statusHistory: {
                    status: 'Available',
                    remarks: remarks || `Vehicle returned after allocation was ${allocationStatus.toLowerCase()}.`,
                    updatedBy: actor.id,
                    role: actor.role,
                    createdAt: new Date()
                }
            }
        },
        { new: true }
    );
    if (!releasedVehicle) {
        throw serviceError('Allocation status was saved, but the vehicle could not be returned to Available. Contact support.', 500);
    }
    return VehicleAllocation.findById(updated._id)
        .populate('bookingId', 'bookingNumber bookingStatus pickupAddress deliveryAddress cargo schedule')
        .populate('vehicleId', 'registrationNumber vehicleType manufacturer model capacity vehicleStatus')
        .lean();
};
