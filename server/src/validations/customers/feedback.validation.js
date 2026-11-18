const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();
const statuses = ['Open', 'InReview', 'Resolved'];

exports.listQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid(...statuses, ''),
    category: Joi.string().valid('Service', 'Driver', 'Vehicle', 'Delivery', 'Other', ''),
    rating: Joi.number().integer().min(1).max(5),
    search: Joi.string().trim().max(100).allow('')
}).unknown(false);

exports.createSchema = Joi.object({
    shipmentId: objectId,
    category: Joi.string().valid('Service', 'Driver', 'Vehicle', 'Delivery', 'Other').required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    subject: Joi.string().trim().min(3).max(150).required(),
    message: Joi.string().trim().min(5).max(2000).required()
}).unknown(false);

exports.paramsSchema = Joi.object({ id: objectId }).unknown(false);

exports.updateSchema = Joi.object({
    status: Joi.string().valid(...statuses).required(),
    staffResponse: Joi.string().trim().max(2000).allow('').default('')
}).unknown(false).custom((value, helpers) => {
    if (value.status === 'Resolved' && value.staffResponse.length < 2) {
        return helpers.error('feedback.responseRequired');
    }
    return value;
}).messages({
    'feedback.responseRequired': 'Add a customer-facing response before resolving feedback.'
});
