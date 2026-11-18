const feedbackService = require('../../services/customers/feedback.service');

const handle = (work, status = 200, message) => async (request, response, next) => {
    try {
        const data = await work(request);
        return response.status(status).json({ success: true, ...(message ? { message } : {}), data });
    } catch (error) {
        return next(error);
    }
};

exports.listEligibleShipments = handle((request) => feedbackService.listEligibleShipments(request.user));
exports.listFeedback = handle((request) => feedbackService.listFeedback(request.validated.query, request.user));
exports.createFeedback = handle((request) => feedbackService.createFeedback(request.body, request.user), 201, 'Feedback submitted.');
exports.updateFeedback = handle((request) => feedbackService.updateFeedback(request.params.id, request.body, request.user));
exports.getSummary = handle(() => feedbackService.getSummary());
