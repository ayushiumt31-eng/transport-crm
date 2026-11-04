const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();
const email = Joi.string().trim().lowercase().email().max(254).allow('');
const mobilePhone = Joi.string().trim().pattern(/^[6-9]\d{9}$/);
const pan = Joi.string().trim().uppercase().pattern(/^[A-Z]{5}\d{4}[A-Z]$/).allow('');
const gstin = Joi.string().trim().uppercase().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/).allow('');

const addressSchema = Joi.object({
    street: Joi.string().trim().max(200).allow(''),
    city: Joi.string().trim().max(100).allow(''),
    state: Joi.string().trim().max(100).allow(''),
    pincode: Joi.string().trim().pattern(/^\d{6}$/).allow('')
}).unknown(false);

exports.customerIdParamsSchema = Joi.object({ id: objectId }).unknown(false);
exports.portalDocumentParamsSchema = Joi.object({ documentId: objectId }).unknown(false);
exports.documentParamsSchema = Joi.object({
    id: objectId,
    documentId: objectId
}).unknown(false);
exports.activityParamsSchema = Joi.object({
    id: objectId,
    activityId: objectId
}).unknown(false);

exports.customerListQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().max(100).allow(''),
    status: Joi.string().valid('Pending', 'Active', 'Suspended', ''),
    kycStatus: Joi.string().valid('NotSubmitted', 'Pending', 'Verified', 'Rejected', '')
}).unknown(false);

exports.activityListQuerySchema = Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50)
}).unknown(false);

exports.customerProfileSchema = Joi.object({
    companyName: Joi.string().trim().max(150).allow(''),
    contactPerson: Joi.string().trim().min(2).max(100).allow(''),
    customerType: Joi.string().valid('individual', 'business'),
    businessType: Joi.string().trim().max(120).allow(''),
    industry: Joi.string().trim().max(120).allow(''),
    phone: mobilePhone,
    alternatePhone: mobilePhone.allow(''),
    email,
    gstin,
    pan,
    address: addressSchema,
    pickupAddress: addressSchema,
    paymentTerms: Joi.string().trim().max(60),
    creditLimit: Joi.number().min(0).max(1000000000),
    notes: Joi.string().trim().max(2000).allow('')
}).min(1).unknown(false);

exports.customerStatusSchema = Joi.object({
    status: Joi.string().valid('Pending', 'Active', 'Suspended').required(),
    remarks: Joi.string().trim().max(250).allow('')
}).unknown(false);

exports.kycReviewSchema = Joi.object({
    status: Joi.string().valid('Verified', 'Rejected').required(),
    remarks: Joi.string().trim().max(500).allow('')
}).unknown(false).when(Joi.object({ status: Joi.valid('Rejected') }).unknown(), {
    then: Joi.object({ remarks: Joi.string().trim().min(1).max(500).required() })
});

exports.documentReviewSchema = Joi.object({
    status: Joi.string().valid('Verified', 'Rejected').required(),
    remarks: Joi.string().trim().max(500).allow('')
}).unknown(false).when(Joi.object({ status: Joi.valid('Rejected') }).unknown(), {
    then: Joi.object({ remarks: Joi.string().trim().min(1).max(500).required() })
});

exports.activitySchema = Joi.object({
    type: Joi.string().valid('note', 'call', 'email', 'sms', 'follow_up').required(),
    subject: Joi.string().trim().min(1).max(120).required(),
    description: Joi.string().trim().max(2000).allow(''),
    followUpAt: Joi.date().iso()
}).unknown(false).when(Joi.object({ type: Joi.valid('follow_up') }).unknown(), {
    then: Joi.object({ followUpAt: Joi.date().iso().greater('now').required() })
});

exports.portalProfileSchema = Joi.object({
    companyName: Joi.string().trim().max(150).allow(''),
    contactPerson: Joi.string().trim().min(2).max(100).allow(''),
    email,
    gstin,
    pan,
    address: addressSchema
}).min(1).unknown(false);

exports.preferencesSchema = Joi.object({
    language: Joi.string().valid('en', 'hi', 'mr', 'gu'),
    defaultVehicleType: Joi.string().trim().max(80).allow(''),
    notifyBySms: Joi.boolean(),
    notifyByEmail: Joi.boolean()
}).min(1).unknown(false);

exports.savedAddressSchema = Joi.object({
    label: Joi.string().trim().max(60).allow(''),
    address: Joi.string().trim().min(3).max(500).required(),
    city: Joi.string().trim().min(2).max(100).required(),
    state: Joi.string().trim().min(2).max(100).required(),
    pincode: Joi.string().trim().pattern(/^\d{6}$/).required(),
    contactName: Joi.string().trim().max(100).allow(''),
    contactPhone: Joi.string().trim().max(20).allow(''),
    isDefault: Joi.boolean()
}).unknown(false);

exports.documentUploadSchema = Joi.object({
    documentType: Joi.string().valid('pan', 'gstin', 'address_proof').required()
}).unknown(false);
