const mongoose = require('mongoose');
const FleetVehicle = require('../../models/fleet/vehicle.model');
const FuelEntry = require('../../models/fuel/fuel-entry.model');
const { Trip } = require('../../models/trips/trip.model');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function unitForFuelType(fuelType) {
    const units = {
        Diesel: 'Litre',
        Petrol: 'Litre',
        Hybrid: 'Litre',
        CNG: 'Kg',
        LNG: 'Kg',
        Electric: 'KWh'
    };
    return units[fuelType] || null;
}

function toMilli(quantity) {
    const value = Math.round(quantity * 1000);
    if (!Number.isSafeInteger(value) || value < 1) throw serviceError('Fuel quantity is outside the supported range.', 400);
    return value;
}

function toPaise(amount) {
    const value = Math.round(amount * 100);
    if (!Number.isSafeInteger(value) || value < 1) throw serviceError('Fuel price is outside the supported range.', 400);
    return value;
}

function roundedProductRatio(left, right, denominator) {
    const result = Number((BigInt(left) * BigInt(right) + BigInt(denominator) / 2n) / BigInt(denominator));
    if (!Number.isSafeInteger(result)) throw serviceError('Fuel cost is outside the supported range.', 400);
    return result;
}

function dateFilter(query, field = 'filledAt') {
    const range = {};
    if (query.startDate) range.$gte = new Date(`${query.startDate}T00:00:00.000Z`);
    if (query.endDate) range.$lte = new Date(`${query.endDate}T23:59:59.999Z`);
    return Object.keys(range).length ? { [field]: range } : {};
}

function entryFilter(query) {
    const filter = { ...dateFilter(query) };
    if (query.vehicleId) filter.vehicleId = query.vehicleId;
    if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), 'i');
        filter.$or = [
            { vendor: pattern },
            { receiptNumber: pattern },
            { notes: pattern },
            { unit: pattern }
        ];
    }
    return filter;
}

function publicEntry(entry) {
    return {
        ...entry,
        quantity: entry.quantityMilli / 1000,
        pricePerUnit: entry.pricePerUnitPaise / 100,
        totalCost: entry.totalCostPaise / 100,
        mileageKmPerUnit: entry.mileageMilliPerUnit == null ? null : entry.mileageMilliPerUnit / 1000
    };
}

function sameRequest(entry, data, actor) {
    return String(entry.vehicleId) === data.vehicleId
        && String(entry.tripId || '') === (data.tripId || '')
        && new Date(entry.filledAt).getTime() === new Date(data.filledAt).getTime()
        && entry.quantityMilli === toMilli(data.quantity)
        && entry.unit === data.unit
        && entry.pricePerUnitPaise === toPaise(data.pricePerUnit)
        && entry.odometerKm === data.odometerKm
        && entry.isFullTank === Boolean(data.isFullTank)
        && entry.vendor === data.vendor
        && entry.receiptNumber === data.receiptNumber
        && entry.notes === data.notes
        && entry.createdBy === String(actor.id);
}

function populateEntry(query) {
    return query
        .populate('vehicleId', 'registrationNumber vehicleType fuelType')
        .populate('tripId', 'tripNumber tripStatus');
}

exports.listVehicleOptions = async (query) => {
    const filter = { isDeleted: false };
    if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), 'i');
        filter.$or = [
            { registrationNumber: pattern },
            { manufacturer: pattern },
            { model: pattern }
        ];
    }
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
        FleetVehicle.find(filter)
            .select('registrationNumber vehicleType manufacturer model fuelType lastFuelOdometerKm vehicleStatus')
            .sort({ registrationNumber: 1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        FleetVehicle.countDocuments(filter)
    ]);
    return { data, pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
};

