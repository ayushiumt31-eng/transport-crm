const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();
const phone = Joi.string().trim().pattern(/^\+?[0-9][0-9\s-]{7,19}$/);
const dateOnly = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        return helpers.error('date.format');
    }
    return value;
});

const addressSchema = Joi.object({
    contactName: Joi.string().trim().min(2).max(100).required(),
    contactPhone: phone.required(),
    street: Joi.string().trim().min(3).max(200).required(),
    city: Joi.string().trim().min(2).max(100).required(),
    state: Joi.string().trim().min(2).max(100).required(),
    pincode: Joi.string().trim().pattern(/^\d{6}$/).required(),
    landmark: Joi.string().trim().max(150).allow(''),
    country: Joi.string().trim().min(2).max(80).default('India')
}).unknown(false);

const bookingRequestSchema = Joi.object({
    pickupAddress: addressSchema.required(),
    deliveryAddress: addressSchema.required(),
    cargo: Joi.object({
        goodsType: Joi.string().trim().min(2).max(100).required(),
        description: Joi.string().trim().max(1000).allow(''),
        packageType: Joi.string().valid('box', 'bag', 'pallet', 'carton', 'drum', 'container', 'loose', 'other').required(),
        quantity: Joi.number().integer().min(1).max(100000).required(),
        weightKg: Joi.number().min(0.01).max(100000000).required(),
        volumeCbm: Joi.number().min(0).max(1000000).default(0),
        specialInstructions: Joi.string().trim().max(1000).allow('')
    }).required().unknown(false),
    vehicleRequirement: Joi.object({
        vehicleType: Joi.string().valid('Open Body', 'Container', 'Trailer', 'Heavy Duty', 'Temperature Controlled').required(),
        minCapacityKg: Joi.number().min(0).max(100000000).default(0),
        specialRequirements: Joi.string().trim().max(500).allow('')
    }).required().unknown(false),
    schedule: Joi.object({
        pickupDate: Joi.date().iso().required(),
        expectedDeliveryDate: Joi.date().iso().required()
    }).required().unknown(false)
}).unknown(false).custom((value, helpers) => {
    const pickup = value.schedule.pickupDate;
    const delivery = value.schedule.expectedDeliveryDate;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (pickup < today) return helpers.error('booking.pickupDate');
    if (delivery < pickup) return helpers.error('booking.deliveryDate');
    return value;
}).messages({
    'booking.pickupDate': 'Pickup date cannot be before today.',
    'booking.deliveryDate': 'Expected delivery cannot be before pickup.'
});

exports.bookingParamsSchema = Joi.object({ bookingId: objectId }).unknown(false);
exports.bookingRequestSchema = bookingRequestSchema;
exports.bookingListQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('pending', 'under_review', 'quoted', 'confirmed', 'rejected', 'cancelled', 'expired', '')
}).unknown(false);
exports.bookingCalendarQuerySchema = Joi.object({
    startDate: dateOnly.required(),
    endDate: dateOnly.required()
}).unknown(false).custom((value, helpers) => {
    const start = new Date(`${value.startDate}T00:00:00.000Z`);
    const end = new Date(`${value.endDate}T23:59:59.999Z`);
    if (start > end) return helpers.error('booking.dateRange');
    if ((end - start) / 86400000 > 366) return helpers.error('booking.dateRangeLimit');
    return value;
}).messages({
    'booking.dateRange': 'Calendar end date must be on or after the start date.',
    'booking.dateRangeLimit': 'Calendar date range cannot exceed 366 days.'
});
exports.bookingStatusSchema = Joi.object({
    status: Joi.string().valid('pending', 'under_review', 'quoted', 'confirmed', 'rejected', 'cancelled', 'expired').required(),
    remarks: Joi.string().trim().max(500).allow('').default('')
}).unknown(false);
