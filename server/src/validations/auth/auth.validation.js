const Joi = require('joi');

// Same 10-digit format used when drivers and managers are registered.
const mobilePhone = Joi.string().trim().pattern(/^[6-9]\d{9}$/).required().messages({
    'string.pattern.base': 'Enter a valid 10-digit mobile number.',
    'string.empty': 'Mobile number is required.',
    'any.required': 'Mobile number is required.'
});

const loginId = Joi.string().trim().lowercase().pattern(/^[a-z0-9._@-]{3,50}$/).messages({
    'string.pattern.base': 'Login ID must be 3–50 characters: letters, numbers, dot, underscore, @ or hyphen.',
    'string.empty': 'Login ID is required.',
    'any.required': 'Login ID is required.'
});

const newPassword = Joi.string().min(8).max(72).messages({
    'string.min': 'Password must be at least 8 characters.',
    'string.max': 'Password must be at most 72 characters.',
    'string.empty': 'Password is required.',
    'any.required': 'Password is required.'
});

exports.mobilePhone = mobilePhone;

exports.loginSchema = Joi.object({
    // Not pattern-checked: a wrong format should read as "incorrect login ID or password".
    loginId: Joi.string().trim().lowercase().max(50).required().messages({ 'string.empty': 'Login ID is required.' }),
    password: Joi.string().max(200).required().messages({ 'string.empty': 'Password is required.' })
}).unknown(false);

exports.changePasswordSchema = Joi.object({
    currentPassword: Joi.string().max(200).required().messages({ 'string.empty': 'Current password is required.' }),
    newPassword: newPassword.required()
}).unknown(false);

exports.registerCustomerSchema = Joi.object({
    contactPerson: Joi.string().trim().min(2).max(100).required().messages({ 'string.empty': 'Your name is required.' }),
    companyName: Joi.string().trim().max(150).allow(''),
    phone: mobilePhone,
    password: newPassword.required()
}).unknown(false);

// Staff create or update someone's login. Password is required only when the login is first created.
exports.upsertAccountSchema = Joi.object({
    loginId: loginId.required(),
    password: newPassword.allow(''),
    status: Joi.string().valid('Active', 'Disabled')
}).unknown(false);
