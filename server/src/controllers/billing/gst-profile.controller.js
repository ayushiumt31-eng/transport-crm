const gstProfileService = require('../../services/billing/gst-profile.service');

exports.getProfile = async (_request, response, next) => {
    try {
        return response.json({ success: true, data: await gstProfileService.getProfile() });
    } catch (error) {
        return next(error);
    }
};

exports.updateProfile = async (request, response, next) => {
    try {
        const data = await gstProfileService.updateProfile(request.body, request.user);
        return response.json({ success: true, message: 'GST profile saved.', data });
    } catch (error) {
        return next(error);
    }
};
