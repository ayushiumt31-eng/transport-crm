const fleetService = require('../../services/fleet/fleet.service');

const handle = (work, status = 200) => async (request, response, next) => {
    try {
        const data = await work(request);
        return response.status(status).json({ success: true, data });
    } catch (error) {
        return next(error);
    }
};

exports.listVehicles = handle((request) => fleetService.listVehicles(request.validated.query));
exports.createVehicle = handle((request) => fleetService.createVehicle(request.body, request.user), 201);
exports.updateVehicle = handle((request) => fleetService.updateVehicle(request.params.id, request.body));
exports.updateVehicleStatus = handle((request) => fleetService.updateVehicleStatus(request.params.id, request.body, request.user));
exports.deleteVehicle = handle((request) => fleetService.deleteVehicle(request.params.id, request.user));
exports.getFleetDashboard = handle(() => fleetService.getFleetDashboard());
exports.listAllocatableBookings = handle(() => fleetService.listAllocatableBookings());
exports.listAllocatableVehicles = handle((request) => fleetService.listAllocatableVehicles(request.validated.query.bookingId));
exports.listAllocations = handle((request) => fleetService.listAllocations(request.validated.query));
exports.createAllocation = handle((request) => fleetService.createAllocation(request.body, request.user), 201);
exports.updateAllocationStatus = handle((request) => fleetService.updateAllocationStatus(
    request.params.id,
    request.body,
    request.user
));
