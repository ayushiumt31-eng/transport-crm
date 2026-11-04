const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();
const currentYear = new Date().getUTCFullYear();

const vehicleDocumentSchema = Joi.object({
    documentNumber: Joi.string().trim().max(100).allow(''),
    fileUrl: Joi.string().uri({ scheme: ['http', 'https'] }).max(1000).allow(''),
    issueDate: Joi.date().iso().allow(null),
    expiryDate: Joi.date().iso().allow(null)
}).unknown(false).custom((value, helpers) => {
    if (value.issueDate && value.expiryDate && value.expiryDate < value.issueDate) {
        return helpers.error('vehicleDocument.dateRange');
    }
    return value;
}).messages({ 'vehicleDocument.dateRange': 'A document expiry cannot be earlier than its issue date.' });

const vehicleSchema = Joi.object({
    registrationNumber: Joi.string().trim().uppercase().pattern(/^[A-Z0-9 -]{5,20}$/).required(),
    vehicleType: Joi.string().valid('Truck', 'Trailer', 'Container', 'Pickup', 'Tempo', 'Tanker', 'Van', 'Other').required(),
    manufacturer: Joi.string().trim().min(2).max(100).required(),
    model: Joi.string().trim().min(1).max(100).required(),
    manufacturingYear: Joi.number().integer().min(1950).max(currentYear).required(),
    capacity: Joi.object({
        value: Joi.number().positive().max(100000).required(),
        unit: Joi.string().valid('Ton', 'KG', 'Litre').required()
    }).required().unknown(false),
    fuelType: Joi.string().valid('Diesel', 'Petrol', 'CNG', 'LNG', 'Electric', 'Hybrid', 'Other').required(),
    ownershipType: Joi.string().valid('Owned', 'Leased', 'Attached').default('Owned'),
    color: Joi.string().trim().max(50).allow(''),
    chassisNumber: Joi.string().trim().uppercase().max(100).allow(''),
    engineNumber: Joi.string().trim().uppercase().max(100).allow(''),
    purchaseDate: Joi.date().iso().allow(null),
    notes: Joi.string().trim().max(1000).allow(''),
    documents: Joi.object({
        registrationCertificate: vehicleDocumentSchema,
        insurance: vehicleDocumentSchema,
        fitnessCertificate: vehicleDocumentSchema,
        pollutionCertificate: vehicleDocumentSchema,
        nationalPermit: vehicleDocumentSchema
    }).unknown(false)
}).unknown(false);

exports.vehicleIdParamsSchema = Joi.object({ id: objectId }).unknown(false);
exports.vehicleSchema = vehicleSchema;
exports.vehicleUpdateSchema = vehicleSchema.fork(
    ['registrationNumber', 'vehicleType', 'manufacturer', 'model', 'manufacturingYear', 'capacity', 'fuelType'],
    (schema) => schema.optional()
).min(1);
exports.vehicleListQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().max(100).allow(''),
    vehicleStatus: Joi.string().valid('Available', 'Allocated', 'OnTrip', 'UnderMaintenance', 'Inactive', '')
}).unknown(false);
exports.vehicleStatusSchema = Joi.object({
    vehicleStatus: Joi.string().valid('Available', 'UnderMaintenance', 'Inactive').required(),
    remarks: Joi.string().trim().max(500).allow('')
}).unknown(false);
exports.allocationParamsSchema = Joi.object({ id: objectId }).unknown(false);
exports.allocationCreateSchema = Joi.object({
    bookingId: objectId,
    vehicleId: objectId,
    plannedPickupDate: Joi.date().iso().required(),
    plannedDeliveryDate: Joi.date().iso().greater(Joi.ref('plannedPickupDate')).required(),
    remarks: Joi.string().trim().max(500).allow('')
}).unknown(false);
exports.allocationListQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    allocationStatus: Joi.string().valid('Allocated', 'Released', 'Cancelled', '')
}).unknown(false);
exports.allocationStatusSchema = Joi.object({
    allocationStatus: Joi.string().valid('Released', 'Cancelled').required(),
    remarks: Joi.string().trim().max(500).allow('')
}).unknown(false);
