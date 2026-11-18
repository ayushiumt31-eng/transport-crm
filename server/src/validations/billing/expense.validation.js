const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);
const dateOnly = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        return helpers.error('date.format');
    }
    return value;
});

const dateRange = (value, helpers) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
        return helpers.error('expense.dateRange');
    }
    return value;
};

const querySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    category: Joi.string().valid('Fuel', 'Toll', 'Maintenance', 'Driver', 'Operations', 'Other', ''),
    vehicleId: objectId,
    tripId: objectId,
    search: Joi.string().trim().max(100).allow(''),
    startDate: dateOnly,
    endDate: dateOnly
}).unknown(false).custom(dateRange).messages({
    'expense.dateRange': 'End date must be on or after start date.'
});

exports.listQuerySchema = querySchema;
exports.reportQuerySchema = querySchema.fork(['page', 'limit', 'search', 'tripId'], (schema) => schema.forbidden());
exports.createSchema = Joi.object({
    idempotencyKey: Joi.string().trim().min(16).max(128).required(),
    category: Joi.string().valid('Fuel', 'Toll', 'Maintenance', 'Driver', 'Operations', 'Other').required(),
    description: Joi.string().trim().min(2).max(500).required(),
    amount: Joi.number().positive().max(90071992547409.9).precision(2).required(),
    incurredAt: Joi.date().iso().max('now').required(),
    vehicleId: objectId.allow(null),
    tripId: objectId.allow(null),
    vendor: Joi.string().trim().max(150).allow('').default(''),
    reference: Joi.string().trim().max(100).allow('').default(''),
    notes: Joi.string().trim().max(1000).allow('').default('')
}).unknown(false);
