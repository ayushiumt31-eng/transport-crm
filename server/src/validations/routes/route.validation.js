const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();
const vehicleTypes = ['Truck', 'Trailer', 'Container', 'Pickup', 'Tempo', 'Tanker', 'Van', 'Other'];

const tollSchema = Joi.object({
    name: Joi.string().trim().min(2).max(150).required(),
    location: Joi.string().trim().min(2).max(200).required(),
    amount: Joi.number().positive().max(10000000).precision(2).required(),
    vehicleTypes: Joi.array().items(Joi.string().valid(...vehicleTypes)).max(vehicleTypes.length).unique().default([]),
    notes: Joi.string().trim().max(500).allow('').default('')
}).unknown(false);

const routeFields = {
    name: Joi.string().trim().min(2).max(120),
    origin: Joi.string().trim().min(2).max(120),
    destination: Joi.string().trim().min(2).max(120),
    distanceKm: Joi.number().positive().max(100000),
    estimatedDurationMinutes: Joi.number().integer().min(1).max(1000000),
    waypoints: Joi.array().items(Joi.string().trim().min(1).max(120)).max(100),
    tolls: Joi.array().items(tollSchema).max(100),
    notes: Joi.string().trim().max(2000).allow('')
};

exports.routeParamsSchema = Joi.object({ id: objectId }).unknown(false);

exports.listQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(100).allow(''),
    origin: Joi.string().trim().max(120).allow(''),
    destination: Joi.string().trim().max(120).allow(''),
    onlyActive: Joi.boolean().default(true)
}).unknown(false);

exports.createRouteSchema = Joi.object({
    ...routeFields,
    name: routeFields.name.required(),
    origin: routeFields.origin.required(),
    destination: routeFields.destination.required(),
    distanceKm: routeFields.distanceKm.required(),
    estimatedDurationMinutes: routeFields.estimatedDurationMinutes.required(),
    waypoints: routeFields.waypoints.default([]),
    tolls: routeFields.tolls.default([]),
    notes: routeFields.notes.default('')
}).unknown(false).custom((value, helpers) => {
    if (value.origin.toLocaleLowerCase() === value.destination.toLocaleLowerCase()) {
        return helpers.error('route.sameEndpoint');
    }
    return value;
}).messages({ 'route.sameEndpoint': 'Route origin and destination must be different.' });

exports.updateRouteSchema = Joi.object(routeFields)
    .min(1)
    .unknown(false)
    .custom((value, helpers) => {
        if (value.origin && value.destination
            && value.origin.toLocaleLowerCase() === value.destination.toLocaleLowerCase()) {
            return helpers.error('route.sameEndpoint');
        }
        return value;
    })
    .messages({ 'route.sameEndpoint': 'Route origin and destination must be different.' });

exports.archiveSchema = Joi.object({
    remarks: Joi.string().trim().min(2).max(500).required()
}).unknown(false);

exports.suggestionQuerySchema = Joi.object({
    origin: Joi.string().trim().min(2).max(120).required(),
    destination: Joi.string().trim().min(2).max(120).required(),
    vehicleType: Joi.string().valid(...vehicleTypes).required(),
    avoidTolls: Joi.boolean().default(false),
    limit: Joi.number().integer().min(1).max(20).default(5)
}).unknown(false).custom((value, helpers) => {
    if (value.origin.toLocaleLowerCase() === value.destination.toLocaleLowerCase()) {
        return helpers.error('route.sameEndpoint');
    }
    return value;
}).messages({ 'route.sameEndpoint': 'Route origin and destination must be different.' });

exports.summaryQuerySchema = Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso()
}).unknown(false).custom((value, helpers) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
        return helpers.error('route.dateRange');
    }
    return value;
}).messages({ 'route.dateRange': 'End date must be on or after the start date.' });
