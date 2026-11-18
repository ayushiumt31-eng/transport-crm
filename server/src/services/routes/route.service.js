const mongoose = require('mongoose');
const { Route, RouteCounter } = require('../../models/routes/route.model');
const TripRoutePlan = require('../../models/trips/trip-route-plan.model');

const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function actorHistory(action, actor, remarks = '') {
    return {
        action,
        remarks,
        updatedBy: String(actor.id),
        role: actor.role,
        createdAt: new Date()
    };
}

function toPaise(amount) {
    const result = Math.round(amount * 100);
    if (!Number.isSafeInteger(result)) throw serviceError('Toll amount is outside the supported range.', 400);
    return result;
}

function tollAmountForVehicle(route, vehicleType) {
    return route.tolls.reduce((sum, toll) => {
        if (toll.vehicleTypes.length && !toll.vehicleTypes.includes(vehicleType)) return sum;
        return sum + toll.amountPaise;
    }, 0);
}

async function nextRouteNumber() {
    const year = new Date().getUTCFullYear();
    const counterId = `route-${year}`;
    let counter;
    try {
        counter = await RouteCounter.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    } catch (error) {
        if (error?.code !== 11000) throw error;
        counter = await RouteCounter.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 } },
            { new: true }
        );
    }
    return `RT-${year}-${String(counter.value).padStart(6, '0')}`;
}

function prepareTolls(tolls = []) {
    return tolls.map((toll) => ({
        ...toll,
        amountPaise: toPaise(toll.amount),
        vehicleTypes: toll.vehicleTypes || []
    })).map(({ amount, ...toll }) => toll);
}

function populateRoute(route) {
    return {
        ...route,
        tolls: (route.tolls || []).map((toll) => ({
            ...toll,
            amount: toll.amountPaise / 100
        }))
    };
}

exports.listRoutes = async (query) => {
    const filter = { isDeleted: false };
    if (query.onlyActive) filter.isActive = true;
    if (query.origin) filter.origin = new RegExp(`^${escapeRegex(query.origin)}$`, 'i');
    if (query.destination) filter.destination = new RegExp(`^${escapeRegex(query.destination)}$`, 'i');
    if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), 'i');
        filter.$or = [
            { routeNumber: pattern },
            { name: pattern },
            { origin: pattern },
            { destination: pattern },
            { waypoints: pattern },
            { 'tolls.name': pattern },
            { 'tolls.location': pattern }
        ];
    }
    const skip = (query.page - 1) * query.limit;
    const [routes, total] = await Promise.all([
        Route.find(filter).sort({ origin: 1, destination: 1, distanceKm: 1, _id: 1 }).skip(skip).limit(query.limit).lean(),
        Route.countDocuments(filter)
    ]);
    return {
        data: routes.map(populateRoute),
        pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) }
    };
};

exports.createRoute = async (data, actor) => {
    const route = await Route.create({
        routeNumber: await nextRouteNumber(),
        ...data,
        tolls: prepareTolls(data.tolls),
        routeHistory: [actorHistory('Created', actor, 'Route created.')],
        createdBy: String(actor.id),
        updatedBy: String(actor.id)
    });
    return populateRoute(route.toObject());
};

exports.updateRoute = async (id, changes, actor) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid route ID.', 400);
    const route = await Route.findOne({ _id: id, isDeleted: false });
    if (!route) throw serviceError('Route not found.', 404);
    if (changes.origin && changes.destination
        && changes.origin.toLocaleLowerCase() === changes.destination.toLocaleLowerCase()) {
        throw serviceError('Route origin and destination must be different.', 400);
    }
    const normalized = { ...changes };
    if (normalized.tolls) normalized.tolls = prepareTolls(normalized.tolls);
    for (const [key, value] of Object.entries(normalized)) route.set(key, value);
    route.updatedBy = String(actor.id);
    route.routeHistory.push(actorHistory('Updated', actor, 'Route or toll details updated.'));
    await route.save();
    return populateRoute(route.toObject());
};

