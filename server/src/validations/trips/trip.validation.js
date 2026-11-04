const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();
const tripStatuses = ['Scheduled', 'Assigned', 'InProgress', 'Delayed', 'Completed', 'Cancelled'];

const listQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(100).allow(''),
    status: Joi.string().valid(...tripStatuses, ''),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso()
}).unknown(false).custom((value, helpers) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
        return helpers.error('trip.dateRange');
    }
    return value;
}).messages({ 'trip.dateRange': 'End date must be on or after start date.' });

const tripCreateSchema = Joi.object({
    allocationId: objectId,
    notes: Joi.string().trim().max(2000).allow('')
}).unknown(false);

const tripParamsSchema = Joi.object({ id: objectId }).unknown(false);
const driverOptionsQuerySchema = Joi.object({ tripId: objectId }).unknown(false);

const tripAssignmentSchema = Joi.object({
    driverId: objectId,
    routeId: Joi.string().trim().max(100).allow(''),
    notes: Joi.string().trim().max(2000).allow('')
}).unknown(false);

const tripStatusSchema = Joi.object({
    tripStatus: Joi.string().valid('InProgress', 'Delayed', 'Completed', 'Cancelled').required(),
    remarks: Joi.string().trim().max(1000).allow('')
}).unknown(false).custom((value, helpers) => {
    if (['Delayed', 'Cancelled'].includes(value.tripStatus) && !value.remarks.trim()) {
        return helpers.error('trip.remarksRequired');
    }
    return value;
}).messages({ 'trip.remarksRequired': 'A reason is required when delaying or cancelling a trip.' });

const routePlanSchema = Joi.object({
    tripId: objectId,
    routeId: Joi.string().trim().min(2).max(100).required(),
    waypoints: Joi.string().trim().max(5000).allow(''),
    plannedStartDate: Joi.date().iso().allow(null),
    notes: Joi.string().trim().max(2000).allow('')
}).unknown(false);

const routePlanUpdateSchema = routePlanSchema.fork(
    Object.keys(routePlanSchema.describe().keys),
    (field) => field.optional()
).min(1);

exports.listQuerySchema = listQuerySchema;
exports.tripCreateSchema = tripCreateSchema;
exports.tripParamsSchema = tripParamsSchema;
exports.driverOptionsQuerySchema = driverOptionsQuerySchema;
exports.tripAssignmentSchema = tripAssignmentSchema;
exports.tripStatusSchema = tripStatusSchema;
exports.routePlanSchema = routePlanSchema;
exports.routePlanUpdateSchema = routePlanUpdateSchema;
