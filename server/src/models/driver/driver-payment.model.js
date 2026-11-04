const mongoose = require('mongoose');

const driverPaymentSchema = new mongoose.Schema({
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    baseAmount: { type: Number, required: true, min: 0 },
    allowances: { type: Number, min: 0, default: 0 },
    deductions: { type: Number, min: 0, default: 0 },
    netAmount: { type: Number, required: true, min: 0 },
    status: { type: String, required: true, enum: ['Draft', 'Approved', 'Paid', 'OnHold'], default: 'Draft' },
    paidAt: { type: Date, default: null },
    statusHistory: [{
        status: { type: String, required: true, enum: ['Draft', 'Approved', 'Paid', 'OnHold'] },
        updatedBy: { type: String, required: true },
        role: { type: String, required: true, enum: ['admin', 'manager'] },
        createdAt: { type: Date, required: true, default: Date.now }
    }],
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true }
}, { timestamps: true, versionKey: false });

driverPaymentSchema.index({ driverId: 1, periodStart: 1, periodEnd: 1 }, { unique: true });
driverPaymentSchema.index({ status: 1, periodStart: -1, isDeleted: 1 });

module.exports = mongoose.model('DriverPayment', driverPaymentSchema);
