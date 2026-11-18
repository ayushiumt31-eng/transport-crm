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
    originalName: { type: String, trim: true, default: '', maxlength: 255 },
    contentType: { type: String, enum: ['', 'application/pdf', 'image/jpeg', 'image/png'], default: '' },
    size: { type: Number, min: 0, max: 5 * 1024 * 1024, default: 0 },
    content: { type: Buffer, default: undefined, select: false },
    fileUrl: { type: String, trim: true, default: '', maxlength: 1000 },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true }
}, { timestamps: true, versionKey: false });

driverDocumentSchema.index({ driverId: 1, documentType: 1, isDeleted: 1 });

module.exports = mongoose.model('DriverDocument', driverDocumentSchema);
