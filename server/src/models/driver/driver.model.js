const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    street: { type: String, trim: true, default: '', maxlength: 200 },
    city: { type: String, trim: true, default: '', maxlength: 100 },
    state: { type: String, trim: true, default: '', maxlength: 100 },
    postalCode: { type: String, trim: true, default: '', maxlength: 20 },
    country: { type: String, trim: true, default: '', maxlength: 100 }
}, { _id: false });

const driverStatusHistorySchema = new mongoose.Schema({
    status: {
        type: String,
        required: true,
        enum: ['Available', 'Assigned', 'OnTrip', 'OnLeave', 'Inactive', 'Suspended']
    },
    remarks: { type: String, trim: true, default: '', maxlength: 500 },
    updatedBy: { type: String, required: true, maxlength: 100 },
    role: { type: String, required: true, enum: ['admin', 'manager', 'driver'] },
    createdAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const driverSchema = new mongoose.Schema({
    driverCode: { type: String, required: true, trim: true, uppercase: true },
    personalInfo: {
        fullName: { type: String, required: true, trim: true, maxlength: 100 },
        dateOfBirth: { type: Date, default: null },
        gender: { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' }
    },
    contactInfo: {
        phone: { type: String, required: true, trim: true },
        alternatePhone: { type: String, trim: true, default: '' },
        email: { type: String, trim: true, lowercase: true, default: '' },
        address: { type: addressSchema, default: () => ({}) }
    },
    emergencyContact: {
        name: { type: String, trim: true, default: '', maxlength: 100 },
        relationship: { type: String, trim: true, default: '', maxlength: 60 },
        phone: { type: String, trim: true, default: '' }
    },
    employmentDetails: {
        joiningDate: { type: Date, required: true },
        employmentType: { type: String, required: true, enum: ['FullTime', 'Contract', 'Attached'] },
        experienceYears: { type: Number, min: 0, max: 60, default: 0 }
    },
    notes: { type: String, trim: true, default: '', maxlength: 2000 },
    driverStatus: {
        type: String,
        required: true,
        enum: ['Available', 'Assigned', 'OnTrip', 'OnLeave', 'Inactive', 'Suspended'],
        default: 'Available'
    },
    statusUpdatedAt: { type: Date, default: Date.now },
    statusHistory: { type: [driverStatusHistorySchema], default: [] },
    isDeleted: { type: Boolean, default: false }
}, {
    timestamps: true,
    versionKey: false
});

driverSchema.index({ driverCode: 1 }, { unique: true });
driverSchema.index(
    { 'contactInfo.phone': 1 },
    { unique: true, partialFilterExpression: { 'contactInfo.phone': { $type: 'string', $gt: '' } } }
);
driverSchema.index({ driverStatus: 1, isDeleted: 1 });

const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 }
}, { versionKey: false });

module.exports = mongoose.model('Driver', driverSchema);
module.exports.DriverCodeCounter = mongoose.models.DriverCodeCounter
    || mongoose.model('DriverCodeCounter', counterSchema);
module.exports.CodeCounter = module.exports.DriverCodeCounter;
