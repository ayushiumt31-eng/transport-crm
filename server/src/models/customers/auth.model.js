const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    street: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' }
}, { _id: false });

const savedAddressSchema = new mongoose.Schema({
    label: { type: String, trim: true, default: 'Office', maxlength: 60 },
    address: { type: String, trim: true, required: true, maxlength: 500 },
    city: { type: String, trim: true, required: true, maxlength: 100 },
    state: { type: String, trim: true, required: true, maxlength: 100 },
    pincode: { type: String, trim: true, required: true, maxlength: 6 },
    contactName: { type: String, trim: true, default: '', maxlength: 100 },
    contactPhone: { type: String, trim: true, default: '', maxlength: 20 },
    isDefault: { type: Boolean, default: false }
}, { timestamps: true });

const customerSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    alternatePhone: { type: String, trim: true, default: '' },
    email: { type: String, lowercase: true, trim: true },
    contactPerson: { type: String, trim: true, default: '', maxlength: 100 },
    companyName: { type: String, trim: true, default: '', maxlength: 150 },
    customerType: { type: String, enum: ['individual', 'business'], default: 'business' },
    businessType: { type: String, trim: true, default: '', maxlength: 120 },
    industry: { type: String, trim: true, default: '', maxlength: 120 },
    gstin: { type: String, uppercase: true, trim: true },
    pan: { type: String, uppercase: true, trim: true },
    address: { type: addressSchema, default: () => ({}) },
    pickupAddress: { type: addressSchema, default: () => ({}) },
    paymentTerms: { type: String, trim: true, default: 'Advance' },
    creditLimit: { type: Number, min: 0, default: 0 },
    crmStatus: { type: String, enum: ['Active', 'Inactive', 'Blocked'], default: 'Active' },
    crmVerificationStatus: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
    status: {
        type: String,
        enum: ['Pending', 'Active', 'Suspended'],
        default: 'Active'
    },
    statusReason: { type: String, trim: true, default: '', maxlength: 250 },
    kycStatus: {
        type: String,
        enum: ['NotSubmitted', 'Pending', 'Verified', 'Rejected'],
        default: 'NotSubmitted'
    },
    kycSubmittedAt: { type: Date, default: null },
    kycReviewedAt: { type: Date, default: null },
    kycReviewedBy: { type: String, trim: true, default: '' },
    kycRemarks: { type: String, trim: true, default: '', maxlength: 500 },
    isProfileComplete: { type: Boolean, default: false },
    notes: { type: String, trim: true, default: '', maxlength: 2000 },
    preferences: {
        language: { type: String, enum: ['en', 'hi', 'mr', 'gu'], default: 'en' },
        defaultVehicleType: { type: String, trim: true, default: '', maxlength: 80 },
        notifyBySms: { type: Boolean, default: true },
        notifyByEmail: { type: Boolean, default: true }
    },
    addresses: { type: [savedAddressSchema], default: [] },
    lastActiveAt: { type: Date, default: null }
}, {
    timestamps: true,
    versionKey: false
});

customerSchema.index({ status: 1, createdAt: -1 });
customerSchema.index({ kycStatus: 1, createdAt: -1 });

const Customer = mongoose.model('Customer', customerSchema);
exports.Customer = Customer;
