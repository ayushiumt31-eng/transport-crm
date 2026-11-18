const Joi = require('joi');

const indianStatesAndTerritories = [
    'Andaman and Nicobar Islands',
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chandigarh',
    'Chhattisgarh',
    'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jammu and Kashmir',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Ladakh',
    'Lakshadweep',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Puducherry',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal'
];

const gstin = Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/)
    .allow('')
    .default('');

exports.updateSchema = Joi.object({
    legalName: Joi.string().trim().max(150).allow('').default(''),
    gstin,
    registeredState: Joi.string().valid(...indianStatesAndTerritories, '').default(''),
    billingAddress: Joi.object({
        line1: Joi.string().trim().max(200).allow('').default(''),
        line2: Joi.string().trim().max(200).allow('').default(''),
        city: Joi.string().trim().max(100).allow('').default(''),
        pincode: Joi.string().trim().max(10).allow('').default(''),
        country: Joi.string().trim().max(80).allow('').default('India')
    }).default({}),
    taxCategories: Joi.array().items(Joi.object({
        name: Joi.string().trim().min(2).max(120).required(),
        serviceCode: Joi.string().trim().uppercase().alphanum().min(4).max(8).required(),
        ratePercent: Joi.number().min(0).max(100).precision(2).required()
    }).unknown(false)).max(50).default([]),
    taxRatesReviewed: Joi.boolean().default(false)
}).unknown(false).custom((value, helpers) => {
    if (value.taxRatesReviewed && value.taxCategories.length === 0) {
        return helpers.error('gst.categoriesRequired');
    }
    return value;
}).messages({
    'gst.categoriesRequired': 'Add at least one CA-reviewed tax category before confirming the rates.'
});
