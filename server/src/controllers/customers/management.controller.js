const managementService = require('../../services/customers/management.service');

const handle = (work, status = 200) => async (request, response, next) => {
    try {
        const data = await work(request);
        return response.status(status).json({ success: true, data });
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

exports.getSummary = handle(() => managementService.getCustomerSummary());
exports.listCustomers = handle((request) => managementService.listCustomers(request.validated?.query || request.query));
exports.getCustomer = handle((request) => managementService.getCustomer(request.params.id));
exports.updateCustomerProfile = handle((request) => managementService.updateCustomerProfile(request.params.id, request.body));
exports.updateCustomerStatus = handle((request) => managementService.updateCustomerStatus(request.params.id, request.body));
exports.reviewCustomerKyc = handle((request) => managementService.reviewCustomerKyc(request.params.id, request.body, request.user));
exports.listKycDocuments = handle((request) => managementService.listKycDocuments(request.params.id));
exports.reviewKycDocument = handle((request) => managementService.reviewKycDocument(
    request.params.id,
    request.params.documentId,
    request.body,
    request.user
));
exports.downloadKycDocument = async (request, response, next) => {
    try {
        const document = await managementService.getKycDocumentContent(request.params.id, request.params.documentId);
        return sendDocument(document, response);
    } catch (error) {
        return next(error);
    }
};
exports.listActivities = handle((request) => managementService.listActivities(
    request.params.id,
    request.validated?.query?.limit ?? Number(request.query.limit || 50)
));
exports.createActivity = handle((request) => managementService.createActivity(request.params.id, request.body, request.user), 201);
exports.completeFollowUp = handle((request) => managementService.completeFollowUp(request.params.id, request.params.activityId));
