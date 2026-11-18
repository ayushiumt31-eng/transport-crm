const notificationService = require('../../services/notifications/notification.service');

const handle = (work) => async (request, response, next) => {
    try {
        const data = await work(request);
        return response.json({ success: true, data });
    } catch (error) {
        return next(error);
    }
};

exports.list = handle((request) => notificationService.listNotifications(request.validated.query, request.user));
exports.markAsRead = handle((request) => notificationService.markAsRead(request.params.id, request.user));
exports.markAllAsRead = handle((request) => notificationService.markAllAsRead(request.user));
