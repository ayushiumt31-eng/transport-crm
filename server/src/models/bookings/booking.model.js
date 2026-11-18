const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    contactName: { type: String, required: true, trim: true, maxlength: 100 },
    contactPhone: { type: String, required: true, trim: true, maxlength: 20 },
    street: { type: String, required: true, trim: true, maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, required: true, trim: true, maxlength: 100 },
    pincode: { type: String, required: true, trim: true, maxlength: 6 },
    landmark: { type: String, trim: true, default: '', maxlength: 150 },
    country: { type: String, trim: true, default: 'India', maxlength: 80 }
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
    status: {
        type: String,
        required: true,
        enum: ['pending', 'under_review', 'quoted', 'confirmed', 'rejected', 'cancelled', 'expired']
    },
    remarks: { type: String, trim: true, default: '', maxlength: 500 },
    updatedBy: { type: String, required: true, maxlength: 100 },
    role: { type: String, required: true, enum: ['admin', 'manager', 'customer'] },
    createdAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const quoteLineSchema = new mongoose.Schema({
    description: { type: String, required: true, trim: true, maxlength: 200 },
    quantityMilli: { type: Number, required: true, min: 1 },
    unitPricePaise: { type: Number, required: true, min: 0 },
    lineTotalPaise: { type: Number, required: true, min: 0 }
}, { _id: false });

const quoteSchema = new mongoose.Schema({
    version: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ['INR'], required: true, default: 'INR' },
    items: { type: [quoteLineSchema], required: true, validate: [(items) => items.length > 0 && items.length <= 50, 'A quote must have between 1 and 50 line items.'] },
    subtotalPaise: { type: Number, required: true, min: 1 },
    totalPaise: { type: Number, required: true, min: 1 },
    terms: { type: String, trim: true, default: '', maxlength: 2000 },
    validUntil: { type: Date, required: true },
    status: { type: String, enum: ['PendingAcceptance', 'Accepted', 'Declined', 'Expired', 'Withdrawn'], required: true },
    issuedBy: { type: String, required: true, maxlength: 100 },
    issuedAt: { type: Date, required: true },
    respondedBy: { type: String, default: '', maxlength: 100 },
    respondedAt: { type: Date, default: null }
}, { _id: false });

const bookingSchema = new mongoose.Schema({
    bookingNumber: { type: String, required: true, unique: true },
    bookingType: { type: String, required: true, enum: ['vehicle', 'online'] },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    pickupAddress: { type: addressSchema, required: true },
    deliveryAddress: { type: addressSchema, required: true },
    cargo: {
        goodsType: { type: String, required: true, trim: true, maxlength: 100 },
        description: { type: String, trim: true, default: '', maxlength: 1000 },
        packageType: {
            type: String,
            required: true,
            enum: ['box', 'bag', 'pallet', 'carton', 'drum', 'container', 'loose', 'other']
        },
        quantity: { type: Number, required: true, min: 1, max: 100000 },
        weightKg: { type: Number, required: true, min: 0.01, max: 100000000 },
        volumeCbm: { type: Number, default: 0, min: 0, max: 1000000 },
        specialInstructions: { type: String, trim: true, default: '', maxlength: 1000 }
    },
    vehicleRequirement: {
        vehicleType: {
            type: String,
            required: true,
            enum: ['Open Body', 'Container', 'Trailer', 'Heavy Duty', 'Temperature Controlled']
        },
        minCapacityKg: { type: Number, default: 0, min: 0, max: 100000000 },
        specialRequirements: { type: String, trim: true, default: '', maxlength: 500 }
    },
    schedule: {
        pickupDate: { type: Date, required: true },
        expectedDeliveryDate: { type: Date, required: true }
    },
    bookingStatus: {
        type: String,
        required: true,
        enum: ['pending', 'under_review', 'quoted', 'confirmed', 'rejected', 'cancelled', 'expired'],
        default: 'pending'
    },
    quote: { type: quoteSchema, default: null },
    statusHistory: { type: [statusHistorySchema], default: [] }
}, { timestamps: true, versionKey: false });

bookingSchema.index({ customerId: 1, createdAt: -1 });
bookingSchema.index({ bookingStatus: 1, 'schedule.pickupDate': 1 });
bookingSchema.index({ 'schedule.expectedDeliveryDate': 1 });

const bookingCounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 }
}, { versionKey: false });

const Booking = mongoose.model('Booking', bookingSchema);
const BookingCounter = mongoose.model('BookingCounter', bookingCounterSchema);

module.exports = { Booking, BookingCounter };
