const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();
const statuses = ['Issued', 'PartiallyPaid', 'Paid', 'Overdue', 'Cancelled'];
const dateOnly = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        return helpers.error('date.format');
    }
    return value;
});

exports.listQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid(...statuses, ''),
    search: Joi.string().trim().max(100).allow(''),
    startDate: dateOnly,
    endDate: dateOnly
}).unknown(false).custom((value, helpers) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
        return helpers.error('billing.dateRange');
    }
    return value;
}).messages({ 'billing.dateRange': 'End date must be on or after start date.' });

exports.optionsQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
}).unknown(false);

exports.paymentListQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(100).allow(''),
    startDate: dateOnly,
    endDate: dateOnly
}).unknown(false).custom((value, helpers) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
        return helpers.error('billing.dateRange');
    }
    return value;
}).messages({ 'billing.dateRange': 'End date must be on or after the start date.' });

exports.createInvoiceSchema = Joi.object({
    shipmentId: objectId,
    invoiceDate: dateOnly.required(),
    dueDate: dateOnly.required(),
    taxRatePercent: Joi.number().min(0).max(100).precision(2).default(0),
    items: Joi.array().items(Joi.object({
        description: Joi.string().trim().min(2).max(200).required(),
        quantity: Joi.number().positive().max(100000).precision(3).required(),
        unitPrice: Joi.number().min(0).max(100000000).precision(2).required()
    }).unknown(false)).min(1).max(50).required()
}).unknown(false).custom((value, helpers) => {
    if (value.dueDate < value.invoiceDate) return helpers.error('billing.dueDate');
    return value;
}).messages({ 'billing.dueDate': 'Due date must be on or after the invoice date.' });

exports.invoiceParamsSchema = Joi.object({ id: objectId }).unknown(false);

exports.paymentSchema = Joi.object({
    idempotencyKey: Joi.string().trim().min(16).max(128).required(),
    amount: Joi.number().positive().max(1000000000).precision(2).required(),
    method: Joi.string().valid('BankTransfer', 'UPI', 'Card', 'Cash', 'Cheque', 'Other').required(),
    transactionReference: Joi.string().trim().max(100).allow('').default(''),
    notes: Joi.string().trim().max(500).allow('').default(''),
    paidAt: Joi.date().iso().max('now').required()
}).unknown(false).custom((value, helpers) => {
    if (value.method !== 'Cash' && !value.transactionReference.trim()) {
        return helpers.error('billing.referenceRequired');
    }
    return value;
}).messages({ 'billing.referenceRequired': 'A transaction reference is required for non-cash payments.' });

exports.cancelInvoiceSchema = Joi.object({
    remarks: Joi.string().trim().min(2).max(500).required()
}).unknown(false);
