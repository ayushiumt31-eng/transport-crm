const fuelService = require('../../services/fuel/fuel.service');

const handle = (work, status = 200) => async (request, response, next) => {
    try {
        const result = await work(request);
        if (result && Object.hasOwn(result, 'created')) {
            return response.status(result.created ? 201 : 200).json({ success: true, data: result.entry });
        }
        return response.status(status).json({ success: true, data: result });
    } catch (error) {
        return next(error);
    }
};

exports.listEntries = handle((request) => fuelService.listEntries(request.validated.query));
exports.listVehicleOptions = handle((request) => fuelService.listVehicleOptions(request.validated.query));
exports.listTripOptions = handle((request) => fuelService.listTripOptions(request.validated.query.vehicleId));
exports.createEntry = handle((request) => fuelService.createEntry(request.body, request.user));
exports.getSummary = handle((request) => fuelService.getSummary(request.validated.query));
