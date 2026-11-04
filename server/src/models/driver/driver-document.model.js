const mongoose = require('mongoose');

const driverDocumentSchema = new mongoose.Schema({
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
    documentType: {
        type: String,
        required: true,
        enum: ['DrivingLicence', 'IdentityProof', 'AddressProof', 'MedicalCertificate', 'Other']
    },
    documentNumber: { type: String, trim: true, default: '', maxlength: 100 },
    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    fileUrl: { type: String, trim: true, default: '', maxlength: 1000 },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true }
}, { timestamps: true, versionKey: false });

driverDocumentSchema.index({ driverId: 1, documentType: 1, isDeleted: 1 });

module.exports = mongoose.model('DriverDocument', driverDocumentSchema);