exports.archiveRoute = async (id, data, actor) => {
    if (!mongoose.isValidObjectId(id)) throw serviceError('Invalid route ID.', 400);
    const route = await Route.findOneAndUpdate(
        { _id: id, isDeleted: false, isActive: true },
        {
            $set: { isActive: false, updatedBy: String(actor.id) },
            $push: { routeHistory: actorHistory('Archived', actor, data.remarks) }
        },
        { new: true, runValidators: true }
    );
    if (!route) throw serviceError('Active route not found.', 404);
    return populateRoute(route.toObject());
};

exports.getSuggestions = async (query) => {
    const filter = {
        isActive: true,
        isDeleted: false,
        origin: new RegExp(`^${escapeRegex(query.origin)}$`, 'i'),
        destination: new RegExp(`^${escapeRegex(query.destination)}$`, 'i')
    };
    const routes = await Route.find(filter).lean();
    const options = routes.map((route) => ({
        ...populateRoute(route),
        estimatedTollPaise: tollAmountForVehicle(route, query.vehicleType),
        rankingBasis: 'Recorded route distance and toll data; not live traffic or map routing.'
    })).filter((route) => !query.avoidTolls || route.estimatedTollPaise === 0)
        .sort((left, right) => left.distanceKm - right.distanceKm
            || left.estimatedDurationMinutes - right.estimatedDurationMinutes
            || left.estimatedTollPaise - right.estimatedTollPaise
            || left.routeNumber.localeCompare(right.routeNumber))
        .slice(0, query.limit);
    return {
        origin: query.origin,
        destination: query.destination,
        vehicleType: query.vehicleType,
        avoidTolls: query.avoidTolls,
        candidates: options
    };
};

exports.getRoutePlanSnapshot = async (routeId, vehicleType) => {
    if (!mongoose.isValidObjectId(routeId)) throw serviceError('Invalid route selection.', 400);
    const route = await Route.findOne({ _id: routeId, isActive: true, isDeleted: false }).lean();
    if (!route) throw serviceError('Selected route is not active.', 409);
    return {
        routeCatalogId: route._id,
        routeId: route.routeNumber,
        waypoints: route.waypoints.join(' → '),
        distanceKm: route.distanceKm,
        estimatedDurationMinutes: route.estimatedDurationMinutes,
        estimatedTollPaise: tollAmountForVehicle(route, vehicleType),
        routeSnapshot: {
            name: route.name,
            origin: route.origin,
            destination: route.destination,
            distanceKm: route.distanceKm,
            estimatedDurationMinutes: route.estimatedDurationMinutes,
            tolls: route.tolls.map((toll) => ({
                name: toll.name,
                location: toll.location,
                amountPaise: toll.amountPaise,
                vehicleTypes: toll.vehicleTypes
            }))
        }
    };
};

exports.getSummary = async (query = {}) => {
    const usageMatch = {};
    if (query.startDate || query.endDate) {
        usageMatch.createdAt = {};
        if (query.startDate) usageMatch.createdAt.$gte = new Date(query.startDate);
        if (query.endDate) {
            const end = new Date(query.endDate);
            end.setUTCHours(23, 59, 59, 999);
            usageMatch.createdAt.$lte = end;
        }
    }
    const [routes, usage] = await Promise.all([
        Route.aggregate([
            { $match: { isDeleted: false } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    active: { $sum: { $cond: ['$isActive', 1, 0] } },
                    inactive: { $sum: { $cond: ['$isActive', 0, 1] } },
                    averageDistanceKm: { $avg: '$distanceKm' }
                }
            }
        ]),
        TripRoutePlan.aggregate([
            { $match: { routeCatalogId: { $exists: true, $ne: null }, ...usageMatch } },
            {
                $group: {
                    _id: null,
                    linkedTripPlans: { $sum: 1 },
                    recordedDistanceKm: { $sum: { $ifNull: ['$distanceKm', 0] } },
                    estimatedTollPaise: { $sum: { $ifNull: ['$estimatedTollPaise', 0] } }
                }
            }
        ])
    ]);
    return {
        ...(routes[0] || { total: 0, active: 0, inactive: 0, averageDistanceKm: 0 }),
        ...(usage[0] || { linkedTripPlans: 0, recordedDistanceKm: 0, estimatedTollPaise: 0 })
    };
};
