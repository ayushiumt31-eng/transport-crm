const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();
const statuses = [
    'Booked',
    'ReadyForPickup',
    'PickedUp',
    'InTransit',
    'OutForDelivery',
    'Delivered',
    'Exception',
    'Cancelled'
];

exports.listQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid(...statuses, ''),
    search: Joi.string().trim().max(100).allow('')
}).unknown(false);

exports.createSchema = Joi.object({
    bookingId: objectId
}).unknown(false);

exports.shipmentParamsSchema = Joi.object({
    id: objectId
}).unknown(false);

exports.statusSchema = Joi.object({
    shipmentStatus: Joi.string().valid(...statuses).required(),
    remarks: Joi.string().trim().max(1000).allow('').default(''),
    location: Joi.object({
        latitude: Joi.number().min(-90).max(90).required(),
        longitude: Joi.number().min(-180).max(180).required(),
        label: Joi.string().trim().max(200).allow('').default('')
    }).unknown(false)
}).unknown(false).custom((value, helpers) => {
    if (['Exception', 'Cancelled'].includes(value.shipmentStatus) && !value.remarks.trim()) {
        return helpers.error('shipment.reasonRequired');
    }
    return value;
}).messages({
    'shipment.reasonRequired': 'A reason is required when raising an exception or cancelling a shipment.'
});

exports.podSchema = Joi.object({
    receivedBy: Joi.string().trim().min(2).max(100).required(),
    receivedAt: Joi.date().iso().required(),
    remarks: Joi.string().trim().max(1000).allow('').default('')
}).unknown(false);
