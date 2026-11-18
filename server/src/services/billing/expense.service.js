const mongoose = require('mongoose');
const Expense = require('../../models/billing/expense.model');
const FleetVehicle = require('../../models/fleet/vehicle.model');
const { Trip } = require('../../models/trips/trip.model');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function dateFilter(query) {
    const incurredAt = {};
    if (query.startDate) incurredAt.$gte = new Date(`${query.startDate}T00:00:00.000Z`);
    if (query.endDate) incurredAt.$lte = new Date(`${query.endDate}T23:59:59.999Z`);
    return Object.keys(incurredAt).length ? { incurredAt } : {};
}

function expenseFilter(query) {
    const filter = { ...dateFilter(query) };
    if (query.category) filter.category = query.category;
    if (query.vehicleId) filter.vehicleId = query.vehicleId;
    if (query.tripId) filter.tripId = query.tripId;
    if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), 'i');
        filter.$or = [{ description: pattern }, { vendor: pattern }, { reference: pattern }, { notes: pattern }];
    }
    return filter;
}

function populateExpense(query) {
    return query
        .populate('vehicleId', 'registrationNumber vehicleType')
        .populate('tripId', 'tripNumber tripStatus');
}

function publicExpense(expense) {
    if (!expense) return expense;
    const data = typeof expense.toObject === 'function' ? expense.toObject() : expense;
    return { ...data, amount: data.amountPaise / 100 };
}

function toPaise(amount) {
    const amountPaise = Math.round(amount * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 1) {
        throw serviceError('Expense amount is outside the supported range.', 400);
    }
    return amountPaise;
}

function sameRequest(expense, data, actor, vehicleId, tripId, amountPaise) {
    return expense.category === data.category
        && expense.description === data.description
        && expense.amountPaise === amountPaise
        && new Date(expense.incurredAt).getTime() === new Date(data.incurredAt).getTime()
        && String(expense.vehicleId || '') === String(vehicleId || '')
        && String(expense.tripId || '') === String(tripId || '')
        && expense.vendor === (data.vendor || '')
        && expense.reference === (data.reference || '')
        && expense.notes === (data.notes || '')
        && expense.createdBy === String(actor.id);
}

exports.createExpense = async (data, actor) => {
    const createdBy = String(actor.id);
    const existing = await Expense.findOne({ idempotencyKey: data.idempotencyKey, createdBy });

    let vehicleId = data.vehicleId || null;
    let tripId = data.tripId || null;
    if (tripId && !mongoose.isValidObjectId(tripId)) throw serviceError('Invalid trip ID.', 400);
    if (vehicleId && !mongoose.isValidObjectId(vehicleId)) throw serviceError('Invalid vehicle ID.', 400);

    if (tripId) {
        const trip = await Trip.findById(tripId).select('vehicleId').lean();
        if (!trip) throw serviceError('Trip not found.', 404);
        const tripVehicleId = String(trip.vehicleId);
        if (vehicleId && String(vehicleId) !== tripVehicleId) {
            throw serviceError('Selected vehicle does not match the linked trip.', 400);
        }
        vehicleId = trip.vehicleId;
    }
    if (vehicleId) {
        const vehicle = await FleetVehicle.findOne({ _id: vehicleId, isDeleted: false }).select('_id').lean();
        if (!vehicle) throw serviceError('Active vehicle not found.', 404);
    }

    const amountPaise = toPaise(data.amount);
    if (existing) {
        if (!sameRequest(existing, data, actor, vehicleId, tripId, amountPaise)) {
            throw serviceError('This expense idempotency key was already used with different details.', 409);
        }
        return { expense: publicExpense(await populateExpense(Expense.findById(existing._id))), created: false };
    }

    try {
        const expense = await Expense.create({
            idempotencyKey: data.idempotencyKey,
            category: data.category,
            description: data.description,
            amountPaise,
            incurredAt: data.incurredAt,
            vehicleId,
            tripId,
            vendor: data.vendor || '',
            reference: data.reference || '',
            notes: data.notes || '',
            createdBy,
            createdByRole: actor.role
        });
        return { expense: publicExpense(await populateExpense(Expense.findById(expense._id))), created: true };
    } catch (error) {
        if (error?.code !== 11000) throw error;
        const duplicate = await Expense.findOne({ idempotencyKey: data.idempotencyKey, createdBy });
        if (!duplicate || !sameRequest(duplicate, data, actor, vehicleId, tripId, amountPaise)) {
            throw serviceError('This expense idempotency key was already used with different details.', 409);
        }
        return { expense: publicExpense(await populateExpense(Expense.findById(duplicate._id))), created: false };
    }
};

exports.listExpenses = async (query) => {
    const filter = expenseFilter(query);
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
        populateExpense(Expense.find(filter).sort({ incurredAt: -1, _id: -1 }).skip(skip).limit(query.limit)).lean(),
        Expense.countDocuments(filter)
    ]);
    return {
        data: data.map(publicExpense),
        pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }
    };
};

exports.getExpenseSummary = async (query) => {
    const match = expenseFilter(query);
    if (query.vehicleId) match.vehicleId = new mongoose.Types.ObjectId(query.vehicleId);
    if (query.tripId) match.tripId = new mongoose.Types.ObjectId(query.tripId);
    const [summary = {}] = await Expense.aggregate([
        { $match: match },
        { $group: {
            _id: null,
            entryCount: { $sum: 1 },
            totalCostPaise: { $sum: '$amountPaise' }
        } }
    ]);
    const byCategory = await Expense.aggregate([
        { $match: match },
        { $group: {
            _id: '$category',
            entryCount: { $sum: 1 },
            totalCostPaise: { $sum: '$amountPaise' }
        } },
        { $sort: { totalCostPaise: -1, _id: 1 } }
    ]);
    const byVehicle = await Expense.aggregate([
        { $match: { ...match, vehicleId: { $ne: null } } },
        { $group: {
            _id: '$vehicleId',
            entryCount: { $sum: 1 },
            totalCostPaise: { $sum: '$amountPaise' }
        } },
        { $sort: { totalCostPaise: -1, _id: 1 } }
    ]);
    const vehicleIds = byVehicle.map((item) => item._id);
    const vehicles = await FleetVehicle.find({ _id: { $in: vehicleIds } }).select('registrationNumber').lean();
    const vehicleNames = new Map(vehicles.map((vehicle) => [String(vehicle._id), vehicle.registrationNumber]));
    return {
        period: { startDate: query.startDate || null, endDate: query.endDate || null },
        entryCount: summary.entryCount || 0,
        totalCostPaise: summary.totalCostPaise || 0,
        currency: 'INR',
        byCategory: byCategory.map((item) => ({
            category: item._id,
            entryCount: item.entryCount,
            totalCostPaise: item.totalCostPaise
        })),
        byVehicle: byVehicle.map((item) => ({
            vehicleId: String(item._id),
            vehicle: vehicleNames.get(String(item._id)) || 'Vehicle unavailable',
            entryCount: item.entryCount,
            totalCostPaise: item.totalCostPaise
        }))
    };
};
