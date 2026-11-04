const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();
const phone = Joi.string().trim().pattern(/^[6-9]\d{9}$/).messages({
    'string.pattern.base': 'Enter a valid 10-digit mobile number.'
});
const optionalDate = Joi.date().iso().empty('');
const addressSchema = Joi.object({
    street: Joi.string().trim().max(200).allow(''),
    city: Joi.string().trim().max(100).allow(''),
    state: Joi.string().trim().max(100).allow(''),
    postalCode: Joi.string().trim().max(20).allow(''),
    country: Joi.string().trim().max(100).allow('')
}).unknown(false);

const driverSchema = Joi.object({
    personalInfo: Joi.object({
        fullName: Joi.string().trim().min(2).max(100).required(),
        dateOfBirth: optionalDate,
        gender: Joi.string().valid('Male', 'Female', 'Other', '').allow('')
    }).required().unknown(false),
    contactInfo: Joi.object({
        phone: phone.required(),
        alternatePhone: phone.allow(''),
        email: Joi.string().trim().email().max(254).allow(''),
        address: addressSchema
    }).required().unknown(false),
    emergencyContact: Joi.object({
        name: Joi.string().trim().max(100).allow(''),
        relationship: Joi.string().trim().max(60).allow(''),
        phone: phone.allow('')
    }).unknown(false),
    employmentDetails: Joi.object({
        joiningDate: Joi.date().iso().required(),
        employmentType: Joi.string().valid('FullTime', 'Contract', 'Attached').required(),
        experienceYears: Joi.number().min(0).max(60)
    }).required().unknown(false),
    driverStatus: Joi.string().valid('Available', 'OnLeave', 'Inactive', 'Suspended'),
    notes: Joi.string().trim().max(2000).allow('')
}).unknown(false);

const licenseSchema = Joi.object({
    driverId: objectId,
    licenseNumber: Joi.string().trim().uppercase().min(3).max(100).required(),
    licenseType: Joi.string().valid('LMV', 'HMV', 'Transport', 'Other').required(),
    issueDate: optionalDate,
    expiryDate: Joi.date().iso().required(),
    status: Joi.string().valid('Valid', 'ExpiringSoon', 'Expired', 'UnderReview')
}).unknown(false).custom((value, helpers) => {
    if (value.issueDate && value.expiryDate && value.expiryDate < value.issueDate) {
        return helpers.error('driverLicense.dateRange');
    }
    return value;
}).messages({ 'driverLicense.dateRange': 'Licence expiry cannot be earlier than its issue date.' });

const documentSchema = Joi.object({
    driverId: objectId,
    documentType: Joi.string().valid('DrivingLicence', 'IdentityProof', 'AddressProof', 'MedicalCertificate', 'Other').required(),
    documentNumber: Joi.string().trim().max(100).allow(''),
    issueDate: optionalDate,
    expiryDate: optionalDate,
    fileUrl: Joi.string().uri({ scheme: ['https'] }).max(1000).allow('')
}).unknown(false).custom((value, helpers) => {
    if (value.issueDate && value.expiryDate && value.expiryDate < value.issueDate) {
        return helpers.error('driverDocument.dateRange');
    }
    return value;
}).messages({ 'driverDocument.dateRange': 'Document expiry cannot be earlier than its issue date.' });

const time = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).allow('');
const attendanceSchema = Joi.object({
    driverId: objectId,
    attendanceDate: Joi.date().iso().required(),
    status: Joi.string().valid('Present', 'Absent', 'OnLeave', 'HalfDay').required(),
    checkIn: time,
    checkOut: time,
    remarks: Joi.string().trim().max(1000).allow('')
}).unknown(false).custom((value, helpers) => {
    if (value.checkIn && value.checkOut && value.checkOut <= value.checkIn) {
        return helpers.error('attendance.timeRange');
    }
    if (['Absent', 'OnLeave'].includes(value.status) && (value.checkIn || value.checkOut)) {
        return helpers.error('attendance.noTimes');
    }
    return value;
}).messages({
    'attendance.timeRange': 'Check-out must be later than check-in.',
    'attendance.noTimes': 'Absent and leave records cannot include check-in or check-out times.'
});

const paymentSchema = Joi.object({
    driverId: objectId,
    periodStart: Joi.date().iso().required(),
    periodEnd: Joi.date().iso().required(),
    baseAmount: Joi.number().min(0).max(100000000).required(),
    allowances: Joi.number().min(0).max(100000000).default(0),
    deductions: Joi.number().min(0).max(100000000).default(0),
    status: Joi.string().valid('Draft', 'Approved', 'Paid', 'OnHold')
}).unknown(false).custom((value, helpers) => {
    if (value.periodEnd < value.periodStart) return helpers.error('payment.dateRange');
    if (value.baseAmount + (value.allowances || 0) < (value.deductions || 0)) {
        return helpers.error('payment.negativeNet');
    }
    return value;
}).messages({
    'payment.dateRange': 'Pay period end must be on or after its start.',
    'payment.negativeNet': 'Deductions cannot exceed base pay plus allowances.'
});

const listQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(100).allow(''),
    driverId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
    driverStatus: Joi.string().valid('Available', 'OnTrip', 'OnLeave', 'Inactive', 'Suspended', ''),
    status: Joi.string().max(40).allow(''),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso()
}).unknown(false).custom((value, helpers) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
        return helpers.error('query.dateRange');
    }
    return value;
}).messages({ 'query.dateRange': 'End date must be on or after start date.' });

const idParamsSchema = Joi.object({ id: objectId }).unknown(false);
const statusSchemas = {
    driver: Joi.object({
        driverStatus: Joi.string().valid('Available', 'OnLeave', 'Inactive', 'Suspended').required(),
        remarks: Joi.string().trim().max(500).allow('')
    }).unknown(false),
    license: Joi.object({ status: Joi.string().valid('Valid', 'UnderReview').required() }).unknown(false),
    attendance: Joi.object({
        status: Joi.string().valid('Present', 'Absent', 'OnLeave', 'HalfDay').required()
    }).unknown(false),
    payment: Joi.object({
        status: Joi.string().valid('Draft', 'Approved', 'Paid', 'OnHold').required()
    }).unknown(false)
};

const partial = (schema) => schema.fork(Object.keys(schema.describe().keys), (field) => field.optional()).min(1);
const partialObject = (schema) => schema.fork(Object.keys(schema.describe().keys), (field) => field.optional());
const driverUpdateSchema = partial(driverSchema).fork(
    ['personalInfo', 'contactInfo', 'emergencyContact', 'employmentDetails'],
    (schema) => partialObject(schema)
);

exports.idParamsSchema = idParamsSchema;
exports.listQuerySchema = listQuerySchema;
exports.driverSchema = driverSchema;
exports.driverUpdateSchema = driverUpdateSchema;
exports.driverStatusSchema = statusSchemas.driver;
exports.licenseSchema = licenseSchema;
exports.licenseUpdateSchema = partial(licenseSchema);
exports.licenseStatusSchema = statusSchemas.license;
exports.documentSchema = documentSchema;
exports.documentUpdateSchema = partial(documentSchema);
exports.attendanceSchema = attendanceSchema;
exports.attendanceUpdateSchema = partial(attendanceSchema);
exports.attendanceStatusSchema = statusSchemas.attendance;
exports.paymentSchema = paymentSchema;
exports.paymentUpdateSchema = partial(paymentSchema);
exports.paymentStatusSchema = statusSchemas.payment;
