const routeService = require('../../services/routes/route.service');

const handle = (work, status = 200, message) => async (request, response, next) => {
    try {
        const data = await work(request);
        return response.status(status).json({ success: true, ...(message ? { message } : {}), data });
    } catch (error) {
        return next(error);
    }
};

exports.listRoutes = handle((request) => routeService.listRoutes(request.validated.query));
exports.createRoute = handle((request) => routeService.createRoute(request.body, request.user), 201, 'Route created.');
exports.updateRoute = handle((request) => routeService.updateRoute(request.params.id, request.body, request.user));
exports.archiveRoute = handle((request) => routeService.archiveRoute(request.params.id, request.body, request.user));
exports.getSuggestions = handle((request) => routeService.getSuggestions(request.validated.query));
exports.getSummary = handle((request) => routeService.getSummary(request.validated.query));
