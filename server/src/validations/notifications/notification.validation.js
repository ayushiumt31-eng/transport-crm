const Joi = require('joi');

exports.listQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    category: Joi.string().valid('trip', 'gps'),
    unreadOnly: Joi.boolean().truthy('true').falsy('false').default(false)
}).unknown(false);

exports.idParamsSchema = Joi.object({
    id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
}).unknown(false);
