const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();
const dateOnly = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        return helpers.error('date.format');
    }
    return value;
});

exports.recordParamsSchema = Joi.object({ id: objectId }).unknown(false);

exports.listQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    vehicleId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
    recordType: Joi.string().valid('Service', 'Repair', ''),
    status: Joi.string().valid('Scheduled', 'InProgress', 'Completed', 'Cancelled', ''),
    search: Joi.string().trim().max(100).allow('')
}).unknown(false);

exports.vehicleOptionsQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(100),
    search: Joi.string().trim().max(100).allow('')
}).unknown(false);

exports.createRecordSchema = Joi.object({
    vehicleId: objectId,
    recordType: Joi.string().valid('Service', 'Repair').required(),
    title: Joi.string().trim().min(2).max(150).required(),
    description: Joi.string().trim().max(2000).allow('').default(''),
    scheduledAt: Joi.date().iso().required(),
    dueOdometerKm: Joi.number().integer().min(0).max(100000000).allow(null),
    vendor: Joi.string().trim().max(150).allow('').default(''),
    estimatedCost: Joi.number().min(0).max(100000000).precision(2).allow(null)
}).unknown(false);

exports.statusSchema = Joi.object({
    status: Joi.string().valid('InProgress', 'Completed', 'Cancelled').required(),
    remarks: Joi.string().trim().max(500).allow('').default(''),
    actualCost: Joi.number().min(0).max(100000000).precision(2).when('status', {
        is: 'Completed',
        then: Joi.required(),
        otherwise: Joi.forbidden()
    }),
    completionOdometerKm: Joi.number().integer().min(0).max(100000000).when('status', {
        is: 'Completed',
        then: Joi.required(),
        otherwise: Joi.forbidden()
    }),
    completionRemarks: Joi.string().trim().max(1000).allow('').when('status', {
        is: 'Completed',
        then: Joi.optional().default(''),
        otherwise: Joi.forbidden()
    })
}).unknown(false).custom((value, helpers) => {
    if (value.status === 'Cancelled' && !value.remarks.trim()) {
        return helpers.error('maintenance.cancelReason');
    }
    return value;
}).messages({
    'maintenance.cancelReason': 'A cancellation reason is required.'
});

exports.documentSchema = Joi.object({
    documentNumber: Joi.string().trim().max(100).allow('').default(''),
    fileUrl: Joi.string().uri({ scheme: ['http', 'https'] }).max(1000).allow('').default(''),
    issueDate: dateOnly.allow(null),
    expiryDate: dateOnly.required()
}).unknown(false).custom((value, helpers) => {
    if (value.issueDate && value.expiryDate < value.issueDate) {
        return helpers.error('maintenance.documentDateRange');
    }
    return value;
}).messages({
    'maintenance.documentDateRange': 'Document expiry cannot be earlier than its issue date.'
});

exports.documentParamsSchema = Joi.object({
    id: objectId,
    documentType: Joi.string().valid('insurance', 'fitnessCertificate').required()
}).unknown(false);

exports.reminderQuerySchema = Joi.object({
    days: Joi.number().integer().min(0).max(365).default(30),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
}).unknown(false);
