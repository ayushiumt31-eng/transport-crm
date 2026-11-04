const mongoose = require('mongoose');

const kycDocumentSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    documentType: {
        type: String,
        enum: ['pan', 'gstin', 'address_proof'],
        required: true
    },
    originalName: { type: String, required: true, maxlength: 255 },
    contentType: { type: String, enum: ['application/pdf', 'image/jpeg', 'image/png'], required: true },
    size: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
    content: { type: Buffer, required: true, select: false },
    status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
    remarks: { type: String, trim: true, default: '', maxlength: 500 },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, trim: true, default: '' }
}, { timestamps: true, versionKey: false });

kycDocumentSchema.index({ customerId: 1, documentType: 1, createdAt: -1 });

module.exports = mongoose.model('KycDocument', kycDocumentSchema);
