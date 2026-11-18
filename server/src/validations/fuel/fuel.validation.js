const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();
const dateOnly = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        return helpers.error('date.format');
    }
    return value;
});

const dateRange = (value, helpers) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
        return helpers.error('fuel.dateRange');
    }
    return value;
};

exports.entryParamsSchema = Joi.object({ id: objectId }).unknown(false);
exports.listQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(100).allow(''),
    vehicleId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
    startDate: dateOnly,
    endDate: dateOnly
}).unknown(false).custom(dateRange).messages({
    'fuel.dateRange': 'End date must be on or after the start date.'
});

exports.reportQuerySchema = Joi.object({
    vehicleId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
    startDate: dateOnly,
    endDate: dateOnly
}).unknown(false).custom(dateRange).messages({
    'fuel.dateRange': 'End date must be on or after the start date.'
});

exports.vehicleOptionsQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(100),
    search: Joi.string().trim().max(100).allow('')
}).unknown(false);

exports.tripOptionsQuerySchema = Joi.object({
    vehicleId: objectId
}).unknown(false);

exports.createEntrySchema = Joi.object({
    idempotencyKey: Joi.string().trim().min(16).max(128).required(),
    vehicleId: objectId,
    tripId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
    filledAt: Joi.date().iso().max('now').required(),
    quantity: Joi.number().positive().max(1000000).precision(3).required(),
    unit: Joi.string().valid('Litre', 'Kg', 'KWh').required(),
    pricePerUnit: Joi.number().positive().max(1000000).precision(2).required(),
    odometerKm: Joi.number().integer().min(0).max(100000000).required(),
    isFullTank: Joi.boolean().default(false),
    vendor: Joi.string().trim().max(150).allow('').default(''),
    receiptNumber: Joi.string().trim().max(100).allow('').default(''),
    notes: Joi.string().trim().max(500).allow('').default('')
}).unknown(false);