exports.listTripOptions = async (vehicleId) => {
    if (!mongoose.isValidObjectId(vehicleId)) throw serviceError('Invalid vehicle ID.', 400);
    const trips = await Trip.find({ vehicleId, tripStatus: { $ne: 'Cancelled' } })
        .select('tripNumber tripStatus scheduledAt expectedDeliveryAt')
        .sort({ scheduledAt: -1, _id: -1 })
        .limit(100)
        .lean();
    return trips;
};

exports.createEntry = async (data, actor) => {
    const prior = await FuelEntry.findOne({ idempotencyKey: data.idempotencyKey }).lean();
    if (prior) {
        if (sameRequest(prior, data, actor)) return { entry: publicEntry(prior), created: false };
        throw serviceError('This fuel-entry idempotency key was already used with different details.', 409);
    }

    const vehicle = await FleetVehicle.findOne({ _id: data.vehicleId, isDeleted: false }).lean();
    if (!vehicle) throw serviceError('Vehicle not found.', 404);
    const requiredUnit = unitForFuelType(vehicle.fuelType);
    if (requiredUnit && data.unit !== requiredUnit) {
        throw serviceError(`${vehicle.fuelType} vehicles must use ${requiredUnit} for fuel quantity.`, 400);
    }
    if (data.tripId) {
        const trip = await Trip.findOne({ _id: data.tripId, vehicleId: data.vehicleId }).select('tripStatus').lean();
        if (!trip || trip.tripStatus === 'Cancelled') {
            throw serviceError('The selected trip is not available for this vehicle.', 409);
        }
    }

    const quantityMilli = toMilli(data.quantity);
    const pricePerUnitPaise = toPaise(data.pricePerUnit);
    const totalCostPaise = roundedProductRatio(quantityMilli, pricePerUnitPaise, 1000);
    const record = {
        ...data,
        idempotencyKey: data.idempotencyKey,
        vehicleId: data.vehicleId,
        tripId: data.tripId || null,
        filledAt: new Date(data.filledAt),
        quantityMilli,
        pricePerUnitPaise,
        totalCostPaise,
        createdBy: String(actor.id),
        createdByRole: actor.role
    };
    delete record.quantity;
    delete record.pricePerUnit;

    let entry;
    try {
        entry = await FuelEntry.create(record);
    } catch (error) {
        if (error.code === 11000) {
            const duplicate = await FuelEntry.findOne({ idempotencyKey: data.idempotencyKey }).lean();
            if (duplicate && sameRequest(duplicate, data, actor)) return { entry: publicEntry(duplicate), created: false };
            throw serviceError('This fuel-entry idempotency key was already used.', 409);
        }
        throw error;
    }

    let committed = false;
    try {
        const updatedVehicle = await FleetVehicle.findOneAndUpdate({
            _id: data.vehicleId,
            isDeleted: false,
            $and: [
                { $or: [{ lastFuelOdometerKm: null }, { lastFuelOdometerKm: { $lt: data.odometerKm } }] },
                { $or: [{ lastFuelRecordedAt: null }, { lastFuelRecordedAt: { $lte: record.filledAt } }] }
            ]
        }, {
            $set: { lastFuelOdometerKm: data.odometerKm, lastFuelRecordedAt: record.filledAt }
        }, { new: true });
        if (!updatedVehicle) {
            throw serviceError('Odometer and fill time must advance beyond the vehicle’s latest fuel record.', 409);
        }
        committed = true;

        if (record.isFullTank) {
            const previousFullTank = await FuelEntry.findOne({
                vehicleId: data.vehicleId,
                isFullTank: true,
                odometerKm: { $lt: data.odometerKm },
                _id: { $ne: entry._id }
            }).sort({ odometerKm: -1, _id: -1 }).lean();
            if (previousFullTank) {
                const [fuelSincePreviousFull] = await FuelEntry.aggregate([
                    {
                        $match: {
                            vehicleId: entry.vehicleId,
                            odometerKm: { $gt: previousFullTank.odometerKm, $lte: data.odometerKm }
                        }
                    },
                    { $group: { _id: null, quantityMilli: { $sum: '$quantityMilli' } } }
                ]);
                const distanceKm = data.odometerKm - previousFullTank.odometerKm;
                const fuelMilli = fuelSincePreviousFull?.quantityMilli || 0;
                if (fuelMilli > 0) {
                    entry.mileageDistanceKm = distanceKm;
                    entry.mileageFuelQuantityMilli = fuelMilli;
                    entry.mileageMilliPerUnit = roundedProductRatio(distanceKm, 1000000, fuelMilli);
                    await entry.save();
                }
            }
        }
        return { entry: publicEntry(entry.toObject()), created: true };
    } catch (error) {
        if (!committed) await FuelEntry.deleteOne({ _id: entry._id });
        throw error;
    }
};

