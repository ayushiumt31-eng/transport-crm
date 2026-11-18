const invoiceService = require('../../services/billing/invoice.service');

const handle = (work, status = 200, message) => async (request, response, next) => {
    try {
        const data = await work(request);
        return response.status(status).json({ success: true, ...(message ? { message } : {}), data });
    } catch (error) {
        return next(error);
    }
};

exports.listInvoiceOptions = handle((request) => invoiceService.listInvoiceOptions(request.validated.query));
exports.listInvoices = handle((request) => invoiceService.listInvoices(request.validated.query, request.user));
exports.createInvoice = handle((request) => invoiceService.createInvoice(request.body, request.user), 201, 'Invoice issued.');
exports.getInvoice = handle((request) => invoiceService.getInvoice(request.params.id, request.user));
exports.cancelInvoice = handle((request) => invoiceService.cancelInvoice(request.params.id, request.body, request.user));
exports.recordPayment = async (request, response, next) => {
    try {
        const result = await invoiceService.recordPayment(request.params.id, request.body, request.user);
        return response.status(result.created ? 201 : 200).json({
            success: true,
            message: result.created ? 'Payment receipt recorded.' : 'Payment was already recorded.',
            data: result.invoice
        });
    } catch (error) {
        return next(error);
    }
};
exports.listPayments = handle((request) => invoiceService.listPayments(request.validated.query, request.user));
exports.getFinancialSummary = handle((request) => invoiceService.getFinancialSummary(request.validated.query));
