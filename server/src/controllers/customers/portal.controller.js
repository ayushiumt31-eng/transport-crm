const portalService = require('../../services/customers/portal.service');

const handle = (work, { status = 200, message } = {}) => async (request, response, next) => {
    try {
        const data = await work(request);
        return response.status(status).json({ success: true, ...(message ? { message } : {}), data });
    } catch (error) {
        return next(error);
    }
};

function sendDocument(document, response) {
    const filename = document.originalName.replace(/["\\\r\n]/g, '_');
    const content = Buffer.isBuffer(document.content)
        ? document.content
        : Buffer.from(document.content.buffer).subarray(0, document.size);
    response.set({
        'Content-Type': document.contentType,
        'Content-Length': document.size,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff'
    });
    return response.end(content);
}

exports.getDashboard = handle((request) => portalService.getDashboard(request.user.id));
exports.getProfile = handle((request) => portalService.getProfile(request.user.id));
exports.updateProfile = handle((request) => portalService.updateProfile(request.user.id, request.body), {
    message: 'Profile updated successfully.'
});
exports.getPreferences = handle((request) => portalService.getPreferences(request.user.id));
exports.updatePreferences = handle((request) => portalService.updatePreferences(request.user.id, request.body), {
    message: 'Preferences updated successfully.'
});
exports.listAddresses = handle((request) => portalService.listAddresses(request.user.id));
exports.saveAddress = handle((request) => portalService.saveAddress(
    request.user.id,
    request.params.id,
    request.body
), { status: 201, message: 'Address saved successfully.' });
exports.updateAddress = handle((request) => portalService.saveAddress(
    request.user.id,
    request.params.id,
    request.body
), { message: 'Address updated successfully.' });
exports.deleteAddress = handle(async (request) => {
    await portalService.deleteAddress(request.user.id, request.params.id);
    return { message: 'Address deleted successfully.' };
});
exports.submitKyc = handle((request) => portalService.submitKyc(request.user.id), {
    message: 'KYC submitted for review.'
});
exports.uploadKycDocument = handle((request) => portalService.uploadKycDocument(
    request.user.id,
    request.body.documentType,
    request.file
), { status: 201, message: 'KYC document uploaded.' });
exports.listKycDocuments = handle((request) => portalService.listKycDocuments(request.user.id));
exports.downloadKycDocument = async (request, response, next) => {
    try {
        const document = await portalService.getKycDocumentContent(request.user.id, request.params.documentId);
        return sendDocument(document, response);
    } catch (error) {
        return next(error);
    }
};
