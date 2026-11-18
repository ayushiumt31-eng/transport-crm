const gpsService = require('../../services/gps/gps.service');

const handle = (work, status = 200) => async (request, response, next) => {
    try {
        const data = await work(request);
        return response.status(status).json({ success: true, data });
    } catch (error) {
        return next(error);
    }
};

exports.getMapConfig = handle(() => gpsService.getMapConfig());
exports.listActiveTrips = handle((request) => gpsService.listActiveTrips(request.validated.query, request.user));
exports.listLocations = handle((request) => gpsService.listLocations(request.params.tripId, request.validated.query, request.user));
exports.recordLocation = handle((request) => gpsService.recordLocation(request.params.tripId, request.body, request.user), 201);
exports.listGeofences = handle(() => gpsService.listGeofences());
exports.createGeofence = handle((request) => gpsService.createGeofence(request.body, request.user), 201);
exports.archiveGeofence = handle((request) => gpsService.archiveGeofence(request.params.id, request.user));
exports.listAlerts = handle((request) => gpsService.listAlerts(request.validated.query, request.user));
