const maintenanceService = require('../../services/maintenance/maintenance.service');

const handle = (work, status = 200, message) => async (request, response, next) => {
    try {
        const data = await work(request);
        return response.status(status).json({ success: true, ...(message ? { message } : {}), data });
    } catch (error) {
        return next(error);
    }
};

exports.listVehicleOptions = handle((request) => maintenanceService.listVehicleOptions(request.validated.query));
exports.listRecords = handle((request) => maintenanceService.listRecords(request.validated.query));
exports.createRecord = handle((request) => maintenanceService.createRecord(request.body, request.user), 201, 'Maintenance record created.');
exports.updateRecordStatus = handle((request) => maintenanceService.updateRecordStatus(
    request.params.id,
    request.body,
    request.user
));
exports.updateVehicleDocument = handle((request) => maintenanceService.updateVehicleDocument(
    request.params.id,
    request.params.documentType,
    request.body,
    request.user
));
exports.listReminders = handle((request) => maintenanceService.listReminders(request.validated.query));
exports.getSummary = handle(() => maintenanceService.getSummary());
