const shipmentService = require('../../services/cargo/shipment.service');

const handle = (work, status = 200, message) => async (request, response, next) => {
    try {
        const data = await work(request);
        return response.status(status).json({ success: true, ...(message ? { message } : {}), data });
    } catch (error) {
        return next(error);
    }
};

exports.listShipments = handle((request) => shipmentService.listShipments(
    request.validated.query,
    request.user
));
exports.listAvailableBookings = handle((request) => shipmentService.listAvailableBookings(
    request.validated.query
));
exports.createShipment = handle((request) => shipmentService.createShipment(
    request.body,
    request.user
), 201, 'Shipment created from the confirmed booking.');
exports.getShipment = handle((request) => shipmentService.getShipment(
    request.params.id,
    request.user
));
exports.getShipmentLiveLocation = handle((request) => shipmentService.getShipmentLiveLocation(
    request.params.id,
    request.user
));
exports.updateShipmentStatus = handle((request) => shipmentService.updateShipmentStatus(
    request.params.id,
    request.body,
    request.user
));
exports.uploadProofOfDelivery = handle((request) => shipmentService.uploadProofOfDelivery(
    request.params.id,
    request.body,
    request.file,
    request.user
), 201, 'Delivery record saved.');

exports.downloadProofOfDelivery = async (request, response, next) => {
    try {
        const pod = await shipmentService.getProofOfDelivery(request.params.id, request.user);
        const filename = pod.originalName.replace(/["\\\r\n]/g, '_');
        response.set({
            'Content-Type': pod.contentType,
            'Content-Length': pod.size,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff'
        });
        return response.end(Buffer.isBuffer(pod.content)
            ? pod.content
            : Buffer.from(pod.content.buffer).subarray(0, pod.size));
    } catch (error) {
        return next(error);
    }
};
