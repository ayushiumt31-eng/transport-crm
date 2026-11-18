const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();

exports.tripParamsSchema = Joi.object({ tripId: objectId }).unknown(false);
exports.geofenceParamsSchema = Joi.object({ id: objectId }).unknown(false);

exports.listQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
}).unknown(false);

exports.historyQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(500).default(200),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso()
}).unknown(false).custom((value, helpers) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
        return helpers.error('gps.dateRange');
    }
    return value;
}).messages({ 'gps.dateRange': 'End date must be on or after the start date.' });

exports.locationSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    accuracyMeters: Joi.number().min(0).max(1000).required(),
    speedMetersPerSecond: Joi.number().min(0).max(83.3333).allow(null).default(null),
    headingDegrees: Joi.number().min(0).max(360).allow(null).default(null),
    recordedAt: Joi.date().iso().required()
}).unknown(false);

exports.createGeofenceSchema = Joi.object({
    name: Joi.string().trim().min(2).max(120).required(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    radiusMeters: Joi.number().integer().min(50).max(100000).required()
}).unknown(false);
