const driverService = require('../../services/drivers/driver.service');

const handle = (work, status = 200) => async (request, response, next) => {
    try {
        const data = await work(request);
        return response.status(status).json({ success: true, data });
    } catch (error) {
        return next(error);
    }
};

exports.listDrivers = handle((request) => driverService.listDrivers(request.validated.query));
exports.getDriver = handle((request) => driverService.getDriver(request.params.id));
exports.createDriver = handle((request) => driverService.createDriver(request.body, request.user), 201);
exports.updateDriver = handle((request) => driverService.updateDriver(request.params.id, request.body));
exports.updateDriverStatus = handle((request) => driverService.updateDriverStatus(request.params.id, request.body, request.user));
exports.deleteDriver = handle((request) => driverService.deleteDriver(request.params.id, request.user));
exports.listLicenses = handle((request) => driverService.listLicenses(request.validated.query, request.user));
exports.createLicense = handle((request) => driverService.createLicense(request.body, request.user), 201);
exports.updateLicense = handle((request) => driverService.updateLicense(request.params.id, request.body, request.user));
exports.updateLicenseStatus = handle((request) => driverService.updateLicenseStatus(request.params.id, request.body, request.user));
exports.deleteLicense = handle((request) => driverService.deleteLicense(request.params.id, request.user));
exports.listDocuments = handle((request) => driverService.listDocuments(request.validated.query, request.user));
exports.createDocument = handle((request) => driverService.createDocument(request.body, request.user), 201);
exports.updateDocument = handle((request) => driverService.updateDocument(request.params.id, request.body, request.user));
exports.deleteDocument = handle((request) => driverService.deleteDocument(request.params.id, request.user));
exports.listAttendance = handle((request) => driverService.listAttendance(request.validated.query, request.user));
exports.createAttendance = handle((request) => driverService.createAttendance(request.body, request.user), 201);
exports.updateAttendance = handle((request) => driverService.updateAttendance(request.params.id, request.body, request.user));
exports.updateAttendanceStatus = handle((request) => driverService.updateAttendanceStatus(request.params.id, request.body, request.user));
exports.deleteAttendance = handle((request) => driverService.deleteAttendance(request.params.id, request.user));
exports.listPayments = handle((request) => driverService.listPayments(request.validated.query, request.user));
exports.createPayment = handle((request) => driverService.createPayment(request.body, request.user), 201);
exports.updatePayment = handle((request) => driverService.updatePayment(request.params.id, request.body, request.user));
exports.updatePaymentStatus = handle((request) => driverService.updatePaymentStatus(request.params.id, request.body, request.user));
exports.deletePayment = handle((request) => driverService.deletePayment(request.params.id, request.user));
exports.getPerformance = handle((request) => driverService.getPerformance(request.validated.query));
