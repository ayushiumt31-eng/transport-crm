const tripService = require('../../services/trips/trip.service');

const handle = (work, status = 200) => async (request, response, next) => {
    try {
        const data = await work(request);
        return response.status(status).json({ success: true, data });
    } catch (error) {
        return next(error);
    }
};

exports.listTrips = handle((request) => tripService.listTrips(request.validated.query, request.user));
exports.listAssignments = handle((request) => tripService.listAssignments(request.validated.query, request.user));
exports.listActiveTrips = handle((request) => tripService.listActiveTrips(request.validated.query, request.user));
exports.listTripHistory = handle((request) => tripService.listTripHistory(request.validated.query, request.user));
exports.listAllocationOptions = handle(() => tripService.listAllocationOptions());
exports.listDriversForTrip = handle((request) => tripService.listDriversForTrip(request.validated.query.tripId));
exports.createTrip = handle((request) => tripService.createTrip(request.body, request.user), 201);
exports.assignTrip = handle((request) => tripService.assignTrip(request.params.id, request.body, request.user));
exports.updateTripStatus = handle((request) => tripService.updateTripStatus(request.params.id, request.body, request.user));
exports.listRoutePlans = handle((request) => tripService.listRoutePlans(request.validated.query, request.user));
exports.createRoutePlan = handle((request) => tripService.createRoutePlan(request.body, request.user), 201);
exports.updateRoutePlan = handle((request) => tripService.updateRoutePlan(request.params.id, request.body, request.user));
exports.deleteRoutePlan = handle((request) => tripService.deleteRoutePlan(request.params.id));
exports.getTripMetrics = handle((request) => tripService.getTripMetrics(request.validated.query));