exports.listEntries = async (query) => {
    const filter = entryFilter(query);
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
        populateEntry(FuelEntry.find(filter).sort({ filledAt: -1, _id: -1 }).skip(skip).limit(query.limit)).lean(),
        FuelEntry.countDocuments(filter)
    ]);
    return {
        data: data.map(publicEntry),
        pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }
    };
};

exports.getSummary = async (query) => {
    const match = { ...dateFilter(query) };
    if (query.vehicleId) match.vehicleId = new mongoose.Types.ObjectId(query.vehicleId);
    const [groups, mileageGroups, entryCount] = await Promise.all([
        FuelEntry.aggregate([
            { $match: match },
            {
                $group: {
                    _id: { vehicleId: '$vehicleId', unit: '$unit' },
                    entryCount: { $sum: 1 },
                    quantityMilli: { $sum: '$quantityMilli' },
                    totalCostPaise: { $sum: '$totalCostPaise' }
                }
            },
            { $sort: { totalCostPaise: -1 } }
        ]),
        FuelEntry.aggregate([
            { $match: { ...match, mileageMilliPerUnit: { $ne: null } } },
            {
                $group: {
                    _id: { vehicleId: '$vehicleId', unit: '$unit' },
                    intervalCount: { $sum: 1 },
                    distanceKm: { $sum: '$mileageDistanceKm' },
                    fuelQuantityMilli: { $sum: '$mileageFuelQuantityMilli' }
                }
            }
        ]),
        FuelEntry.countDocuments(match)
    ]);
    const vehicleIds = [...new Set([...groups, ...mileageGroups].map((group) => String(group._id.vehicleId)))];
    const vehicles = await FleetVehicle.find({ _id: { $in: vehicleIds } })
        .select('registrationNumber vehicleType fuelType')
        .lean();
    const vehicleById = new Map(vehicles.map((vehicle) => [String(vehicle._id), vehicle]));
    const byVehicle = groups.map((group) => ({
        vehicle: vehicleById.get(String(group._id.vehicleId)) || null,
        unit: group._id.unit,
        entryCount: group.entryCount,
        quantity: group.quantityMilli / 1000,
        totalCostPaise: group.totalCostPaise
    }));
    const mileage = mileageGroups.map((group) => ({
        vehicle: vehicleById.get(String(group._id.vehicleId)) || null,
        unit: group._id.unit,
        intervalCount: group.intervalCount,
        distanceKm: group.distanceKm,
        fuelQuantity: group.fuelQuantityMilli / 1000,
        mileageKmPerUnit: group.fuelQuantityMilli > 0
            ? Math.round((group.distanceKm * 1000 / group.fuelQuantityMilli) * 1000) / 1000
            : null
    }));
    return {
        entryCount,
        totalCostPaise: groups.reduce((sum, group) => sum + group.totalCostPaise, 0),
        quantityByUnit: [...new Set(groups.map((group) => group._id.unit))].map((unit) => ({
            unit,
            quantity: groups.filter((group) => group._id.unit === unit)
                .reduce((sum, group) => sum + group.quantityMilli, 0) / 1000
        })),
        byVehicle,
        mileage
    };
};
