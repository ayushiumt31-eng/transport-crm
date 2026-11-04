const mongoose = require('mongoose');

const driverLicenseSchema = new mongoose.Schema({
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
    licenseNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 100 },
    licenseType: { type: String, required: true, enum: ['LMV', 'HMV', 'Transport', 'Other'] },
    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, required: true },
    status: { type: String, required: true, enum: ['Valid', 'ExpiringSoon', 'Expired', 'UnderReview'] },
    statusHistory: [{
        status: { type: String, required: true, enum: ['Valid', 'ExpiringSoon', 'Expired', 'UnderReview'] },
        updatedBy: { type: String, required: true },
        role: { type: String, required: true, enum: ['admin', 'manager'] },
        createdAt: { type: Date, required: true, default: Date.now }
    }],
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true }
}, { timestamps: true, versionKey: false });

driverLicenseSchema.index({ licenseNumber: 1 }, { unique: true });
driverLicenseSchema.index({ driverId: 1, expiryDate: 1, isDeleted: 1 });

module.exports = mongoose.model('DriverLicense', driverLicenseSchema);
